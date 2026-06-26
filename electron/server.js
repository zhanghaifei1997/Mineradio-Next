import { fork } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let serverProcess = null

export function startServer() {
  if (serverProcess) return serverProcess

  const serverPath = path.join(__dirname, '../server/index.js')
  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: '27232',
    },
    stdio: 'pipe',
  })

  serverProcess.stdout?.on('data', (data) => {
    console.log('[Server]', data.toString().trim())
  })

  serverProcess.stderr?.on('data', (data) => {
    console.error('[Server Error]', data.toString().trim())
  })

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`)
    serverProcess = null
  })

  return serverProcess
}

export function stopServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

export { serverProcess }
