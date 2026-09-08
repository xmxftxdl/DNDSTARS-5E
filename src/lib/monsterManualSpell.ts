import type { Token } from '../store/maps'
import {
  dnd5eAvailableMonsterSpellSlotLevels,
  dnd5eSpellDiceCount,
  getDnd5eSrdCombatSpell,
  getDnd5eSrdMonster,
  type Dnd5eMonsterTurnPlan,
  type Dnd5eSrdSpellDefinition,
} from '../rulesets/dnd5e'
import { dnd5eMonsterCoreSpellCompatibility } from '../rulesets/dnd5e/monsterAdvancedAbilities'
import type { GridCell } from './gridCombat'

export interface Dnd5eManualMonsterSpellOption {
  spellId: string
  spellName: string
  level: number
  castingTime: Dnd5eSrdSpellDefinition['castingTime']
  target: Dnd5eSrdSpellDefinition['target']
  rangeFeet: number
  area?: Dnd5eSrdSpellDefinition['area']
  automation: 'full' | 'manual'
  compatibilityReason?: string
  availableSlotLevels: readonly number[]
  resourceLabels: Readonly<Record<string, string>>
}

export interface Dnd5eMonsterAdjudicationSpellOption {
  spellId: string
  spellName: string
  level: number
  availableSlotLevels: readonly number[]
  resourceLabels: Readonly<Record<string, string>>
}

function slotResourceLabel(
  token: Token,
  monsterSlots: Readonly<Record<string, number>> | undefined,
  level: number,
): string {
  const resource = token.dnd5eCombatState?.monsterSpellSlots?.[String(level)]
  const current = resource?.current ?? monsterSlots?.[String(level)] ?? 0
  const maximum = resource?.max ?? monsterSlots?.[String(level)] ?? current
  return `${level} 环 ${current}/${maximum}`
}

/** Includes narrative/manual spells that have no audited combat-spell definition. */
export function dnd5eMonsterAdjudicationSpellOptions(
  token: Token,
): readonly Dnd5eMonsterAdjudicationSpellOption[] {
  const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
  if (!monster?.spellcasting?.spells) return []
  return monster.spellcasting.spells.flatMap((spell) => {
    const availableSlotLevels = dnd5eAvailableMonsterSpellSlotLevels({
      monster,
      token,
      spell,
    })
    if (availableSlotLevels.length === 0) return []
    const resourceLabels: Record<string, string> = {}
    for (const slotLevel of availableSlotLevels) {
      if (spell.level === 0 || spell.usage?.kind === 'at-will') {
        resourceLabels[String(slotLevel)] = '随意施法'
      } else if (spell.usage?.kind === 'per-day') {
        const resource = token.dnd5eCombatState?.monsterSpellUsesBySpellId?.[spell.id]
        const current = resource?.current ?? spell.usage.max
        const maximum = resource?.max ?? spell.usage.max
        resourceLabels[String(slotLevel)] = `每日 ${current}/${maximum}`
      } else {
        resourceLabels[String(slotLevel)] = slotResourceLabel(
          token,
          monster.spellcasting?.slots,
          slotLevel,
        )
      }
    }
    return [{
      spellId: spell.id,
      spellName: spell.name,
      level: spell.level,
      availableSlotLevels,
      resourceLabels,
    }]
  }).sort((left, right) =>
    left.level - right.level || left.spellName.localeCompare(right.spellName, 'zh-CN'))
}

