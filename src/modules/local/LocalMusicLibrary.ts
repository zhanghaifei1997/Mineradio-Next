import type { LocalSong, ScanProgress, ScanStatus, LibraryStats } from './types'
import type { Song, Artist, Album, LocalScanResult } from '@/types'

const STORAGE_KEY = 'mineradio_local_library'
const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.opus']

declare global {
  interface Window {
    electronAPI?: {
      isDesktop?: boolean
      localMusic?: {
        scanDirectory: (dirPath: string) => Promise<any>
        readMetadata: (filePath: string) => Promise<any>
        selectDirectory: () => Promise<any>
        getFileUrl: (filePath: string) => Promise<string>
        getConfig: () => Promise<any>
        saveConfig: (config: any) => Promise<void>
      }
      [key: string]: any
    }
  }
}

export class LocalMusicLibrary {
  private songs: Map<string, LocalSong> = new Map()
  private scanStatus: ScanStatus = 'idle'
  private scanProgress: ScanProgress = { current: 0, total: 0, currentFile: '' }
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn())
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data) as LocalSong[]
        parsed.forEach((song) => this.songs.set(song.id, song))
      }
    } catch (e) {
      console.error('Failed to load local library:', e)
    }
  }

  private saveToStorage(): void {
    try {
      const songs = Array.from(this.songs.values())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songs))
    } catch (e) {
      console.error('Failed to save local library:', e)
    }
  }

  isAvailable(): boolean {
    return !!(window.electronAPI?.isDesktop && window.electronAPI?.localMusic)
  }

  getScanStatus(): ScanStatus {
    return this.scanStatus
  }

  getScanProgress(): ScanProgress {
    return { ...this.scanProgress }
  }

  getAllSongs(): LocalSong[] {
    return Array.from(this.songs.values()).sort((a, b) => a.title.localeCompare(b.title))
  }

  getSongById(id: string): LocalSong | undefined {
    return this.songs.get(id)
  }

  getStats(): LibraryStats {
    const songs = Array.from(this.songs.values())
    const artists = new Set(songs.map((s) => s.artist).filter(Boolean))
    const albums = new Set(songs.map((s) => s.album).filter(Boolean))
    const totalDuration = songs.reduce((sum, s) => sum + s.duration, 0)
    const totalFileSize = songs.reduce((sum, s) => sum + s.fileSize, 0)

    return {
      totalSongs: songs.length,
      totalArtists: artists.size,
      totalAlbums: albums.size,
      totalDuration,
      totalFileSize,
    }
  }

  async selectDirectory(): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new Error('本地音乐功能仅在桌面端可用')
    }
    try {
      const result = await window.electronAPI!.localMusic!.selectDirectory()
      if (result?.ok && result?.directoryPath) {
        return result.directoryPath
      }
      return null
    } catch (e) {
      console.error('Failed to select directory:', e)
      return null
    }
  }

  async scanDirectory(dirPath: string): Promise<LocalScanResult> {
    if (!this.isAvailable()) {
      throw new Error('本地音乐功能仅在桌面端可用')
    }

    this.scanStatus = 'scanning'
    this.scanProgress = { current: 0, total: 0, currentFile: '' }
    this.notify()

    try {
      const result = await window.electronAPI!.localMusic!.scanDirectory(dirPath)

      if (!result?.ok) {
        throw new Error(result?.error || '扫描失败')
      }

      const files: string[] = result.files || []
      this.scanProgress.total = files.length
      this.notify()

      let scanned = 0
      let failed = 0

      for (const filePath of files) {
        this.scanProgress.current = scanned
        this.scanProgress.currentFile = filePath
        this.notify()

        try {
          const metadata = await window.electronAPI!.localMusic!.readMetadata(filePath)
          if (metadata?.ok) {
            const song = this.metadataToLocalSong(filePath, metadata.data)
            this.songs.set(song.id, song)
          } else {
            failed++
          }
        } catch (e) {
          failed++
        }
        scanned++
      }

      this.saveToStorage()

      this.scanStatus = 'completed'
      this.notify()

      return {
        songs: this.getAllSongs().map((s) => this.localSongToSong(s)),
        total: files.length,
        scanned,
        failed,
      }
    } catch (e) {
      this.scanStatus = 'error'
      this.notify()
      throw e
    }
  }

  private metadataToLocalSong(filePath: string, metadata: any): LocalSong {
    const fileName = filePath.split(/[\\/]/).pop() || filePath
    const title = metadata.title || this.stripExtension(fileName)
    const artist = metadata.artist || '未知艺术家'
    const album = metadata.album || '未知专辑'
    const duration = metadata.duration || 0

    const id = `local:${this.generateId(filePath)}`

    return {
      id,
      filePath,
      fileName,
      title,
      artist,
      album,
      duration,
      year: metadata.year,
      track: metadata.track,
      genre: metadata.genre,
      coverUrl: metadata.coverData ? `data:image/jpeg;base64,${metadata.coverData}` : undefined,
      fileSize: metadata.fileSize || 0,
      addedAt: Date.now(),
    }
  }

  private stripExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.slice(0, lastDot) : fileName
  }

  private generateId(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  localSongToSong(local: LocalSong): Song {
    const artist: Artist = {
      id: `local-artist:${local.artist}`,
      name: local.artist,
    }

    const album: Album | undefined = local.album
      ? {
          id: `local-album:${local.album}`,
          name: local.album,
          coverUrl: local.coverUrl,
        }
      : undefined

    return {
      id: local.id,
      name: local.title,
      artists: [artist],
      album,
      duration: local.duration,
      source: 'local',
      url: local.filePath,
      coverUrl: local.coverUrl,
    }
  }

  async getSongUrl(songId: string): Promise<string | null> {
    const localSong = this.songs.get(songId)
    if (!localSong) return null

    if (this.isAvailable()) {
      try {
        return await window.electronAPI!.localMusic!.getFileUrl(localSong.filePath)
      } catch (e) {
        console.error('Failed to get file URL:', e)
      }
    }

    return null
  }

  addSong(song: LocalSong): void {
    this.songs.set(song.id, song)
    this.saveToStorage()
    this.notify()
  }

  removeSong(id: string): boolean {
    const deleted = this.songs.delete(id)
    if (deleted) {
      this.saveToStorage()
      this.notify()
    }
    return deleted
  }

  clearLibrary(): void {
    this.songs.clear()
    this.saveToStorage()
    this.notify()
  }

  search(keyword: string): LocalSong[] {
    const kw = keyword.toLowerCase()
    return Array.from(this.songs.values()).filter(
      (s) =>
        s.title.toLowerCase().includes(kw) ||
        s.artist.toLowerCase().includes(kw) ||
        s.album.toLowerCase().includes(kw)
    )
  }

  getSupportedExtensions(): string[] {
    return [...SUPPORTED_EXTENSIONS]
  }
}

export const localMusicLibrary = new LocalMusicLibrary()
