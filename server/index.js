import http from 'node:http'
import { URL } from 'node:url'
import { handleNeteaseRoute } from './routes/netease.js'
import { handleQQMusicRoute } from './routes/qqmusic.js'
import { handleUpdateRoute } from './routes/update.js'
import { handleProxyRoute } from './routes/proxy.js'
import { handleLocalRoute, setLocalMusicDir } from './routes/local.js'
import { handleAuth } from './middleware/auth.js'
import { json, serveStatic } from './utils/http.js'
import { logger } from './utils/logger.js'
import { loadCookies, setCookieDir } from './utils/cookie.js'

const PORT = parseInt(process.env.PORT || '27232')
const HOST = process.env.HOST || '127.0.0.1'

let serverInstance = null

function createServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const path = url.pathname

      logger.info(`${req.method} ${path}`)

      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      if (handleAuth(req, res, url) === false) {
        return
      }

      if (path.startsWith('/api/netease')) {
        const handled = await handleNeteaseRoute(req, res, url)
        if (handled) return
      }

      if (path.startsWith('/api/qq')) {
        const handled = await handleQQMusicRoute(req, res, url)
        if (handled) return
      }

      if (path.startsWith('/api/update')) {
        const handled = await handleUpdateRoute(req, res, url)
        if (handled) return
      }

      if (path.startsWith('/api/proxy') || path === '/api/cover' || path === '/api/audio') {
        const handled = await handleProxyRoute(req, res, url)
        if (handled) return
      }

      if (path.startsWith('/api/local')) {
        const handled = await handleLocalRoute(req, res, url)
        if (handled) return
      }

      if (path === '/api/health') {
        json(res, { status: 'ok', version: '2.0.0' })
        return
      }

      if (path === '/api/config') {
        json(res, {
          port: PORT,
          host: HOST,
          cookieDir: process.env.COOKIE_DIR || '',
          localMusicDir: process.env.LOCAL_MUSIC_DIR || '',
        })
        return
      }

      if (await serveStatic(req, res, url)) {
        return
      }

      json(res, { error: 'Not Found' }, 404)
    } catch (err) {
      logger.error('Server error:', err)
      json(res, { error: 'Internal Server Error' }, 500)
    }
  })

  return server
}

export function startServer(options = {}) {
  if (options.cookieDir) {
    setCookieDir(options.cookieDir)
  }
  if (options.localMusicDir) {
    setLocalMusicDir(options.localMusicDir)
  }
  
  loadCookies()

  serverInstance = createServer()
  serverInstance.listen(PORT, HOST, () => {
    logger.info(`Mineradio server running on http://${HOST}:${PORT}`)
  })

  return serverInstance
}

export function stopServer() {
  if (serverInstance) {
    serverInstance.close()
    serverInstance = null
    logger.info('Mineradio server stopped')
  }
}

export function getServer() {
  return serverInstance
}

if (process.env.NODE_ENV === 'development' || process.argv[1]?.includes('server/index.js')) {
  startServer()
}

export { serverInstance as server }
