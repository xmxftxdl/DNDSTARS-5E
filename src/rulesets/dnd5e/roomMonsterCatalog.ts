import type { Dnd5eMonsterStatBlock } from './monsters'

let roomMonstersById = new Map<string, Dnd5eMonsterStatBlock>()
const pluginMonstersById = new Map<string, Dnd5eMonsterStatBlock>()

export function setDnd5eRoomMonsterCatalog(monsters: readonly Dnd5eMonsterStatBlock[]): void {
  roomMonstersById = new Map(monsters.map((monster) => [monster.id, monster]))
}

export function getDnd5eRoomMonster(id: string): Dnd5eMonsterStatBlock | undefined {
  return roomMonstersById.get(id) ?? pluginMonstersById.get(id)
}

/** Same precedence as lookup; removed plugin entries disappear immediately. */
export function listDnd5eRoomMonsters(): readonly Dnd5eMonsterStatBlock[] {
  return [...new Map([...pluginMonstersById, ...roomMonstersById]).values()]
}

export function registerDnd5ePluginMonsterCatalogEntry(monster: Dnd5eMonsterStatBlock): () => void {
  if (pluginMonstersById.has(monster.id)) throw new Error(`Plugin monster already registered: ${monster.id}`)
  pluginMonstersById.set(monster.id, monster)
  return () => {
    if (pluginMonstersById.get(monster.id) === monster) pluginMonstersById.delete(monster.id)
  }
}
