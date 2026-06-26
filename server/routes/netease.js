import NeteaseCloudMusicApi from 'NeteaseCloudMusicApi'
import { json, getQueryParam, getCookies } from '../utils/http.js'

const api = NeteaseCloudMusicApi

export async function handleNeteaseRoute(req, res, url) {
  const path = url.pathname.replace('/api/netease', '')
  const cookie = getCookies(req)

  const routeHandlers = {
    '/login/status': async () => {
      const result = await api.login_status({ cookie })
      return result.body
    },
    '/login/refresh': async () => {
      const result = await api.login_refresh({ cookie })
      return result.body
    },
    '/logout': async () => {
      const result = await api.logout({ cookie })
      return result.body
    },
    '/search': async () => {
      const keywords = getQueryParam(url, 'keywords', '')
      const type = parseInt(getQueryParam(url, 'type', '1'))
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.search({ keywords, type, limit, offset, cookie })
      return result.body
    },
    '/song/detail': async () => {
      const ids = getQueryParam(url, 'ids', '')
      const result = await api.song_detail({ ids, cookie })
      return result.body
    },
    '/song/url': async () => {
      const id = getQueryParam(url, 'id', '')
      const level = getQueryParam(url, 'level', 'exhigh')
      const result = await api.song_url_v1({ id, level, cookie })
      return result.body
    },
    '/lyric': async () => {
      const id = getQueryParam(url, 'id', '')
      const result = await api.lyric({ id, cookie })
      return result.body
    },
    '/playlist/detail': async () => {
      const id = getQueryParam(url, 'id', '')
      const result = await api.playlist_detail({ id, cookie })
      return result.body
    },
    '/playlist/track/all': async () => {
      const id = getQueryParam(url, 'id', '')
      const limit = parseInt(getQueryParam(url, 'limit', '100'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.playlist_track_all({ id, limit, offset, cookie })
      return result.body
    },
    '/user/playlist': async () => {
      const uid = getQueryParam(url, 'uid', '')
      const result = await api.user_playlist({ uid, cookie })
      return result.body
    },
    '/recommend/songs': async () => {
      const result = await api.recommend_songs({ cookie })
      return result.body
    },
    '/recommend/resource': async () => {
      const result = await api.recommend_resource({ cookie })
      return result.body
    },
    '/artist/detail': async () => {
      const id = getQueryParam(url, 'id', '')
      const result = await api.artist_detail({ id, cookie })
      return result.body
    },
    '/artist/songs': async () => {
      const id = getQueryParam(url, 'id', '')
      const result = await api.artist_songs({ id, cookie })
      return result.body
    },
    '/album': async () => {
      const id = getQueryParam(url, 'id', '')
      const result = await api.album({ id, cookie })
      return result.body
    },
    '/like': async () => {
      const id = getQueryParam(url, 'id', '')
      const like = getQueryParam(url, 'like', 'true') === 'true'
      const result = await api.like({ id, like, cookie })
      if (res && result.cookie) {
        res.setHeader('Set-Cookie', result.cookie)
      }
      return result.body
    },
    '/song/like/check': async () => {
      const id = getQueryParam(url, 'id', '')
      const result = await api.likelist({ cookie })
      const ids = result.body?.ids || []
      return { status: ids.includes(parseInt(id)) }
    },
    '/likelist': async () => {
      const result = await api.likelist({ cookie })
      return result.body
    },
    '/dj/recommend': async () => {
      const result = await api.dj_recommend({ cookie })
      return result.body
    },
    '/dj/program': async () => {
      const rid = getQueryParam(url, 'rid', '')
      const limit = parseInt(getQueryParam(url, 'limit', '30'))
      const offset = parseInt(getQueryParam(url, 'offset', '0'))
      const result = await api.dj_program({ rid, limit, offset, cookie })
      return result.body
    },
    '/dj/program/detail': async () => {
      const id = getQueryParam(url, 'id', '')
      const result = await api.dj_program_detail({ id, cookie })
      return result.body
    },
    '/dj/sub': async () => {
      const result = await api.dj_sub({ cookie })
      return result.body
    },
  }

  const handler = routeHandlers[path]
  if (handler) {
    try {
      const data = await handler()
      json(res, data)
    } catch (err) {
      console.error('Netease API error:', err)
      json(res, { error: err.message || 'API Error', code: 500 }, 500)
    }
    return true
  }

  return false
}
