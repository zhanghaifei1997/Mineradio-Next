/**
 * Tauri IPC 核心封装
 * 封装 @tauri-apps/api 的 invoke，提供统一的错误处理和类型安全调用
 */
import { invoke } from '@tauri-apps/api/core'

/**
 * 安全调用 Tauri 命令
 * @param command 命令名（Rust 侧 snake_case，这里也用 snake_case）
 * @param args 参数
 * @returns Promise<T>
 */
export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (err) {
    console.error(`[tauri-ipc] ${command} failed:`, err)
    throw err
  }
}

/**
 * 安全调用，失败时返回 null 而非抛异常
 */
export async function tauriInvokeSafe<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return await invoke<T>(command, args)
  } catch (err) {
    console.warn(`[tauri-ipc] ${command} failed (safe):`, err)
    return null
  }
}
