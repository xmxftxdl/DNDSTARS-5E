import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Character } from '../types/character'

function testCharacter(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'rest-test', name: '测试角色', player: '', avatar: '', accent: '',
    race: '人类', charClass: '战士', level: 1, background: '', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 12, currentHp: 12, tempHp: 0, hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 2,
    saveDC: 12, passivePerception: 10, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

const hadWindow = 'window' in globalThis
const hadFetch = 'fetch' in globalThis

beforeAll(() => {
  if (!hadWindow) {
    const memory = new Map<string, string>()
    ;(globalThis as unknown as { window: unknown }).window = {
      location: { port: '5273', protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:5273' },
      setTimeout: (fn: () => void) => setTimeout(fn, 0),
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => void memory.set(key, value),
        removeItem: (key: string) => void memory.delete(key),
        clear: () => memory.clear(),
        key: () => null,
        length: 0,
      },
    }
  }
  if (!hadFetch) {
    ;(globalThis as unknown as { fetch: unknown }).fetch = async () => ({ ok: false, json: async () => null })
  }
})

afterAll(() => {
  if (!hadWindow) delete (globalThis as unknown as { window?: unknown }).window
  if (!hadFetch) delete (globalThis as unknown as { fetch?: unknown }).fetch
})

describe('Open Hand Tranquility long-rest state', () => {
  it('grants Tranquility after a long rest and clears prior combat-only state', async () => {
    const { useCharacterStore } = await import('./characters')
    const originalCharacters = useCharacterStore.getState().characters
    const originalSelectedId = useCharacterStore.getState().selectedId
    const base = testCharacter()
    useCharacterStore.setState({
      characters: [{
        ...base,
        rulesetId: 'dnd5e-2014-srd-5.1',
        charClass: '武僧',
        level: 11,
        currentHp: 1,
        dnd5eClassChoices: { classes: { monk: { subclass: 'open-hand' } } },
        dnd5eCombatState: { quiveringPalmTargetId: 'old-target', dodgingTurnKey: 'old-turn' },
      }],
      selectedId: base.id,
    })

    useCharacterStore.getState().longRestAll()

    const rested = useCharacterStore.getState().characters[0]
    expect(rested.currentHp).toBe(rested.maxHp)
    expect(rested.dnd5eCombatState).toEqual({ tranquilityActive: true })
    useCharacterStore.setState({ characters: originalCharacters, selectedId: originalSelectedId })
  }, 15_000)

  it('clears a Wizard\'s accumulated Overchannel uses on a long rest', async () => {
    const { useCharacterStore } = await import('./characters')
    const originalCharacters = useCharacterStore.getState().characters
    const originalSelectedId = useCharacterStore.getState().selectedId
    const base = testCharacter()
    useCharacterStore.setState({
      characters: [{
        ...base,
        rulesetId: 'dnd5e-2014-srd-5.1',
        charClass: '法师',
        level: 14,
        dnd5eClassChoices: { classes: { wizard: { subclass: 'evocation' } } },
        dnd5eCombatState: { overchannelUsesSinceLongRest: 3, shieldSpellActive: true },
      }],
      selectedId: base.id,
    })

    useCharacterStore.getState().longRestAll()

    expect(useCharacterStore.getState().characters[0].dnd5eCombatState).toBeUndefined()
    useCharacterStore.setState({ characters: originalCharacters, selectedId: originalSelectedId })
  })

  it('keeps Divine Intervention locked until the campaign calendar advances a day', async () => {
    const { useCharacterStore } = await import('./characters')
    const originalCharacters = useCharacterStore.getState().characters
    const originalSelectedId = useCharacterStore.getState().selectedId
    const base = testCharacter()
    useCharacterStore.setState({
      characters: [{
        ...base,
        rulesetId: 'dnd5e-2014-srd-5.1',
        charClass: '牧师',
        level: 10,
        dnd5eCombatState: { divineInterventionCooldownDays: 7 },
        classResources: { 'dnd5e-divine-intervention': { current: 0, max: 1 } },
      }],
      selectedId: base.id,
    })

    useCharacterStore.getState().longRestAll()

    const rested = useCharacterStore.getState().characters[0]
    expect(rested.dnd5eCombatState).toEqual({ divineInterventionCooldownDays: 7 })
    expect(rested.classResources?.['dnd5e-divine-intervention']).toEqual({ current: 0, max: 1 })
    useCharacterStore.setState({ characters: originalCharacters, selectedId: originalSelectedId })
  })

  it('removes exactly one level of exhaustion from an SRD 5.1 character on a long rest', async () => {
    const { useCharacterStore } = await import('./characters')
    const originalCharacters = useCharacterStore.getState().characters
    const originalSelectedId = useCharacterStore.getState().selectedId
    const base = testCharacter()
    useCharacterStore.setState({
      characters: [{ ...base, exhaustionLevel: 3, currentHp: 1 }],
      selectedId: base.id,
    })

    useCharacterStore.getState().longRestAll()

    expect(useCharacterStore.getState().characters[0]).toMatchObject({ exhaustionLevel: 2, currentHp: 12 })
    useCharacterStore.setState({ characters: originalCharacters, selectedId: originalSelectedId })
  })
})
