import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VOICE_CHANGER_SELECTION,
  isVoiceChangerBypassed,
  normalizeVoiceChangerConfig,
  normalizeVoiceChangerSelection,
  toggleVoiceChangerShortcut,
  voiceChangerParameters,
  voiceShortcutFromKeyboardEvent,
} from './voiceChanger'

describe('voiceChanger', () => {
  it('normalizes untrusted persisted selections and shortcut slots', () => {
    expect(normalizeVoiceChangerSelection({ baseProfileId: 'unknown', effectPresetId: 'dragon' })).toEqual({
      baseProfileId: 'original',
      effectPresetId: 'dragon',
    })
    expect(normalizeVoiceChangerConfig({
      activeShortcut: 2,
      selection: { baseProfileId: 'feminine', effectPresetId: 'ghost' },
      slots: [
        { shortcut: 2, npcTokenId: ' npc-2 ', npcName: ' 女爵 ', selection: { baseProfileId: 'feminine', effectPresetId: 'deep-lord' } },
        { shortcut: 2, npcTokenId: 'duplicate', npcName: '重复', selection: DEFAULT_VOICE_CHANGER_SELECTION },
        { shortcut: 3, npcName: ' 无地图角色 ', selection: { baseProfileId: 'masculine', effectPresetId: 'aged-sage' } },
        { shortcut: 10, npcTokenId: 'invalid', npcName: '无效', selection: DEFAULT_VOICE_CHANGER_SELECTION },
      ],
    })).toMatchObject({
      schemaVersion: 1,
      activeShortcut: 2,
      slots: [
        { shortcut: 2, npcTokenId: 'npc-2', npcName: '女爵' },
        { shortcut: 3, npcName: '无地图角色' },
      ],
    })
  })

  it('toggles a configured shortcut back to the original voice when pressed twice', () => {
    const configured = normalizeVoiceChangerConfig({
      selection: DEFAULT_VOICE_CHANGER_SELECTION,
      slots: [{
        shortcut: 1,
        npcName: '酒馆老板',
        selection: { baseProfileId: 'masculine', effectPresetId: 'deep-lord' },
      }],
    })
    const active = toggleVoiceChangerShortcut(configured, 1)
    expect(active).toMatchObject({
      activeShortcut: 1,
      selection: { baseProfileId: 'masculine', effectPresetId: 'deep-lord' },
    })
    expect(toggleVoiceChangerShortcut(active, 1)).toEqual({
      ...active,
      selection: DEFAULT_VOICE_CHANGER_SELECTION,
      activeShortcut: undefined,
    })
  })

  it('combines a feminine base voice with a character effect', () => {
    const feminine = voiceChangerParameters({ baseProfileId: 'feminine', effectPresetId: 'natural' })
    const feminineDragon = voiceChangerParameters({ baseProfileId: 'feminine', effectPresetId: 'dragon' })
    expect(feminine.pitchRatio).toBeGreaterThan(1)
    expect(feminineDragon.pitchRatio).toBeLessThan(feminine.pitchRatio)
    expect(feminineDragon.reverbMix).toBeGreaterThan(0)
    expect(isVoiceChangerBypassed(DEFAULT_VOICE_CHANGER_SELECTION)).toBe(true)
    expect(isVoiceChangerBypassed({ baseProfileId: 'feminine', effectPresetId: 'natural' })).toBe(false)
  })

  it('accepts only bare 1-9 shortcuts outside editable controls', () => {
    const target = { closest: () => null } as unknown as EventTarget
    expect(voiceShortcutFromKeyboardEvent({ code: 'Digit4', target, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false })).toBe(4)
    expect(voiceShortcutFromKeyboardEvent({ code: 'Numpad9', target, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false })).toBe(9)
    expect(voiceShortcutFromKeyboardEvent({ code: 'Digit4', target, altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, repeat: false })).toBeNull()
    const input = { closest: () => ({}) } as unknown as EventTarget
    expect(voiceShortcutFromKeyboardEvent({ code: 'Digit4', target: input, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false })).toBeNull()
  })
})
