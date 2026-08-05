import { create } from 'zustand'
import { canWriteSharedState } from '../lib/appMode'
import { loadSharedResource, saveSharedResource } from '../composition/browserSharedRoomResources'
import { reportSharedIntegrityIssue } from '../lib/sharedResourceValidation'
import { getRoomSession } from '../lib/roomSession'
import {
  parseDnd5eMonsterStatBlock,
  type Dnd5eMonsterSchemaIssue,
} from '../rulesets/dnd5e/monsterSchema'
import type { Dnd5eMonsterStatBlock } from '../rulesets/dnd5e/monsters'
import { setDnd5eRoomMonsterCatalog } from '../rulesets/dnd5e/roomMonsterCatalog'

export const SHARED_CUSTOM_MONSTERS_RESOURCE = 'custom-monsters'
export const DND5E_CUSTOM_MONSTER_SCHEMA_VERSION = 1
export const DND5E_CUSTOM_MONSTER_LIMIT = 512
export const DND5E_CUSTOM_MONSTER_MAX_JSON_CHARS = 4_000_000

export interface SharedCustomMonsterState {
  schemaVersion: typeof DND5E_CUSTOM_MONSTER_SCHEMA_VERSION
  monsters: Dnd5eMonsterStatBlock[]
  updatedAt: number
}

interface CustomMonsterState {
  monsters: Dnd5eMonsterStatBlock[]
  loaded: boolean
  loadedRoomId: string | null
  loadShared: () => Promise<void>
  upsertMonster: (monster: Dnd5eMonsterStatBlock) => Promise<void>
  importMonsters: (monsters: readonly unknown[]) => Promise<{ added: number; replaced: number }>
  removeMonster: (id: string) => Promise<void>
}

const lastAppliedUpdatedAtByRoom = new Map<string, number>()
const lastLocalWriteAtByRoom = new Map<string, number>()

function currentRoomId(): string {
  return getRoomSession()?.roomId ?? 'local'
}

function validateCollection(raw: unknown):
  | { ok: true; monsters: Dnd5eMonsterStatBlock[] }
  | { ok: false; issues: Dnd5eMonsterSchemaIssue[]; reason: string } {
  if (!Array.isArray(raw) || raw.length > DND5E_CUSTOM_MONSTER_LIMIT) {
    return { ok: false, issues: [], reason: `自定义怪物必须是最多 ${DND5E_CUSTOM_MONSTER_LIMIT} 项的数组` }
  }
  let serializedLength = Number.POSITIVE_INFINITY
  try {
    serializedLength = JSON.stringify(raw).length
  } catch {
    // The schema error below is intentionally generic and fail-closed.
  }
  if (serializedLength > DND5E_CUSTOM_MONSTER_MAX_JSON_CHARS) {
    return { ok: false, issues: [], reason: '自定义怪物目录超过房间同步容量上限' }
  }
  const monsters: Dnd5eMonsterStatBlock[] = []
  const issues: Dnd5eMonsterSchemaIssue[] = []
  const ids = new Set<string>()
  const slugs = new Set<string>()
  for (const entry of raw) {
    const parsed = parseDnd5eMonsterStatBlock(entry)
    if (!parsed.ok) {
      issues.push(...parsed.issues)
      continue
    }
    if (parsed.value.source !== 'DM 自定义') {
      issues.push({ monsterId: parsed.value.id, code: 'invalid-stat-block', message: '房间怪物必须标记为 DM 自定义' })
      continue
    }
    if (ids.has(parsed.value.id) || slugs.has(parsed.value.slug)) {
      issues.push({ monsterId: parsed.value.id, code: 'duplicate-monster-id', message: '房间怪物 ID 或 slug 重复' })
      continue
    }
    ids.add(parsed.value.id)
    slugs.add(parsed.value.slug)
    monsters.push(parsed.value)
  }
  return issues.length > 0
    ? { ok: false, issues, reason: issues.slice(0, 5).map((entry) => entry.message).join('；') }
    : { ok: true, monsters }
}

function applyMonsters(monsters: Dnd5eMonsterStatBlock[], set: (patch: Partial<CustomMonsterState>) => void, roomId = currentRoomId()): void {
  setDnd5eRoomMonsterCatalog(monsters)
  set({ monsters, loaded: true, loadedRoomId: roomId })
}

