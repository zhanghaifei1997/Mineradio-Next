import { logger } from '../utils/logger.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function audioContentTypeForUrl(url, fallback) {
  if (fallback && fallback !== 'application/octet-stream') return fallback
  if (/\.mp3/i.test(url)) return 'audio/mpeg'
  if (/\.flac/i.test(url)) return 'audio/flac'
  if (/\.wav/i.test(url)) return 'audio/wav'
  if (/\.m4a/i.test(url)) return 'audio/mp4'
  if (/\.aac/i.test(url)) return 'audio/aac'
  if (/\.ogg/i.test(url)) return 'audio/ogg'
  return 'audio/mpeg'
}

function audioProxyHeadersFor(audioUrl, range) {
  const headers = {
    'User-Agent': UA,
    'Referer': 'https://music.163.com/',
  }
  if (range) {
    headers['Range'] = range
  }
  return headers
}

export async function handleProxyRoute(req, res, url) {
  const path = url.pathname

  if (path === '/api/cover' || path === '/api/proxy/cover') {
    const coverUrl = url.searchParams.get('url')
    if (!coverUrl || !/^https?:\/\//i.test(coverUrl)) {
      res.writeHead(400, { 'Access-Control-Allow-Origin': '*' })
      res.end('Invalid cover url')
      return true
    }
    try {
      const resp = await fetch(coverUrl, {
        headers: {
          'User-Agent': UA,
          'Referer': 'https://music.163.com/',
        },
      })
      const ct = resp.headers.get('content-type') || 'image/jpeg'
      const cl = resp.headers.get('content-length')
      const hdr = {
        'Content-Type': ct,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'public, max-age=86400',
      }
      if (cl) hdr['Content-Length'] = cl
      res.writeHead(resp.status, hdr)
      const reader = resp.body.getReader()
      while (true) {
        const c = await reader.read()
        if (c.done) break
        res.write(c.value)
      }
      res.end()
    } catch (err) {
      logger.error('Cover proxy error:', err)
      res.writeHead(500)
      res.end()
    }
    return true
  }

  if (path === '/api/audio' || path === '/api/proxy/audio') {
    const audioUrl = url.searchParams.get('url')
    if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) {
      res.writeHead(400)
      res.end('Missing or invalid url')
      return true
    }
    try {
      const range = req.headers.range || ''
      const hdr = audioProxyHeadersFor(audioUrl, range)
      const up = await fetch(audioUrl, { headers: hdr })
      const out = {
        'Content-Type': audioContentTypeForUrl(audioUrl, up.headers.get('content-type')),
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
      }
      const cl = up.headers.get('content-length')
      if (cl) out['Content-Length'] = cl
      const cr = up.headers.get('content-range')
      if (cr) out['Content-Range'] = cr
      res.writeHead(up.status, out)
      const reader = up.body.getReader()
      while (true) {
        const c = await reader.read()
        if (c.done) break
        res.write(c.value)
      }
      res.end()
    } catch (err) {
      logger.error('Audio proxy error:', err)
      res.writeHead(500)
      res.end()
    }
    return true
  }

  return false
}
