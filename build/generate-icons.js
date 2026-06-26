import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const buildDir = path.join(__dirname, '..', 'build')

function crc32(buf) {
  let crc = -1
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ -1) >>> 0
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crcData = Buffer.concat([typeBuffer, data])
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc32(crcData), 0)
  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

function generatePng(size, r, g, b) {
  const width = size
  const height = size

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rawData = []
  const centerX = width / 2
  const centerY = height / 2
  const radius = width * 0.4

  for (let y = 0; y < height; y++) {
    rawData.push(0)
    for (let x = 0; x < width; x++) {
      const dx = x - centerX
      const dy = y - centerY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= radius) {
        const alpha = 255
        rawData.push(r, g, b, alpha)
      } else if (dist <= radius + 2) {
        const alpha = Math.round(255 * (radius + 2 - dist) / 2)
        rawData.push(r, g, b, alpha)
      } else {
        rawData.push(0, 0, 0, 0)
      }
    }
  }

  const rawBuffer = Buffer.from(rawData)
  const compressed = zlib.deflateSync(rawBuffer)

  const ihdrChunk = createPngChunk('IHDR', ihdr)
  const idatChunk = createPngChunk('IDAT', compressed)
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

function generateIco(sizes) {
  const iconDatas = sizes.map((size) => generatePng(size, 217, 91, 103))

  const headerSize = 6
  const entrySize = 16
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)

  let dataOffset = headerSize + entrySize * sizes.length
  const entries = []

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]
    const data = iconDatas[i]
    const entry = Buffer.alloc(entrySize)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(dataOffset, 12)
    entries.push(entry)
    dataOffset += data.length
  }

  return Buffer.concat([header, ...entries, ...iconDatas])
}

async function generateIcons() {
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true })
  }

  console.log('Generating icon.png (512x512)...')
  const png512 = generatePng(512, 217, 91, 103)
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png512)

  console.log('Generating icon.ico (multi-size)...')
  const ico = generateIco([16, 32, 48, 64, 128, 256])
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico)

  console.log('Generating installer header bitmap...')
  const headerBmp = generateSimpleBmp(150, 57, 15, 15, 20)
  fs.writeFileSync(path.join(buildDir, 'installerHeader.bmp'), headerBmp)

  console.log('Generating installer sidebar bitmap...')
  const sidebarBmp = generateSimpleBmp(164, 314, 15, 15, 20)
  fs.writeFileSync(path.join(buildDir, 'installerSidebar.bmp'), sidebarBmp)

  console.log('Icons generated successfully!')
}

function generateSimpleBmp(width, height, r, g, b) {
  const pixelDataSize = width * height * 3
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const paddedSize = rowSize * height

  const fileSize = 54 + paddedSize
  const buffer = Buffer.alloc(fileSize)

  buffer.write('BM', 0)
  buffer.writeUInt32LE(fileSize, 2)
  buffer.writeUInt16LE(0, 6)
  buffer.writeUInt16LE(0, 8)
  buffer.writeUInt32LE(54, 10)

  buffer.writeUInt32LE(40, 14)
  buffer.writeInt32LE(width, 18)
  buffer.writeInt32LE(height, 22)
  buffer.writeUInt16LE(1, 26)
  buffer.writeUInt16LE(24, 28)
  buffer.writeUInt32LE(0, 30)
  buffer.writeUInt32LE(paddedSize, 34)
  buffer.writeInt32LE(2835, 38)
  buffer.writeInt32LE(2835, 42)
  buffer.writeUInt32LE(0, 46)
  buffer.writeUInt32LE(0, 50)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = 54 + y * rowSize + x * 3
      buffer[offset] = b
      buffer[offset + 1] = g
      buffer[offset + 2] = r
    }
  }

  return buffer
}

generateIcons().catch(console.error)