async function publish(monsters: readonly Dnd5eMonsterStatBlock[]): Promise<void> {
  const roomId = currentRoomId()
  const updatedAt = Math.max(
    Date.now(),
    (lastAppliedUpdatedAtByRoom.get(roomId) ?? 0) + 1,
    (lastLocalWriteAtByRoom.get(roomId) ?? 0) + 1,
  )
  lastAppliedUpdatedAtByRoom.set(roomId, updatedAt)
  lastLocalWriteAtByRoom.set(roomId, updatedAt)
  await saveSharedResource<SharedCustomMonsterState>(SHARED_CUSTOM_MONSTERS_RESOURCE, {
    schemaVersion: DND5E_CUSTOM_MONSTER_SCHEMA_VERSION,
    monsters: [...monsters],
    updatedAt,
  })
}

export const useCustomMonsterStore = create<CustomMonsterState>((set, get) => ({
  monsters: [],
  loaded: false,
  loadedRoomId: null,

  loadShared: async () => {
    const roomId = currentRoomId()
    if (get().loadedRoomId !== roomId) {
      setDnd5eRoomMonsterCatalog([])
      set({ monsters: [], loaded: false, loadedRoomId: roomId })
    }
    const shared = await loadSharedResource<SharedCustomMonsterState>(SHARED_CUSTOM_MONSTERS_RESOURCE)
    if (currentRoomId() !== roomId) return
    if (!shared) {
      applyMonsters([], set, roomId)
      if (canWriteSharedState()) await publish([])
      return
    }
    const updatedAt = Math.max(0, Number(shared.updatedAt) || 0)
    if (updatedAt < (lastAppliedUpdatedAtByRoom.get(roomId) ?? 0)) return
    if (shared.schemaVersion !== DND5E_CUSTOM_MONSTER_SCHEMA_VERSION) {
      reportSharedIntegrityIssue({
        resource: SHARED_CUSTOM_MONSTERS_RESOURCE,
        reason: `不支持的怪物目录 schemaVersion：${String(shared.schemaVersion)}`,
        value: shared,
      })
      set({ loaded: true })
      return
    }
    const parsed = validateCollection(shared.monsters)
    if (!parsed.ok) {
      reportSharedIntegrityIssue({ resource: SHARED_CUSTOM_MONSTERS_RESOURCE, reason: parsed.reason, value: shared })
      set({ loaded: true })
      return
    }
    lastAppliedUpdatedAtByRoom.set(roomId, updatedAt)
    applyMonsters(parsed.monsters, set, roomId)
  },

  upsertMonster: async (monster) => {
    if (!canWriteSharedState()) throw new Error('只有 DM 可以修改房间怪物目录')
    const parsed = validateCollection([
      ...get().monsters.filter((entry) => entry.id !== monster.id && entry.slug !== monster.slug),
      monster,
    ])
    if (!parsed.ok) throw new Error(parsed.reason)
    const monsters = parsed.monsters.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    applyMonsters(monsters, set)
    await publish(monsters)
  },

  importMonsters: async (incoming) => {
    if (!canWriteSharedState()) throw new Error('只有 DM 可以导入房间怪物')
    const incomingParsed = validateCollection(incoming)
    if (!incomingParsed.ok) throw new Error(incomingParsed.reason)
    const byId = new Map(get().monsters.map((monster) => [monster.id, monster]))
    let added = 0
    let replaced = 0
    for (const monster of incomingParsed.monsters) {
      if (byId.has(monster.id)) replaced += 1
      else added += 1
      byId.set(monster.id, monster)
    }
    const parsed = validateCollection([...byId.values()])
    if (!parsed.ok) throw new Error(parsed.reason)
    const monsters = parsed.monsters.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    applyMonsters(monsters, set)
    await publish(monsters)
    return { added, replaced }
  },

  removeMonster: async (id) => {
    if (!canWriteSharedState()) throw new Error('只有 DM 可以删除房间怪物')
    const monsters = get().monsters.filter((monster) => monster.id !== id)
    applyMonsters(monsters, set)
    await publish(monsters)
  },
}))
