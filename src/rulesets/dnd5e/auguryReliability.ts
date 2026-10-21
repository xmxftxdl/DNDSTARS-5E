import type { Character } from '../../types/character'
import type { Dnd5eMapResultPlan } from './mapBridge'

/** Read only Host-owned character history, never the submitted spell payload. */
export function dnd5eAuguryRandomChance(character: Character): number {
  const casts = character.dnd5eCombatState?.auguryHistory?.casts ?? 0
  return Number.isFinite(casts) ? Math.min(4, Math.max(0, Math.floor(casts))) * 25 : 0
}

/** Called only after successful, non-countered settlement and material consumption. */
export function nextDnd5eAuguryHistory(actor: Character, actionId: string) {
  if (actor.dnd5eCombatState?.auguryHistory?.lastActionId === actionId) return actor.dnd5eCombatState.auguryHistory
  return { casts: Math.min(4, dnd5eAuguryRandomChance(actor) / 25 + 1), lastActionId: actionId }
}

export function recordDnd5eAuguryCast(plan: Dnd5eMapResultPlan, actor: Character, actionId: string): Dnd5eMapResultPlan {
  if (actor.dnd5eCombatState?.auguryHistory?.lastActionId === actionId) return plan
  const current = plan.characters.find(character => character.id === actor.id)
  if (!current || current.dnd5eCombatState?.auguryHistory?.lastActionId === actionId) return plan
  const dnd5eCombatState = { ...current.dnd5eCombatState, auguryHistory: nextDnd5eAuguryHistory(actor, actionId) }
  return { ...plan,
    characters: plan.characters.map(character => character.id === actor.id ? { ...character, dnd5eCombatState } : character),
    changedCharacterIds: [...new Set([...plan.changedCharacterIds, actor.id])],
    characterPatches: { ...plan.characterPatches, [actor.id]: { ...plan.characterPatches?.[actor.id], dnd5eCombatState } },
  }
}

/** This result is for the DM only and must not be included in shared events. */
export function dnd5eAugurySecretResult(chance: number, d100: number, d4: number): string {
  if (!Number.isInteger(d100) || d100 < 1 || d100 > 100 || !Number.isInteger(d4) || d4 < 1 || d4 > 4) {
    throw new Error('Invalid Augury dice')
  }
  return d100 <= chance
    ? `随机预兆：${['吉', '凶', '吉凶并存', '无'][d4 - 1]}。不要向玩家透露此次预兆为随机结果。`
    : '本次未触发随机预兆，请按所述行动裁定吉、凶、吉凶并存或无。'
}
