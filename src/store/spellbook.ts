import { create } from 'zustand'
import { canWriteSharedState } from '../lib/appMode'
import { loadSharedResource, saveSharedResource } from '../lib/sharedApi'
import { reportSharedIntegrityIssue } from '../lib/sharedResourceValidation'
import {
  parseDnd5eSharedSpellCollection,
  type Dnd5eImportedSpell,
} from '../rulesets/dnd5e/spellbook'

export const SHARED_SPELLBOOK_RESOURCE = 'spellbook'

interface SharedSpellbookState {
  schemaVersion: 1
  spells: Dnd5eImportedSpell[]
  updatedAt: number
}

interface SpellbookState {
  spells: Dnd5eImportedSpell[]
  loaded: boolean
  loadShared: () => Promise<void>
  importSpells: (spells: readonly Dnd5eImportedSpell[]) => Promise<{ added: number; replaced: number }>
  removeSpell: (id: string) => Promise<void>
}

let lastAppliedUpdatedAt = 0
let lastLocalWriteAt = 0

function snapshot(spells: readonly Dnd5eImportedSpell[], updatedAt: number): SharedSpellbookState {
  return { schemaVersion: 1, spells: [...spells], updatedAt }
}

async function publish(spells: readonly Dnd5eImportedSpell[]): Promise<void> {
  const updatedAt = Math.max(Date.now(), lastAppliedUpdatedAt + 1, lastLocalWriteAt + 1)
  lastLocalWriteAt = updatedAt
  lastAppliedUpdatedAt = updatedAt
  await saveSharedResource(SHARED_SPELLBOOK_RESOURCE, snapshot(spells, updatedAt))
}

export const useSpellbookStore = create<SpellbookState>((set, get) => ({
  spells: [],
  loaded: false,

  loadShared: async () => {
    const shared = await loadSharedResource<SharedSpellbookState>(SHARED_SPELLBOOK_RESOURCE)
    if (!shared) {
      set({ loaded: true })
      if (canWriteSharedState()) await publish(get().spells)
      return
    }
    const updatedAt = Math.max(0, Number(shared.updatedAt) || 0)
    if (updatedAt < lastAppliedUpdatedAt) return
    let spells: Dnd5eImportedSpell[]
    try {
      spells = parseDnd5eSharedSpellCollection(shared.spells)
    } catch (error) {
      reportSharedIntegrityIssue({
        resource: SHARED_SPELLBOOK_RESOURCE,
        reason: `房间法术数据未通过 D&D 5e 模板校验：${error instanceof Error ? error.message : '未知错误'}`,
        value: shared,
      })
      set({ loaded: true })
      return
    }
    lastAppliedUpdatedAt = updatedAt
    set({ spells, loaded: true })
  },

  importSpells: async (incoming) => {
    if (!canWriteSharedState()) throw new Error('只有 DM 可以修改房间法术书')
    const current = get().spells
    const byId = new Map(current.map((spell) => [spell.id, spell]))
    let added = 0
    let replaced = 0
    for (const spell of incoming) {
      if (byId.has(spell.id)) replaced += 1
      else added += 1
      byId.set(spell.id, spell)
    }
    const spells = [...byId.values()].sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'zh-CN'))
    set({ spells })
    await publish(spells)
    return { added, replaced }
  },

  removeSpell: async (id) => {
    if (!canWriteSharedState()) throw new Error('只有 DM 可以修改房间法术书')
    const spells = get().spells.filter((spell) => spell.id !== id)
    set({ spells })
    await publish(spells)
  },
}))
