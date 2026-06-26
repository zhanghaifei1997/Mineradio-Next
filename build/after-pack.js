import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

function findNewestRceditInCache(cacheRoot) {
  if (!cacheRoot || !existsSync(cacheRoot)) return null
  let newest = null
  const stack = [cacheRoot]
  while (stack.length) {
    const dir = stack.pop()
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch (e) { continue }
    entries.forEach(function (entry) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        return
      }
      if (entry.isFile() && entry.name.toLowerCase() === 'rcedit-x64.exe') {
        const stat = statSync(fullPath)
        if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { path: fullPath, mtimeMs: stat.mtimeMs }
      }
    })
  }
  return newest && newest.path
}

function resolveRcedit(projectDir) {
  const candidates = [
    join(projectDir, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe')
  ]
  const localAppData = process.env.LOCALAPPDATA
  if (localAppData) {
    const cached = findNewestRceditInCache(join(localAppData, 'electron-builder', 'Cache', 'winCodeSign'))
    if (cached) candidates.push(cached)
  }
  candidates.push(join(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe'))
  const hit = candidates.find(function (candidate) { return candidate && existsSync(candidate) })
  if (!hit) throw new Error('No usable rcedit executable was found for Mineradio icon injection.')
  return hit
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const appName = context.packager.appInfo.productFilename || 'Mineradio'
  const exePath = join(context.appOutDir, `${appName}.exe`)
  const iconPath = join(context.packager.info.buildResourcesDir, 'icon.ico')
  const rceditPath = resolveRcedit(context.packager.projectDir)

  if (!existsSync(exePath)) throw new Error(`Mineradio executable was not found: ${exePath}`)
  if (!existsSync(iconPath)) throw new Error(`Mineradio icon was not found: ${iconPath}`)

  const version = context.packager.appInfo.version
  console.log(`  • injecting Mineradio resources  rcedit=${rceditPath}`)
  execFileSync(rceditPath, [
    exePath,
    '--set-icon', iconPath,
    '--set-version-string', 'FileDescription', 'Mineradio',
    '--set-version-string', 'ProductName', 'Mineradio',
    '--set-version-string', 'CompanyName', 'Mineradio',
    '--set-version-string', 'OriginalFilename', `${appName}.exe`,
    '--set-file-version', version,
    '--set-product-version', version
  ], { stdio: 'inherit' })
}
