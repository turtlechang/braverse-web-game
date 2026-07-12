// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import {
  DEFAULT_THEME,
  STORAGE_KEY,
  clearStoredTheme,
  getStoredTheme,
  setStoredTheme,
} from './themeStorage'

describe('themeStorage', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    document.documentElement.removeAttribute('data-theme')
  })

  it('預設為 tactical-clean', () => {
    expect(DEFAULT_THEME).toBe('tactical-clean')
    expect(getStoredTheme()).toBe('tactical-clean')
  })

  it('無 localStorage 時回傳預設值', () => {
    expect(getStoredTheme()).toBe('tactical-clean')
  })

  it('合法值會被讀回', () => {
    window.localStorage.setItem(STORAGE_KEY, 'low-glare')
    expect(getStoredTheme()).toBe('low-glare')
  })

  it('非法值回退為預設', () => {
    window.localStorage.setItem(STORAGE_KEY, 'invalid-theme')
    expect(getStoredTheme()).toBe('tactical-clean')
  })

  it('setStoredTheme 寫入 localStorage 並更新 data-theme', () => {
    setStoredTheme('broadcast')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('broadcast')
    expect(document.documentElement.dataset.theme).toBe('broadcast')
  })

  it('clearStoredTheme 移除儲存值並清除 data-theme', () => {
    setStoredTheme('low-glare')
    clearStoredTheme()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
})
