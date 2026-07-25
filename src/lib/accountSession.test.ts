import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACCOUNT_RECOVERY_HINT_STORAGE_KEY,
  ACCOUNT_SESSION_STORAGE_KEY,
  clearAccountSession,
  getAccountSession,
  saveAccountSession,
} from './accountSession'

function localStorageDouble() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('账号会话浏览器存储', () => {
  it('为 useSyncExternalStore 保持相同存储值的快照引用稳定', () => {
    const localStorage = localStorageDouble()
    vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() })
    const session = {
      accountId: 'ABC234DEF567', displayName: '插件作者',
      sessionToken: `ABC234DEF567.${'x'.repeat(43)}`, createdAt: 1,
    }
    localStorage.setItem(ACCOUNT_SESSION_STORAGE_KEY, JSON.stringify(session))

    const first = getAccountSession()
    expect(getAccountSession()).toBe(first)

    localStorage.setItem(ACCOUNT_SESSION_STORAGE_KEY, JSON.stringify({ ...session, displayName: '新名称' }))
    const changed = getAccountSession()
    expect(changed).not.toBe(first)
    expect(changed?.displayName).toBe('新名称')
    expect(getAccountSession()).toBe(changed)
  })

  it('清除设备会话时保留无权限的账号提示，但不会保留恢复秘密', () => {
    const localStorage = localStorageDouble()
    vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() })
    saveAccountSession({
      accountId: 'ABC234DEF567', displayName: '玩家甲',
      sessionToken: `ABC234DEF567.${'x'.repeat(43)}`, createdAt: 1,
    })
    expect(getAccountSession()?.accountId).toBe('ABC234DEF567')
    clearAccountSession()
    expect(localStorage.getItem(ACCOUNT_SESSION_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ACCOUNT_RECOVERY_HINT_STORAGE_KEY)).toBe('ABC234DEF567')
  })
})