export function dnd5eManualMonsterSpellOptions(
  token: Token,
): readonly Dnd5eManualMonsterSpellOption[] {
  const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
  if (!monster?.spellcasting?.spells) return []
  return monster.spellcasting.spells.flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    const definitionMatches = !!spell && spell.level === listedSpell.level
    const compatibility = definitionMatches
      ? dnd5eMonsterCoreSpellCompatibility(spell)
      : {
          automation: 'manual' as const,
          reason: '该法术没有通过完整 Headless 语义审查；批准后仅消费怪物施法资源。',
        }
    const availableSlotLevels = dnd5eAvailableMonsterSpellSlotLevels({
      monster,
      token,
      spell: listedSpell,
    })
    const resourceLabels: Record<string, string> = {}
    for (const slotLevel of availableSlotLevels) {
      if (listedSpell.level === 0 || listedSpell.usage?.kind === 'at-will') {
        resourceLabels[String(slotLevel)] = '随意施法'
      } else if (listedSpell.usage?.kind === 'per-day') {
        const resource = token.dnd5eCombatState?.monsterSpellUsesBySpellId?.[listedSpell.id]
        const current = resource?.current ?? listedSpell.usage.max
        const maximum = resource?.max ?? listedSpell.usage.max
        resourceLabels[String(slotLevel)] = `每日 ${current}/${maximum}`
      } else {
        resourceLabels[String(slotLevel)] = slotResourceLabel(
          token,
          monster.spellcasting?.slots,
          slotLevel,
        )
      }
    }
    return [{
      spellId: listedSpell.id,
      spellName: listedSpell.name || spell?.name || listedSpell.id,
      level: listedSpell.level,
      castingTime: spell?.castingTime ?? 'action',
      target: spell?.target ?? 'creature',
      rangeFeet: spell?.rangeFeet ?? 0,
      area: spell?.area,
      automation: compatibility.automation,
      compatibilityReason: compatibility.reason,
      availableSlotLevels,
      resourceLabels,
    }]
  }).sort((left, right) =>
    left.level - right.level || left.spellName.localeCompare(right.spellName, 'zh-CN'))
}

export function buildDnd5eManualMonsterSpellPlan(input: {
  actor: Token
  spellId: string
  slotLevel: number
  targetTokenIds: readonly string[]
  targetCharacterId?: string
  areaTargetCell?: GridCell
  areaTargetOrientation?: 0 | 1 | 2 | 3
  areaTargetElevationFeet?: number
  legendaryActionId?: string
}): Dnd5eMonsterTurnPlan | undefined {
  const monster = input.actor.poolId ? getDnd5eSrdMonster(input.actor.poolId) : undefined
  const listedSpell = monster?.spellcasting?.spells?.find((spell) => spell.id === input.spellId)
  const spell = listedSpell ? getDnd5eSrdCombatSpell(listedSpell.id) : undefined
  if (
    !monster?.spellcasting || !listedSpell || !spell ||
    dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' ||
    !dnd5eAvailableMonsterSpellSlotLevels({ monster, token: input.actor, spell: listedSpell })
      .includes(input.slotLevel)
  ) return undefined
  const diceCount = dnd5eSpellDiceCount(
    spell,
    Math.max(1, monster.spellcasting.casterLevel ?? 1),
    input.slotLevel,
  )
  const primaryTargetId = input.targetTokenIds[0]
  return {
    moved: false,
    attacked: false,
    attackerTokenId: input.actor.id,
    targetTokenId: primaryTargetId,
    targetCharacterId: input.targetCharacterId,
    spellCast: {
      spellId: spell.id,
      spellName: spell.name,
      slotLevel: input.slotLevel,
      targetTokenIds: [...input.targetTokenIds],
      projectileTargetIds: spell.effect === 'automatic-damage' && primaryTargetId
        ? Array.from({ length: diceCount }, () => primaryTargetId)
        : undefined,
      effect: spell.effect,
      diceCount,
      diceSides: spell.dice.sides,
      castingTime: spell.castingTime,
      saveAbility: spell.saveAbility,
      area: spell.area,
      areaTargetCell: input.areaTargetCell,
      areaTargetOrientation: input.areaTargetOrientation,
      areaTargetElevationFeet: input.areaTargetElevationFeet,
      legendaryActionId: input.legendaryActionId,
    },
    message: `${input.actor.label}施放${spell.name}${input.slotLevel > 0 ? `（${input.slotLevel} 环）` : '（戏法）'}。`,
  }
}
