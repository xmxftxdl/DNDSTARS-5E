import type { Dnd5eMonsterStatBlock } from '../../rulesets/dnd5e/monsters'

export type Dnd5eMonsterWorkshopCommitDestination = 'default' | 'current-room'

interface Dnd5eMonsterWorkshopCommitInput {
  monster: Dnd5eMonsterStatBlock
  pluginMode: boolean
  destination: Dnd5eMonsterWorkshopCommitDestination
  existingMonsters: readonly Dnd5eMonsterStatBlock[]
  onPluginMonstersChange?: (monsters: Dnd5eMonsterStatBlock[]) => void
  upsertRoomMonster: (monster: Dnd5eMonsterStatBlock) => Promise<void>
}

interface Dnd5eMonsterWorkshopCommitResult {
  savedToPluginDraft: boolean
  savedToCurrentRoom: boolean
}

/** Keeps plugin-draft storage and the current-room catalogue explicit. */
export async function commitDnd5eMonsterWorkshopMonster(
  input: Dnd5eMonsterWorkshopCommitInput,
): Promise<Dnd5eMonsterWorkshopCommitResult> {
  if (input.pluginMode) {
    if (!input.onPluginMonstersChange) throw new Error('扩展怪物编辑器缺少草稿写入接口。')
    const nextMonsters = [
      ...input.existingMonsters.filter((entry) =>
        entry.id !== input.monster.id && entry.slug !== input.monster.slug),
      input.monster,
    ].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    if (nextMonsters.length > 128) throw new Error('单个扩展最多包含 128 个怪物模板。')
    input.onPluginMonstersChange(nextMonsters)
  }

  const savedToCurrentRoom = !input.pluginMode || input.destination === 'current-room'
  if (savedToCurrentRoom) await input.upsertRoomMonster(input.monster)

  return {
    savedToPluginDraft: input.pluginMode,
    savedToCurrentRoom,
  }
}
