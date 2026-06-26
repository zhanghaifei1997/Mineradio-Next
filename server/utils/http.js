import { URL } from 'node:url'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

export function json(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(data))
}

export function getQueryParam(url, name, defaultValue = '') {
  return url.searchParams.get(name) ?? defaultValue
}

export function getCookies(req) {
  const cookieHeader = req.headers.cookie || ''
  return cookieHeader
}

export function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
      if (body.length > 1e6) {
        reject(new Error('Body too large'))
        req.connection.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/truetype',
  '.eot': 'application/vnd.ms-fontobject',
}

export async function serveStatic(req, res, url) {
  if (req.method !== 'GET') return false

  let filePath = url.pathname
  if (filePath === '/') filePath = '/index.html'

  const publicDir = join(process.cwd(), 'dist')
  const fullPath = join(publicDir, filePath)

  if (!existsSync(fullPath)) return false
  if (!statSync(fullPath).isFile()) return false

  const ext = extname(fullPath).toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

  res.writeHead(200, { 'Content-Type': mimeType })
  createReadStream(fullPath).pipe(res)
  return true
}
