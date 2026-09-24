import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCharacterCreationDraft, hasCharacterCreationDraft, readCharacterCreationDraft, writeCharacterCreationDraft } from './characterCreationDraft'

describe('character creation drafts', () => {
  beforeEach(() => {
    const entries = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('restores the stage, dice and partial choices across remounts', () => {
    const defaults = { stage: 'class', name: '', rolls: [] as number[], selections: {} as Record<string, string[]> }
    expect(writeCharacterCreationDraft('a', { stage: 'abilities', name: '艾拉', rolls: [18, 13, 12, 11, 10, 8], selections: { skills: ['history'] } })).toBe(true)
    expect(readCharacterCreationDraft('a', defaults)).toEqual({ stage: 'abilities', name: '艾拉', rolls: [18, 13, 12, 11, 10, 8], selections: { skills: ['history'] } })
    expect(readCharacterCreationDraft('b', defaults)).toEqual(defaults)
    clearCharacterCreationDraft('a')
    expect(hasCharacterCreationDraft('a')).toBe(false)
  })
  it('handles corrupted and inaccessible storage without crashing', () => {
    localStorage.setItem('a', '{broken')
    expect(readCharacterCreationDraft('a', { name: '默认' })).toEqual({ name: '默认' })
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } })
    expect(readCharacterCreationDraft('a', { name: '默认' })).toEqual({ name: '默认' })
    expect(writeCharacterCreationDraft('a', { name: '草稿' })).toBe(false)
  })
})
