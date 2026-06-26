import http from 'node:http'
import { URL } from 'node:url'
import { handleNeteaseRoute} from './routes/netease.js'
import { handleQQMusicRoute } from './routes/qqmusic.js'
import { handleUpdateRoute } from './routes/update.js'
import { handleAuth } from './middleware/auth.js'
import { json, serveStatic } from './utils/http.js'
import { logger } from './utils/logger.js'

const PORT = parseInt(process.env.PORT || '27232')

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

    if (path === '/api/health') {
      json(res, { status: 'ok', version: '2.0.0' })
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

server.listen(PORT, '127.0.0.1', () => {
  logger.info(`Mineradio server running on http://127.0.0.1:${PORT}`)
})

export { server }
