import type { Dnd5eActivityTargetV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { dnd5eAreaTargetSelectionValid } from '../../rulesets/dnd5e/activities/dnd5eAreaTargetSelection'

/** Keeps cancel distinct from an explicit empty selection. Never truncates a choice. */
export async function chooseDnd5eAreaTargets(input: {
  target: Dnd5eActivityTargetV1
  candidates: readonly { id: string; label: string }[]
  choose: (selectedIds: readonly string[]) => Promise<string[] | null>
  invalid: () => Promise<unknown>
}): Promise<string[] | undefined> {
  let selected: string[] = []
  for (;;) {
    const result = await input.choose(selected)
    if (result == null) return undefined
    selected = result.filter(id => input.candidates.some(candidate => candidate.id === id))
    if (dnd5eAreaTargetSelectionValid(input.target, input.candidates.map(candidate => candidate.id), result)) return result
    await input.invalid()
  }
}
