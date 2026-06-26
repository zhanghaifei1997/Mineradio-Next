import { json } from '../utils/http.js'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import pkg from '../package.json' assert { type: 'json' }

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
