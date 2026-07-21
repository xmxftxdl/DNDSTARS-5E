import type { Dnd5eMonsterStatBlock } from './monsters'

let roomMonstersById = new Map<string, Dnd5eMonsterStatBlock>()

export function setDnd5eRoomMonsterCatalog(monsters: readonly Dnd5eMonsterStatBlock[]): void {
  roomMonstersById = new Map(monsters.map((monster) => [monster.id, monster]))
}

export function getDnd5eRoomMonster(id: string): Dnd5eMonsterStatBlock | undefined {
  return roomMonstersById.get(id)
}
