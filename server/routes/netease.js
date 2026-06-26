import NeteaseCloudMusicApi from 'NeteaseCloudMusicApi'
import { json, getQueryParam, parseBody } from '../utils/http.js'
import { logger } from '../utils/logger.js'
import {
  getUserCookie,
  saveCookie,
  readCookieFromResponse,
  clearCookie,
} from '../utils/cookie.js'

const api = NeteaseCloudMusicApi

function normalizeApiCode(response) {
  if (!response) return 500
  const body = response.body || response
  if (body && typeof body.code === 'number') return body.code
  if (typeof response.code === 'number') return response.code
  return 200
}

function normalizeLoginInfo(profile, account, data) {
  const p = profile || {}
  const a = account || {}
  const d = data || {}
  const userId = p.userId || a.id || d.userId || 0
  const vipType = p.vipType || a.vipType || 0
  const isVip = vipType > 0
  const isSvip = vipType === 11 || vipType === 12
  return {
    loggedIn: !!userId,
    userId,
    nickname: p.nickname || a.userName || '',
    avatar: p.avatarUrl || p.img1v1Url || '',
    vipType,
    vipLevel: p.level || 0,
    isVip,
    isSvip,
    vipLabel: isSvip ? 'SVIP' : isVip ? 'VIP' : '无VIP',
    gender: p.gender || 0,
    birthday: p.birthday || 0,
    city: p.city || 0,
    province: p.province || 0,
    signature: p.signature || '',
  }
}

async function getLoginInfo() {
  const cookie = getUserCookie()
  if (!cookie) return { loggedIn: false }
  try {
    const r = await api.login_status({ cookie, timestamp: Date.now() })
    const body = r.body || {}
    const data = body.data || {}
    const profile = data.profile || body.profile || {}
    const account = data.account || body.account || {}
    if (profile && profile.userId) {
      return normalizeLoginInfo(profile, account, data)
    }
    return { loggedIn: false }
  } catch (err) {
    logger.warn('Get login info failed:', err.message)
    return { loggedIn: false }
  }
}

async function requireLogin(res) {
  const info = await getLoginInfo()
  if (!info.loggedIn) {
    json(res, { error: 'Not logged in', loggedIn: false }, 401)
    return null
  }
  return info
}

function mapSongRecord(s) {
  if (!s) return null
  const id = s.id || 0
  const name = s.name || ''
  const artists = s.ar || s.artists || []
  const album = s.al || s.album || {}
  const duration = s.dt || s.duration || 0
  const fee = s.fee || 0
  const privilege = s.privilege || {}
  return {
    id,
    name,
    artist: artists.map(a => a && a.name).filter(Boolean).join(' / '),
    artists: artists.map(a => ({ id: a && a.id, name: a && a.name })).filter(a => a.id),
    album: {
      id: album.id,
      name: album.name || '',
      cover: album.picUrl || album.img1v1Url || '',
    },
    duration,
    fee,
    playable: fee !== 1 && fee !== 4,
    isVip: fee === 1 || fee === 4,
    subp: privilege.subp || 0,
    pl: privilege.pl || 0,
    dl: privilege.dl || 0,
  }
}

