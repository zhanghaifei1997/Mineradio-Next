import { app, net } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const UpdateState = {
  IDLE: 'idle',
  CHECKING: 'checking',
  CHECKED: 'checked',
  DOWNLOADING: 'downloading',
  EXTRACTING: 'extracting',
  VERIFYING: 'verifying',
  READY: 'ready',
  ERROR: 'error',
}

class Updater extends EventEmitter {
  constructor() {
    super()
    this.state = UpdateState.IDLE
    this.currentVersion = app.getVersion()
    this.latestVersion = null
    this.releaseInfo = null
    this.updateAvailable = false
    this.downloadProgress = 0
    this.extractProgress = 0
    this.error = null
    this.cancelRequested = false
    this.abortController = null
    this.config = this.loadConfig()
    this.tempDir = path.join(app.getPath('temp'), 'mineradio-updates')
    this.pendingUpdatePath = null
  }

  loadConfig() {
    try {
      const pkgPath = path.join(__dirname, '..', 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      return pkg.mineradio?.update || {}
    } catch (e) {
      console.warn('Failed to load update config:', e.message)
      return {}
    }
  }

  getState() {
    return {
      state: this.state,
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion,
      updateAvailable: this.updateAvailable,
      downloadProgress: this.downloadProgress,
      extractProgress: this.extractProgress,
      error: this.error,
      releaseInfo: this.releaseInfo,
    }
  }

  setState(state) {
    this.state = state
    this.emit('state-changed', this.getState())
  }

  async checkForUpdates() {
    if (this.state === UpdateState.CHECKING || this.state === UpdateState.DOWNLOADING) {
      return this.getState()
    }

    this.setState(UpdateState.CHECKING)
    this.error = null
    this.updateAvailable = false

    try {
      const release = await this.fetchLatestRelease()
      if (!release) {
        this.setState(UpdateState.IDLE)
        return this.getState()
      }

      this.latestVersion = release.tag_name.replace(/^v/, '')
      this.releaseInfo = {
        version: this.latestVersion,
        name: release.name,
        notes: release.body || '',
        publishedAt: release.published_at,
        isPrerelease: release.prerelease,
        assets: release.assets || [],
      }

      this.updateAvailable = this.compareVersions(this.latestVersion, this.currentVersion) > 0
      this.setState(UpdateState.CHECKED)

      return this.getState()
    } catch (e) {
      this.error = e.message
      this.setState(UpdateState.ERROR)
      return this.getState()
    }
  }

  async fetchLatestRelease() {
    const { provider = 'github', owner, repo, preview = false } = this.config

    if (provider !== 'github' || !owner || !repo) {
      throw new Error('Invalid update provider configuration')
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`

    try {
      const releases = await this.fetchJson(apiUrl)
      if (!Array.isArray(releases) || releases.length === 0) {
        return null
      }

      if (preview) {
        return releases[0]
      }

      const stableRelease = releases.find((r) => !r.prerelease && !r.draft)
      return stableRelease || releases[0]
    } catch (e) {
      throw new Error(`Failed to fetch releases: ${e.message}`)
    }
  }

  async fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
      const request = net.request({
        url,
        method: 'GET',
        headers: {
          'User-Agent': 'Mineradio-Updater',
          Accept: 'application/json',
          ...options.headers,
        },
      })

      request.on('response', (response) => {
        let data = ''
        response.on('data', (chunk) => {
          data += chunk.toString()
        })
        response.on('end', () => {
          try {
            if (response.statusCode >= 200 && response.statusCode < 300) {
              resolve(JSON.parse(data))
            } else {
              reject(new Error(`HTTP ${response.statusCode}: ${data}`))
            }
          } catch (e) {
            reject(e)
          }
        })
      })

      request.on('error', reject)
      request.end()
    })
  }

  async downloadUpdate() {
    if (this.state !== UpdateState.CHECKED || !this.updateAvailable) {
      return { ok: false, error: 'No update available or not in correct state' }
    }

    this.cancelRequested = false
    this.downloadProgress = 0
    this.extractProgress = 0
    this.setState(UpdateState.DOWNLOADING)

    try {
      await fsp.mkdir(this.tempDir, { recursive: true })

      const patchAsset = this.findPatchAsset()
      if (patchAsset) {
        await this.downloadAndApplyPatch(patchAsset)
      } else {
        const fullAsset = this.findFullPackageAsset()
        if (!fullAsset) {
          throw new Error('No suitable update package found')
        }
        await this.downloadFullPackage(fullAsset)
      }

      this.setState(UpdateState.READY)
      return { ok: true }
    } catch (e) {
      if (this.cancelRequested) {
        this.setState(UpdateState.CHECKED)
        return { ok: false, cancelled: true }
      }
      this.error = e.message
      this.setState(UpdateState.ERROR)
      return { ok: false, error: e.message }
    }
  }

  findPatchAsset() {
    const assets = this.releaseInfo?.assets || []
    const platform = process.platform
    const arch = process.arch

    const patchNames = [
      `patch-${platform}-${arch}.json`,
      `patch-${platform}.json`,
      'patch.json',
    ]

    for (const name of patchNames) {
      const asset = assets.find((a) => a.name === name)
      if (asset) return asset
    }

    return null
  }

  findFullPackageAsset() {
    const assets = this.releaseInfo?.assets || []
    const platform = process.platform

    const patterns = {
      win32: [/\.exe$/i, /Setup.*\.exe$/i],
      darwin: [/\.dmg$/i],
      linux: [/\.AppImage$/i],
    }

    const platformPatterns = patterns[platform] || []
    for (const pattern of platformPatterns) {
      const asset = assets.find((a) => pattern.test(a.name))
      if (asset) return asset
    }

    return null
  }

  async downloadAndApplyPatch(patchAsset) {
    const patchUrl = this.resolveDownloadUrl(patchAsset.browser_download_url)
    const patchJson = await this.fetchJson(patchUrl)

    if (!patchJson.files || !Array.isArray(patchJson.files)) {
      throw new Error('Invalid patch format: missing files array')
    }

    const appDir = this.getAppDir()
    const backupDir = path.join(this.tempDir, `backup-${this.currentVersion}`)

    await fsp.mkdir(backupDir, { recursive: true })

    const totalFiles = patchJson.files.length
    let downloaded = 0

    for (const fileInfo of patchJson.files) {
      if (this.cancelRequested) throw new Error('Cancelled')

      const relativePath = fileInfo.path
      const fileUrl = this.resolveDownloadUrl(this.buildFileUrl(patchAsset, relativePath))
      const targetPath = path.join(appDir, relativePath)
      const backupPath = path.join(backupDir, relativePath)

      await fsp.mkdir(path.dirname(targetPath), { recursive: true })

      if (fs.existsSync(targetPath)) {
        await fsp.mkdir(path.dirname(backupPath), { recursive: true })
        await fsp.rename(targetPath, backupPath)
      }

      await this.downloadFile(fileUrl, targetPath, fileInfo.hash)

      downloaded++
      this.downloadProgress = Math.round((downloaded / totalFiles) * 100)
      this.emit('state-changed', this.getState())
    }

    this.pendingUpdatePath = { appDir, backupDir }
  }

  buildFileUrl(patchAsset, relativePath) {
    const baseUrl = patchAsset.browser_download_url.replace(/\/[^/]+$/, '')
    return `${baseUrl}/${relativePath}`
  }

  async downloadFullPackage(asset) {
    const downloadUrl = this.resolveDownloadUrl(asset.browser_download_url)
    const targetPath = path.join(this.tempDir, asset.name)

    await this.downloadFileWithProgress(downloadUrl, targetPath, asset.size)

    this.pendingUpdatePath = targetPath
  }

  resolveDownloadUrl(originalUrl) {
    const { preferMirrors, mirrors = [] } = this.config

    if (!preferMirrors || !mirrors || mirrors.length === 0) {
      return originalUrl
    }

    const githubPattern = /^https:\/\/github\.com\/(.+\/releases\/.+)$/i
    const match = originalUrl.match(githubPattern)

    if (!match) return originalUrl

    const releasePath = match[1]
    const mirror = mirrors[0]

    try {
      return new URL(releasePath, mirror).toString()
    } catch {
      return originalUrl
    }
  }

  async downloadFile(url, targetPath, expectedHash = null) {
    return new Promise((resolve, reject) => {
      const tempPath = targetPath + '.tmp'
      const hash = expectedHash ? crypto.createHash('sha256') : null

      const request = net.request(url)

      request.on('response', (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }

        const fileStream = fs.createWriteStream(tempPath)

        response.on('data', (chunk) => {
          fileStream.write(chunk)
          if (hash) hash.update(chunk)
        })

        response.on('end', async () => {
          fileStream.end()

          await new Promise((res) => fileStream.on('finish', res))

          if (hash) {
            const fileHash = hash.digest('hex')
            if (expectedHash && fileHash !== expectedHash) {
              await fsp.unlink(tempPath).catch(() => {})
              reject(new Error('Hash mismatch'))
              return
            }
          }

          await fsp.rename(tempPath, targetPath)
          resolve()
        })

        response.on('error', async (e) => {
          fileStream.end()
          await fsp.unlink(tempPath).catch(() => {})
          reject(e)
        })
      })

      request.on('error', reject)
      request.end()
    })
  }

  async downloadFileWithProgress(url, targetPath, totalSize) {
    return new Promise((resolve, reject) => {
      const tempPath = targetPath + '.tmp'
      let downloaded = 0

      const request = net.request(url)

      request.on('response', (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }

        const contentLength = parseInt(response.headers['content-length'] || String(totalSize || 0), 10)
        const total = contentLength || totalSize || 1

        const fileStream = fs.createWriteStream(tempPath)

        response.on('data', (chunk) => {
          fileStream.write(chunk)
          downloaded += chunk.length
          this.downloadProgress = Math.min(100, Math.round((downloaded / total) * 100))
          this.emit('state-changed', this.getState())
        })

        response.on('end', async () => {
          fileStream.end()
          await new Promise((res) => fileStream.on('finish', res))
          await fsp.rename(tempPath, targetPath)
          resolve()
        })

        response.on('error', async (e) => {
          fileStream.end()
          await fsp.unlink(tempPath).catch(() => {})
          reject(e)
        })
      })

      request.on('error', reject)
      request.end()
    })
  }

  getAppDir() {
    const isDev = process.env.NODE_ENV === 'development'
    if (isDev) {
      return path.join(__dirname, '..')
    }

    if (process.platform === 'darwin') {
      return path.join(process.resourcesPath, '..')
    }
    return path.dirname(process.execPath)
  }

  async installUpdate() {
    if (this.state !== UpdateState.READY || !this.pendingUpdatePath) {
      return { ok: false, error: 'No update ready to install' }
    }

    try {
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 500)

      return { ok: true }
    } catch (e) {
      this.error = e.message
      this.setState(UpdateState.ERROR)
      return { ok: false, error: e.message }
    }
  }

  cancelUpdate() {
    if (this.state === UpdateState.DOWNLOADING) {
      this.cancelRequested = true
      return true
    }
    return false
  }

  compareVersions(a, b) {
    const partsA = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
    const partsB = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)

    const maxLen = Math.max(partsA.length, partsB.length)
    for (let i = 0; i < maxLen; i++) {
      const diff = (partsA[i] || 0) - (partsB[i] || 0)
      if (diff !== 0) return diff > 0 ? 1 : -1
    }
    return 0
  }

  async rollbackUpdate() {
    if (!this.pendingUpdatePath || !this.pendingUpdatePath.backupDir) {
      return { ok: false, error: 'No backup available' }
    }

    try {
      const { appDir, backupDir } = this.pendingUpdatePath

      if (fs.existsSync(backupDir)) {
        await this.copyDir(backupDir, appDir)
      }

      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async copyDir(src, dest) {
    await fsp.mkdir(dest, { recursive: true })
    const entries = await fsp.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath)
      } else {
        await fsp.copyFile(srcPath, destPath)
      }
    }
  }
}

const updater = new Updater()

export { updater, UpdateState }
export default updater
