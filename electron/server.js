import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let serverModule = null

export async function startServer(options = {}) {
  if (serverModule) return serverModule

  process.env.PORT = options.port || '27232'
  process.env.HOST = options.host || '127.0.0.1'
  if (options.cookieDir) {
    process.env.COOKIE_DIR = options.cookieDir
  }
  if (options.localMusicDir) {
    process.env.LOCAL_MUSIC_DIR = options.localMusicDir
  }

  const serverPath = path.join(__dirname, '..', 'server', 'index.js')
  const moduleUrl = pathToFileURL(serverPath).href
  
  const mod = await import(moduleUrl)
  serverModule = mod.startServer ? mod.startServer(options) : mod.server

  return serverModule
}

export function stopServer() {
  if (serverModule && serverModule.close) {
    serverModule.close()
    serverModule = null
  }
}

export { serverModule as server }
