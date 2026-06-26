import { setTimeout as delay } from 'node:timers/promises'

const url = process.argv[2] || 'http://127.0.0.1:5173'
const timeout = parseInt(process.argv[3] || '60000', 10)
const interval = 500
const start = Date.now()

async function waitForServer() {
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        console.log(`Server ready at ${url}`)
        process.exit(0)
      }
    } catch {}
    await delay(interval)
  }
  console.error(`Timeout: server not reachable at ${url} after ${timeout}ms`)
  process.exit(1)
}

waitForServer()
