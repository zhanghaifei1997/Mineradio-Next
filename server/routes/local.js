import { existsSync, statSync, createReadStream, readdirSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { json } from '../utils/http.js'
import { logger } from '../utils/logger.js'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.wma', '.opus'])

const MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.wma': 'audio/x-ms-wma',
  '.opus': 'audio/opus',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

let localMusicDir = null

export function setLocalMusicDir(dir) {
  localMusicDir = dir
}

export function getLocalMusicDir() {
  return localMusicDir
}

function isPathSafe(baseDir, targetPath) {
  const normalizedBase = baseDir.replace(/\\/g, '/')
  const normalizedTarget = targetPath.replace(/\\/g, '/')
  return normalizedTarget.startsWith(normalizedBase.endsWith('/') ? normalizedBase : normalizedBase + '/')
}

export async function handleLocalRoute(req, res, url) {
  const path = url.pathname

  if (path === '/api/local/list') {
    if (!localMusicDir) {
      json(res, { error: 'Local music directory not set', files: [] }, 400)
      return true
    }
    try {
      const files = []
      function scanDir(dir, relativePath = '') {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            try {
              scanDir(fullPath, relPath)
            } catch (e) {
              logger.warn('Scan dir failed:', fullPath, e.message)
            }
          } else if (entry.isFile()) {
            const ext = extname(entry.name).toLowerCase()
            if (AUDIO_EXTENSIONS.has(ext)) {
              try {
                const stat = statSync(fullPath)
                files.push({
                  name: entry.name,
                  path: relPath,
                  size: stat.size,
                  duration: 0,
                  extension: ext.slice(1),
                })
              } catch (e) {}
            }
          }
        }
      }
      scanDir(localMusicDir)
      json(res, { files, dir: localMusicDir, count: files.length })
    } catch (err) {
      logger.error('Local list error:', err)
      json(res, { error: err.message, files: [] }, 500)
    }
    return true
  }

  if (path === '/api/local/file') {
    if (!localMusicDir) {
      res.writeHead(400)
      res.end('Local music directory not set')
      return true
    }
    const filePath = url.searchParams.get('path')
    if (!filePath) {
      res.writeHead(400)
      res.end('Missing file path')
      return true
    }
    try {
      const fullPath = join(localMusicDir, filePath)
      if (!isPathSafe(localMusicDir, fullPath)) {
        res.writeHead(403)
        res.end('Invalid path')
        return true
      }
      if (!existsSync(fullPath)) {
        res.writeHead(404)
        res.end('File not found')
        return true
      }
      const stat = statSync(fullPath)
      if (!stat.isFile()) {
        res.writeHead(400)
        res.end('Not a file')
        return true
      }
      const mimeType = getMimeType(fullPath)
      const range = req.headers.range
      const fileSize = stat.size

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunkSize = (end - start) + 1
        const file = createReadStream(fullPath, { start, end })
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
        })
        file.pipe(res)
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        })
        createReadStream(fullPath).pipe(res)
      }
    } catch (err) {
      logger.error('Local file error:', err)
      res.writeHead(500)
      res.end()
    }
    return true
  }

  if (path === '/api/local/dir') {
    json(res, { dir: localMusicDir || null })
    return true
  }

  return false
}
