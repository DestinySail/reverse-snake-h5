import { STORAGE_KEYS } from './config'

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const resolveBrowserStorage = (): StorageAdapter | null => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  return window.localStorage
}

export const createGameStorage = (adapter: StorageAdapter | null = resolveBrowserStorage()) => ({
  getHighScore(): number {
    if (!adapter) {
      return 0
    }

    const raw = adapter.getItem(STORAGE_KEYS.highScore)
    const value = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(value) ? value : 0
  },
  setHighScore(score: number): void {
    if (!adapter) {
      return
    }

    adapter.setItem(STORAGE_KEYS.highScore, String(Math.max(0, Math.floor(score))))
  },
  getHasSeenIntro(): boolean {
    if (!adapter) {
      return false
    }

    return adapter.getItem(STORAGE_KEYS.hasSeenIntro) === '1'
  },
  setHasSeenIntro(): void {
    if (!adapter) {
      return
    }

    adapter.setItem(STORAGE_KEYS.hasSeenIntro, '1')
  },
})
