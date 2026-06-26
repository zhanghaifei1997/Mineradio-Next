import { json, getQueryParam } from '../utils/http.js'

const KUGOU_API_BASE = 'http://msearch.kugou.com'
const KUGOU_PLAY_BASE = 'http://www.kugou.com'
const KUGOU_MOBILE_BASE = 'http://mobilecdn.kugou.com'

async function kugouRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      Referer: 'https://www.kugou.com/',
      ...options.headers,
    },
    ...options,
  })
  return res.json()
}

export async function handleKugouRoute(req, res, url) {
  const path = url.pathname.replace('/api/kugou', '')

  const routeHandlers = {
    '/search': async () => {
      const keyword = getQueryParam(url, 'keyword', '')
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const page = Math.floor(offset / limit) + 1

      const data = await kugouRequest(
        `${KUGOU_API_BASE}/api/v3/search/song?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&showtype=1`
      )

      const songs = data?.data?.info || []
      return {
        songs: songs.map(s => mapKugouSong(s)),
        total: data?.data?.total || 0,
        hasMore: songs.length >= limit,
      }
    },
    '/song/detail': async () => {
      const hash = getQueryParam(url, 'hash', '')
      const data = await kugouRequest(
        `${KUGOU_MOBILE_BASE}/api/v3/song/detail?hash=${hash}`
      )
      const song = data?.data?.info?.[0]
      return song ? { song: mapKugouSong(song) } : null
    },
    '/song/url': async () => {
      const hash = getQueryParam(url, 'hash', '')
      const level = getQueryParam(url, 'level', '320')

      const data = await kugouRequest(
        `${KUGOU_PLAY_BASE}/yy/index.php?r=play/getdata&hash=${encodeURIComponent(hash)}&mid=1&platid=4&album_id=0`
      )

      const urlKey = mapQualityToUrlKey(level)
      const playUrl = data?.data?.[urlKey] || data?.data?.play_url

      if (playUrl) {
        return {
          url: playUrl,
          quality: level,
          size: data?.data?.[`${urlKey}_size`] || 0,
        }
      }
      return { url: null }
    },
    '/lyric': async () => {
      const hash = getQueryParam(url, 'hash', '')
      const data = await kugouRequest(
        `${KUGOU_PLAY_BASE}/yy/index.php?r=play/getdata&hash=${encodeURIComponent(hash)}&mid=1&platid=4&album_id=0`
      )
      const lrc = data?.data?.lyrics
      return { lyric: lrc || '' }
    },
    '/playlist/detail': async () => {
      const id = getQueryParam(url, 'id', '')
      const data = await kugouRequest(
        `${KUGOU_MOBILE_BASE}/api/v3/special/info?specialid=${id}`
      )
      const playlist = data?.data?.info || data?.data
      return playlist ? { playlist: mapKugouPlaylist(playlist) } : null
    },
    '/recommend/playlist': async () => {
      const data = await kugouRequest(
        `${KUGOU_MOBILE_BASE}/api/v3/special/list?page=1&pagesize=20`
      )
      const playlists = data?.data?.info || []
      return {
        playlists: playlists.map(p => mapKugouPlaylist(p)),
      }
    },
    '/login/status': async () => {
      return { loggedIn: false, userId: null, nickname: '', avatarUrl: '' }
    },
    '/logout': async () => {
      return { success: true }
    },
  }

  const handler = routeHandlers[path]
  if (handler) {
    try {
      const data = await handler()
      json(res, data)
    } catch (err) {
      console.error('Kugou API error:', err)
      json(res, { error: err.message || 'API Error' }, 500)
    }
    return true
  }

  return false
}

function mapKugouSong(s) {
  return {
    hash: s.hash || s.FileHash || '',
    songname: s.songname || s.name || s.SongName || '',
    singer: (s.singer || s.artists || (s.SingerName ? [s.SingerName] : []) || []).map((a, i) => {
      if (typeof a === 'string') {
        return { id: String(i), name: a }
      }
      return {
        id: String(a.id || a.singerid || i),
        name: a.name || a.singername || '',
      }
    }),
    album: s.album_name || s.album || s.AlbumName ? {
      id: String(s.albumid || s.album_id || s.AlbumID || ''),
      name: s.album_name || s.album || s.AlbumName || '',
      picUrl: s.imgurl || s.album_img || s.AlbumImg || '',
    } : null,
    duration: s.duration || s.Duration || s.timelength || 0,
    imgurl: s.imgurl || s.album_img || '',
  }
}

function mapKugouPlaylist(p) {
  return {
    id: p.specialid || p.id || '',
    specialname: p.specialname || p.name || '',
    imgurl: p.imgurl || p.coverImgUrl || '',
    intro: p.intro || p.description || '',
    songcount: p.songcount || p.trackCount || 0,
    playcount: p.playcount || p.playCount || 0,
    songs: p.songs || p.tracks || [],
  }
}

function mapQualityToUrlKey(level) {
  const map = {
    '128': 'play_url',
    '192': 'play_url',
    '320': 'play_url',
    'flac': 'play_url',
    'hires': 'play_url',
  }
  return map[level] || 'play_url'
}
