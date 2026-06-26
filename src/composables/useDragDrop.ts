import { ref, onMounted, onUnmounted } from 'vue'
import type { Song, Artist, Album } from '@/types'
import { localMusicLibrary } from '@/modules/local'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'

const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.opus']

export function useDragDrop() {
  const isDragging = ref(false)
  const dragCounter = ref(0)
  const player = usePlayerStore()
  const queue = playQueueStore()

  function isAudioFile(fileName: string): boolean {
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
    return SUPPORTED_EXTENSIONS.includes(ext)
  }

  function getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.slice(lastDot).toLowerCase() : ''
  }

  function parseFileName(fileName: string): { title: string; artist: string } {
    const ext = getFileExtension(fileName)
    const nameWithoutExt = ext ? fileName.slice(0, -ext.length) : fileName

    const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/)
    if (dashMatch) {
      return {
        artist: dashMatch[1].trim(),
        title: dashMatch[2].trim(),
      }
    }

    return {
      artist: '未知艺术家',
      title: nameWithoutExt,
    }
  }

  function fileToSong(file: File): Song {
    const { title, artist } = parseFileName(file.name)
    const fileId = `drag:${file.name}:${file.size}:${file.lastModified}`

    const artistObj: Artist = {
      id: `drag-artist:${artist}`,
      name: artist,
    }

    const albumObj: Album = {
      id: 'drag-album:unknown',
      name: '未知专辑',
    }

    return {
      id: fileId,
      name: title,
      artists: [artistObj],
      album: albumObj,
      duration: 0,
      source: 'local',
      url: URL.createObjectURL(file),
      coverUrl: undefined,
    }
  }

  async function handleFiles(files: FileList | File[]): Promise<void> {
    const fileArray = Array.isArray(files) ? files : Array.from(files)
    const audioFiles = fileArray.filter((f) => isAudioFile(f.name))

    if (audioFiles.length === 0) return

    const songs = audioFiles.map((file) => fileToSong(file))

    if (songs.length > 0) {
      if (!player.currentSong) {
        queue.setQueue(songs, 0)
        await player.play(songs[0])
      } else {
        queue.addListToQueue(songs)
      }
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault()
    dragCounter.value++
    if (e.dataTransfer?.types.includes('Files')) {
      isDragging.value = true
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    dragCounter.value--
    if (dragCounter.value <= 0) {
      isDragging.value = false
      dragCounter.value = 0
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDragging.value = false
    dragCounter.value = 0

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files)
    }
  }

  function setupDragDrop() {
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
  }

  function cleanupDragDrop() {
    window.removeEventListener('dragenter', handleDragEnter)
    window.removeEventListener('dragleave', handleDragLeave)
    window.removeEventListener('dragover', handleDragOver)
    window.removeEventListener('drop', handleDrop)
  }

  onMounted(() => {
    setupDragDrop()
  })

  onUnmounted(() => {
    cleanupDragDrop()
  })

  return {
    isDragging,
    handleFiles,
    setupDragDrop,
    cleanupDragDrop,
  }
}