export async function handleNeteaseRoute(req, res, url) {
  const path = url.pathname.replace('/api/netease', '')
  const cookie = getUserCookie()

  const routeHandlers = {
    '/login/qr/key': async () => {
      const r = await api.login_qr_key({ timestamp: Date.now() })
      const key = r.body && r.body.data && r.body.data.unikey
      return { key }
    },

    '/login/qr/create': async () => {
      const key = getQueryParam(url, 'key')
      const r = await api.login_qr_create({ key, qrimg: true, timestamp: Date.now() })
      const d = r.body && r.body.data
      return { img: d && d.qrimg, url: d && d.qrurl }
    },

    '/login/qr/check': async () => {
      const key = getQueryParam(url, 'key')
      let r = await api.login_qr_check({ key, noCookie: true, timestamp: Date.now() })
      let body = r.body || {}
      let code = Number(body.code || r.code)
      let msg = body.message || r.message || ''
      let respCookie = readCookieFromResponse(r)
      
      if (code === 803 && !respCookie) {
        try {
          const retry = await api.login_qr_check({ key, timestamp: Date.now() })
          const retryCookie = readCookieFromResponse(retry)
          if (retryCookie) {
            r = retry
            body = retry.body || body
            code = Number(body.code || retry.code || code)
            msg = body.message || retry.message || msg
            respCookie = retryCookie
          }
        } catch (retryErr) {
          logger.warn('Login qr cookie retry failed:', retryErr.message)
        }
      }

      if (code === 803) {
        if (respCookie) saveCookie(respCookie)
        const info = await getLoginInfo()
        if (!info.loggedIn) {
          const profile = body.profile || (body.data && body.data.profile) || {}
          const account = body.account || (body.data && body.data.account) || {}
          const loginInfo = normalizeLoginInfo(profile, account, body.data || body)
          if (!loginInfo.loggedIn && respCookie) {
            return {
              code,
              message: msg,
              loggedIn: true,
              pendingProfile: true,
              nickname: body.nickname || (profile && profile.nickname) || '网易云用户',
              avatar: body.avatarUrl || (profile && profile.avatarUrl) || '',
              vipType: 0,
              vipLevel: 'none',
              isVip: false,
              isSvip: false,
              vipLabel: '无VIP',
              hasCookie: !!respCookie,
            }
          }
          return { code, message: msg, ...loginInfo, hasCookie: !!respCookie }
        }
        return { code, message: msg, ...info, hasCookie: !!respCookie }
      }
      return { code, message: msg, nickname: body.nickname, avatar: body.avatarUrl }
    },

    '/login/status': async () => {
      return await getLoginInfo()
    },

    '/login/refresh': async () => {
      const r = await api.login_refresh({ cookie, timestamp: Date.now() })
      const respCookie = readCookieFromResponse(r)
      if (respCookie) saveCookie(respCookie)
      const info = await getLoginInfo()
      return { ...info, refreshed: true, body: r.body || r }
    },

    '/logout': async () => {
      try { await api.logout({ cookie, timestamp: Date.now() }) } catch (e) {}
      clearCookie()
      return { ok: true }
    },

    '/user/playlist': async () => {
      const uid = getQueryParam(url, 'uid', '')
      const limit = parseInt(getQueryParam(url, 'limit', '60'))
      const r = await api.user_playlist({ uid, limit, cookie, timestamp: Date.now() })
      const list = ((r.body && r.body.playlist) || []).map(pl => ({
        id: pl.id,
        name: pl.name,
        cover: pl.coverImgUrl || '',
        trackCount: pl.trackCount || 0,
        playCount: pl.playCount || 0,
        creator: (pl.creator && pl.creator.nickname) || '',
        subscribed: !!pl.subscribed,
        specialType: pl.specialType || 0,
      }))
      const info = await getLoginInfo()
      return { loggedIn: info.loggedIn, userId: info.userId, playlists: list }
    },

    '/search': async () => {
      const keywords = getQueryParam(url, 'keywords', '')
      const type = parseInt(getQueryParam(url, 'type', '1'))
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const r = await api.cloudsearch({ keywords, type, limit, offset, cookie, timestamp: Date.now() })
      return r.body
    },

    '/search/suggest': async () => {
      const keywords = getQueryParam(url, 'keywords', '')
      const type = getQueryParam(url, 'type', 'mobile')
      try {
        const r = await api.search_suggest({ keywords, type, cookie, timestamp: Date.now() })
        return r.body
      } catch (e) {
        logger.warn('Search suggest failed, fallback:', e.message)
        const r = await api.search_multimatch({ keywords, cookie, timestamp: Date.now() })
        return r.body
      }
    },

    '/search/hot': async () => {
      const r = await api.search_hot_detail({ timestamp: Date.now() })
      return r.body
    },

    '/song/detail': async () => {
      const ids = getQueryParam(url, 'ids', '')
      const r = await api.song_detail({ ids, cookie, timestamp: Date.now() })
      const songs = (r.body && r.body.songs || []).map(mapSongRecord).filter(s => s.id)
      return { songs, body: r.body }
    },

    '/song/url': async () => {
      const id = getQueryParam(url, 'id', '')
      const level = getQueryParam(url, 'level', 'exhigh')
      const r = await api.song_url_v1({ id, level, cookie, timestamp: Date.now() })
      return r.body
    },

    '/lyric': async () => {
      const id = getQueryParam(url, 'id', '')
      let body = {}
      let source = 'lyric'
      try {
        if (typeof api.lyric_new === 'function') {
          const nr = await api.lyric_new({ id, cookie, timestamp: Date.now() })
          body = nr.body || {}
          source = 'lyric_new'
        }
      } catch (errNew) {
        logger.warn('Lyric new failed:', errNew.message)
      }
      if (!((body.lrc && body.lrc.lyric) || (body.yrc && body.yrc.lyric))) {
        const r = await api.lyric({ id, cookie, timestamp: Date.now() })
        body = r.body || body || {}
        source = 'lyric'
      }
      return {
        lyric: (body.lrc && body.lrc.lyric) || '',
        tlyric: (body.tlyric && body.tlyric.lyric) || '',
        yrc: (body.yrc && body.yrc.lyric) || '',
        source,
      }
    },

    '/playlist/detail': async () => {
      const id = getQueryParam(url, 'id', '')
      const r = await api.playlist_detail({ id, cookie, timestamp: Date.now() })
      return r.body
    },

    '/playlist/track/all': async () => {
      const id = getQueryParam(url, 'id', '')
      const limit = parseInt(getQueryParam(url, 'limit', '100'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const r = await api.playlist_track_all({ id, limit, offset, cookie, timestamp: Date.now() })
      return r.body
    },

    '/playlist/tracks': async () => {
      const id = getQueryParam(url, 'id', '')
      let playlistMeta = { id, name: '', cover: '', trackCount: 0 }
      let rawTracks = []

      if (typeof api.playlist_track_all === 'function') {
        try {
          const all = await api.playlist_track_all({ id, limit: 500, offset: 0, cookie, timestamp: Date.now() })
          rawTracks = (all.body && (all.body.songs || all.body.tracks)) || []
        } catch (err) {
          logger.warn('Playlist track all failed, fallback:', err.message)
        }
      }

      if (!rawTracks.length) {
        const detail = await api.playlist_detail({ id, s: 0, cookie, timestamp: Date.now() })
        const pl = (detail.body && detail.body.playlist) || {}
        playlistMeta = { id: pl.id || id, name: pl.name || '', cover: pl.coverImgUrl || '', trackCount: pl.trackCount || 0 }
        rawTracks = pl.tracks || []
      }

      const tracks = rawTracks.map(mapSongRecord).filter(t => t.id)
      if (!playlistMeta.trackCount) playlistMeta.trackCount = tracks.length
      return { playlist: playlistMeta, tracks }
    },

    '/playlist/create': async () => {
      const info = await requireLogin(res)
      if (!info) return null
      const body = req.method === 'POST' ? await parseBody(req) : {}
      const name = String(body.name || getQueryParam(url, 'name') || '').trim()
      const privacy = String(body.privacy || getQueryParam(url, 'privacy') || '0')
      if (!name) {
        json(res, { error: 'Missing playlist name' }, 400)
        return null
      }
      const r = await api.playlist_create({ name, privacy, cookie, timestamp: Date.now() })
      const created = (r.body && (r.body.playlist || r.body.data)) || {}
      return { loggedIn: true, playlist: created, body: r.body || r }
    },

    '/playlist/delete': async () => {
      const info = await requireLogin(res)
      if (!info) return null
      const body = req.method === 'POST' ? await parseBody(req) : {}
      const id = body.id || getQueryParam(url, 'id')
      if (!id) {
        json(res, { error: 'Missing playlist id' }, 400)
        return null
      }
      const r = await api.playlist_delete({ id, cookie, timestamp: Date.now() })
      return { loggedIn: true, id, body: r.body || r }
    },

    '/playlist/add-song': async () => {
      const info = await requireLogin(res)
      if (!info) return null
      const body = req.method === 'POST' ? await parseBody(req) : {}
      const pid = body.pid || getQueryParam(url, 'pid')
      const id = body.id || body.ids || getQueryParam(url, 'id') || getQueryParam(url, 'ids')
      if (!pid || !id) {
        json(res, { error: 'Missing playlist id or song id' }, 400)
        return null
      }
      const attempts = []
      let finalBody = null
      let finalCode = 0
      let finalMessage = ''
      let success = false

      const primary = await api.playlist_tracks({ op: 'add', pid, tracks: String(id), cookie, timestamp: Date.now() })
      finalBody = primary.body || primary
      finalCode = normalizeApiCode(primary)
      finalMessage = finalBody.message || ''
      success = finalCode === 200 && !(finalBody && finalBody.error)
      attempts.push({ api: 'playlist_tracks', code: finalCode, message: finalMessage, body: finalBody })

      if (!success && typeof api.playlist_track_add === 'function') {
        try {
          const fallback = await api.playlist_track_add({ pid, ids: String(id), cookie, timestamp: Date.now() })
          finalBody = fallback.body || fallback
          finalCode = normalizeApiCode(fallback)
          finalMessage = finalBody.message || finalMessage
          success = finalCode === 200 && !(finalBody && finalBody.error)
          attempts.push({ api: 'playlist_track_add', code: finalCode, message: finalMessage, body: finalBody })
        } catch (fallbackErr) {
          const errBody = fallbackErr.body || fallbackErr.response || {}
          finalBody = errBody
          finalCode = normalizeApiCode(errBody)
          finalMessage = errBody.message || fallbackErr.message || ''
          attempts.push({ api: 'playlist_track_add', code: finalCode, message: finalMessage, body: errBody })
        }
      }

      if (!success) {
        json(res, { loggedIn: true, pid, id, success: false, code: finalCode, error: finalMessage || 'PLAYLIST_ADD_FAILED', attempts }, finalCode === 401 ? 401 : 409)
        return null
      }
      return { loggedIn: true, pid, id, success: true, code: finalCode, body: finalBody, attempts }
    },

    '/playlist/delete-song': async () => {
      const info = await requireLogin(res)
      if (!info) return null
      const body = req.method === 'POST' ? await parseBody(req) : {}
      const pid = body.pid || getQueryParam(url, 'pid')
      const id = body.id || body.ids || getQueryParam(url, 'id') || getQueryParam(url, 'ids')
      if (!pid || !id) {
        json(res, { error: 'Missing playlist id or song id' }, 400)
        return null
      }
      const r = await api.playlist_tracks({ op: 'del', pid, tracks: String(id), cookie, timestamp: Date.now() })
      const code = normalizeApiCode(r)
      return { loggedIn: true, pid, id, success: code === 200, code, body: r.body || r }
    },

    '/recommend/songs': async () => {
      const r = await api.recommend_songs({ cookie, timestamp: Date.now() })
      return r.body
    },

    '/recommend/resource': async () => {
      if (!cookie) {
        return { recommend: [] }
      }
      try {
        const r = await api.recommend_resource({ cookie, timestamp: Date.now() })
        return r.body
      } catch (err) {
        const code = err.status || (err.body && err.body.code) || 0
        if (code === 301 || code === 401) {
          return { recommend: [] }
        }
        throw err
      }
    },

    '/personal/fm': async () => {
      const r = await api.personal_fm({ cookie, timestamp: Date.now() })
      const songs = (r.body && r.body.data || []).map(mapSongRecord).filter(s => s.id)
      return { songs, body: r.body }
    },

    '/like': async () => {
      const info = await requireLogin(res)
      if (!info) return null
      const body = req.method === 'POST' ? await parseBody(req) : {}
      const id = body.id || getQueryParam(url, 'id')
      const like = String(body.like != null ? body.like : getQueryParam(url, 'like', 'true')) !== 'false'
      if (!id) {
        json(res, { error: 'Missing song id' }, 400)
        return null
      }
      const r = await api.like({ id, like: String(like), cookie, timestamp: Date.now() })
      const respCookie = readCookieFromResponse(r)
      if (respCookie) saveCookie(respCookie)
      const code = normalizeApiCode(r)
      return { loggedIn: true, id, liked: like, code, body: r.body || r }
    },

    '/song/like/check': async () => {
      const info = await requireLogin(res)
      if (!info) return null
      const ids = String(getQueryParam(url, 'ids') || getQueryParam(url, 'id') || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      if (!ids.length) {
        json(res, { error: 'Missing song id', liked: {}, ids: [] }, 400)
        return null
      }
      let likedIds = []
      try {
        if (typeof api.song_like_check === 'function') {
          const checked = await api.song_like_check({ ids: JSON.stringify(ids.map(Number).filter(Boolean)), cookie, timestamp: Date.now() })
          const data = (checked.body && (checked.body.data || checked.body.ids)) || checked.body || {}
          if (Array.isArray(data)) likedIds = data.map(String)
          else if (data && typeof data === 'object') {
            ids.forEach(id => {
              if (data[id] || data[String(id)] || data[Number(id)]) likedIds.push(String(id))
            })
          }
        }
      } catch (e) {
        logger.warn('Like check direct failed:', e.message)
      }
      if (!likedIds.length) {
        const r = await api.likelist({ uid: info.userId, cookie, timestamp: Date.now() })
        likedIds = ((r.body && r.body.ids) || []).map(String)
      }
      const set = new Set(likedIds)
      const liked = {}
      ids.forEach(id => { liked[id] = set.has(String(id)) })
      return { loggedIn: true, ids, liked }
    },

    '/likelist': async () => {
      const r = await api.likelist({ cookie, timestamp: Date.now() })
      return r.body
    },

    '/comment/music': async () => {
      const id = getQueryParam(url, 'id')
      const limit = Math.max(6, Math.min(50, parseInt(getQueryParam(url, 'limit', '20')) || 20))
      const offset = Math.max(0, parseInt(getQueryParam(url, 'offset', '0')) || 0)
      if (!id) {
        json(res, { error: 'Missing song id', comments: [] }, 400)
        return null
      }
      const r = await api.comment_music({ id, limit, offset, cookie, timestamp: Date.now() })
      const body = r.body || r || {}
      const raw = body.hotComments && offset === 0 ? body.hotComments : (body.comments || [])
      const comments = (raw || []).map(c => ({
        id: c.commentId,
        content: c.content || '',
        likedCount: c.likedCount || 0,
        time: c.time || 0,
        user: c.user ? { id: c.user.userId, nickname: c.user.nickname || '', avatar: c.user.avatarUrl || '' } : null,
      })).filter(c => c.content)
      return { id, total: body.total || 0, comments, hot: !!(body.hotComments && offset === 0), body }
    },

    '/artist/detail': async () => {
      const id = getQueryParam(url, 'id', '')
      const limit = Math.max(10, Math.min(80, parseInt(getQueryParam(url, 'limit', '30')) || 30))
      if (!id) {
        json(res, { error: 'Missing artist id', songs: [] }, 400)
        return null
      }
      let detailBody = {}
      try {
        const detail = await api.artist_detail({ id, cookie, timestamp: Date.now() })
        detailBody = detail.body || detail || {}
      } catch (e) {
        logger.warn('Artist detail failed:', e.message)
      }
      let rawSongs = []
      try {
        const list = await api.artist_songs({ id, order: 'hot', limit, offset: 0, cookie, timestamp: Date.now() })
        const b = list.body || list || {}
        rawSongs = (b.songs || (b.data && b.data.songs) || [])
      } catch (e) {
        logger.warn('Artist songs hot failed:', e.message)
      }
      if (!rawSongs.length && typeof api.artist_top_song === 'function') {
        try {
          const top = await api.artist_top_song({ id, cookie, timestamp: Date.now() })
          const b = top.body || top || {}
          rawSongs = b.songs || []
        } catch (e) {}
      }
      const artistData = detailBody.artist || (detailBody.data && (detailBody.data.artist || detailBody.data)) || {}
      const songs = rawSongs.map(mapSongRecord).filter(s => s.id).slice(0, limit)
      return {
        id,
        artist: {
          id: artistData.id || id,
          name: artistData.name || artistData.artistName || '',
          avatar: artistData.avatar || artistData.cover || artistData.picUrl || artistData.img1v1Url || '',
          brief: artistData.briefDesc || artistData.description || artistData.desc || '',
          musicSize: artistData.musicSize || artistData.songSize || 0,
          albumSize: artistData.albumSize || 0,
        },
        songs,
        body: detailBody,
      }
    },

    '/artist/songs': async () => {
      const id = getQueryParam(url, 'id', '')
      const r = await api.artist_songs({ id, cookie, timestamp: Date.now() })
      return r.body
    },

    '/album': async () => {
      const id = getQueryParam(url, 'id', '')
      const r = await api.album({ id, cookie, timestamp: Date.now() })
      return r.body
    },

    '/dj/recommend': async () => {
      const result = await api.dj_recommend({ cookie })
      return result.body
    },
    '/dj/recommend/type': async () => {
      const type = parseInt(getQueryParam(url, 'type', '1'))
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const result = await api.dj_recommend_type({ type, limit, cookie })
      return result.body
    },
    '/dj/catelist': async () => {
      const result = await api.dj_catelist({ cookie })
      return result.body
    },
    '/dj/category/recommend': async () => {
      const result = await api.dj_category_recommend({ cookie })
      return result.body
    },
    '/dj/program': async () => {
      const rid = getQueryParam(url, 'rid', '')
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const asc = getQueryParam(url, 'asc', 'false') === 'true'
      const result = await api.dj_program({ rid, limit, offset, asc, cookie })
      return result.body
    },
    '/dj/program/detail': async () => {
      const id = getQueryParam(url, 'id', '')
      const result = await api.dj_program_detail({ id, cookie })
      return result.body
    },
    '/dj/program/toplist': async () => {
      const type = getQueryParam(url, 'type', 'hot')
      const limit = parseInt(getQueryParam(url, 'limit', '100'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_program_toplist({ type, limit, offset, cookie })
      return result.body
    },
    '/dj/program/toplist/hours': async () => {
      const result = await api.dj_program_toplist_hours({ cookie })
      return result.body
    },
    '/dj/radio/hot': async () => {
      const cateId = parseInt(getQueryParam(url, 'cateId', '0'))
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_radio_hot({ cateId, limit, offset, cookie })
      return result.body
    },
    '/dj/sub': async () => {
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_sub({ limit, offset, cookie })
      return result.body
    },
    '/dj/sublist': async () => {
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_sublist({ limit, offset, cookie })
      return result.body
    },
    '/dj/detail': async () => {
      const rid = getQueryParam(url, 'rid', '')
      const result = await api.dj_detail({ rid, cookie })
      return result.body
    },
    '/dj/toplist': async () => {
      const type = getQueryParam(url, 'type', 'hot')
      const limit = parseInt(getQueryParam(url, 'limit', '100'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_toplist({ type, limit, offset, cookie })
      return result.body
    },
    '/dj/toplist/newcomer': async () => {
      const limit = parseInt(getQueryParam(url, 'limit', '100'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_toplist_newcomer({ limit, offset, cookie })
      return result.body
    },
    '/dj/toplist/popular': async () => {
      const limit = parseInt(getQueryParam(url, 'limit', '100'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_toplist_popular({ limit, offset, cookie })
      return result.body
    },
    '/dj/hot': async () => {
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_hot({ limit, offset, cookie })
      return result.body
    },
    '/dj/today/perfermance': async () => {
      const result = await api.dj_today_perfermance({ cookie })
      return result.body
    },
    '/dj/paygift': async () => {
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_paygift({ limit, offset, cookie })
      return result.body
    },

    '/user/account': async () => {
      const r = await api.user_account({ cookie, timestamp: Date.now() })
      return r.body
    },

    '/user/detail': async () => {
      const uid = getQueryParam(url, 'uid', '')
      const r = await api.user_detail({ uid, cookie, timestamp: Date.now() })
      return r.body
    },

    '/banner': async () => {
      const type = getQueryParam(url, 'type', '0')
      const r = await api.banner({ type, timestamp: Date.now() })
      return r.body
    },

    '/top/playlist': async () => {
      const cat = getQueryParam(url, 'cat', '')
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const r = await api.top_playlist({ cat, limit, offset, timestamp: Date.now() })
      return r.body
    },

    '/playlist/hot': async () => {
      const r = await api.playlist_hot({ timestamp: Date.now() })
      return r.body
    },

    '/playlist/catlist': async () => {
      const r = await api.playlist_catlist({ timestamp: Date.now() })
      return r.body
    },
  }

  const handler = routeHandlers[path]
  if (handler) {
    try {
      const data = await handler()
      if (data !== null) {
        json(res, data)
      }
    } catch (err) {
      const apiCode = err.status || (err.body && err.body.code) || 500
      const apiMsg = err.message || (err.body && err.body.msg) || 'API Error'
      logger.error('Netease API error:', apiCode, apiMsg)
      json(res, { error: apiMsg, code: apiCode }, apiCode >= 100 && apiCode < 600 ? apiCode : 500)
    }
    return true
  }

  return false
}
