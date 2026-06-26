import { json } from '../utils/http.js'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const pkgPath = join(__dirname, '..', '..', 'package.json')
let pkg = { version: '0.0.0' }
try {
  if (existsSync(pkgPath)) {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  }
} catch (e) {
  console.warn('Failed to read package.json:', e.message)
}

const UPDATE_SERVER = 'https://api.mineradio.example.com/update'

export async function handleUpdateRoute(req, res, url) {
  const path = url.pathname.replace('/api/update', '')

  if (path === '/check') {
    try {
      const result = await checkUpdate()
      json(res, result)
    } catch (err) {
      json(res, { hasUpdate: false, error: err.message })
    }
    return true
  }

  if (path === '/version') {
    json(res, {
      version: pkg.version,
      platform: process.platform,
      arch: process.arch,
    })
    return true
  }

  return false
}

async function checkUpdate() {
  try {
    const res = await fetch(`${UPDATE_SERVER}/check?platform=${process.platform}&arch=${process.arch}&version=${pkg.version}`)
    if (!res.ok) throw new Error('Update server error')
    return await res.json()
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion: pkg.version,
      message: 'Update check unavailable',
    }
  }
}
