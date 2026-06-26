import { json, getQueryParam } from '../utils/http.js'

const QQ_API_BASE = 'https://u.y.qq.com'
const QQ_MUSIC_BASE = 'https://c.y.qq.com'

async function qqRequest(path, params = {}) {
  const query = new URLSearchParams(params).toString()
  const url = `${QQ_API_BASE}${path}?${query}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://y.qq.com/',
    },
  })
  return res.json()
}

export async function handleQQMusicRoute(req, res, url) {
  const path = url.pathname.replace('/api/qq', '')

  const routeHandlers = {
    '/search': async () => {
      const keyword = getQueryParam(url, 'keyword', '')
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const data = await qqRequest('/cgi-bin/musicu.fcg', {
        format: 'json',
        inCharset: 'utf8',
        outCharset: 'utf-8',
        platform: 'yqq.json',
        needNewCode: 0,
        data: JSON.stringify({
          req_1: {
            method: 'DoSearchForQQMusicDesktop',
            module: 'smartbox.smartBox',
            param: {
              search_type: 0,
              query: keyword,
              page_num: Math.floor(offset / limit) + 1,
              num_per_page: limit,
            },
          },
        }),
      })
      const songs = data?.req_1?.data?.body?.song?.list || []
      return {
        songs: songs.map(s => mapQQSong(s)),
        total: data?.req_1?.data?.body?.song?.total || 0,
        hasMore: songs.length >= limit,
      }
    },
    '/song/detail': async () => {
      const songmid = getQueryParam(url, 'songmid', '')
      const data = await qqRequest('/cgi-bin/musicu.fcg', {
        format: 'json',
        data: JSON.stringify({
          comm: { ct: 19, cv: 0 },
          songInfo: {
            method: 'get_song_detail_yqq',
            module: 'music.pf_song_detail_svr',
            param: { song_mid: songmid },
          },
        }),
      })
      const info = data?.songInfo?.data?.track_info
      return info ? { song: mapQQSong(info) } : null
    },
    '/song/url': async () => {
      const songmid = getQueryParam(url, 'songmid', '')
      const level = getQueryParam(url, 'level', 'exhigh')
      const filetype = mapQualityToFiletype(level)
      const data = await qqRequest('/cgi-bin/musicu.fcg', {
        format: 'json',
        data: JSON.stringify({
          req: {
            module: 'vkey.GetVkeyServer',
            method: 'CgiGetVkey',
            param: {
              guid: '1234567890',
              songmid: [songmid],
              songtype: [0],
              uin: '0',
              loginflag: 0,
              platform: '20',
              filename: [`${filetype}.m4a`],
            },
          },
        }),
      })
      const vkey = data?.req?.data?.midurlinfo?.[0]?.vkey
      const purl = data?.req?.data?.midurlinfo?.[0]?.purl
      if (vkey && purl) {
        return {
          url: `https://dl.stream.qqmusic.qq.com/${purl}?vkey=${vkey}&guid=1234567890&uin=0&fromtag=66`,
          quality: level,
        }
      }
      return { url: null }
    },
    '/lyric': async () => {
      const songmid = getQueryParam(url, 'songmid', '')
      const data = await qqRequest('/cgi-bin/musicu.fcg', {
        format: 'json',
        data: JSON.stringify({
          comm: { ct: 19, cv: 0 },
          lrc: {
            module: 'music.musichallSong.PlayLyricInfo',
            method: 'GetPlayLyricInfo',
            param: {
              songMID: songmid,
              songID: 0,
            },
          },
        }),
      })
      const lrc = data?.lrc?.data?.lyric
      return { lyric: lrc || '' }
    },
    '/login/status': async () => {
      return { playbackKeyReady: false, uin: null }
    },
  }

  const handler = routeHandlers[path]
  if (handler) {
    try {
      const data = await handler()
      json(res, data)
    } catch (err) {
      console.error('QQ Music API error:', err)
      json(res, { error: err.message || 'API Error' }, 500)
    }
    return true
  }

  return false
}

function mapQQSong(s) {
  return {
    songmid: s.mid || s.songmid || s.songMid,
    songname: s.name || s.songname || s.title,
    singer: (s.singer || s.artists || []).map(a => ({
      mid: a.mid || a.id,
      name: a.name,
    })),
    album: s.album ? {
      mid: s.album.mid || s.album.id,
      name: s.album.name || s.album.title,
      picUrl: s.album.picUrl || null,
    } : null,
    interval: s.interval || s.duration || 0,
  }
}

function mapQualityToFiletype(level) {
  const map = {
    standard: 'C200',
    higher: 'C400',
    exhigh: 'F000',
    lossless: 'A000',
    hires: 'H000',
  }
  return map[level] || 'F000'
}
