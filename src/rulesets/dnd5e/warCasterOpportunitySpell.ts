import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type {
  Dnd5eSpellCastPayload,
  Dnd5eTurnEconomyByToken,
  Dnd5eTurnEconomyCounts,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eEffectiveRulesContextV1 } from './effectiveRulesContext'
import type { Dnd5eDamageType } from './damageTypes'
import { prepareDnd5eSpellCast } from './spellAction'
import {
  dnd5eSelectedCombatSpellIds,
  dnd5eSpellAllowsRepeatedTargets,
  dnd5eSpellHigherSlotDamageChoices,
  dnd5eSpellProjectileCount,
  getDnd5eSrdCombatSpell,
  type Dnd5eSrdSpellDefinition,
} from './spells'

export interface Dnd5eWarCasterOpportunitySpellOption {
  id: string
  label: string
  description: string
  action: SharedPlayerActionState
}

const conditionChoiceLabels = {
  blinded: '目盲',
  deafened: '耳聋',
  paralyzed: '麻痹',
  poisoned: '中毒',
  disease: '疾病',
} as const

const damageTypeLabels: Readonly<Record<Dnd5eDamageType, string>> = {
  acid: '强酸',
  bludgeoning: '钝击',
  cold: '冷冻',
  fire: '火焰',
  force: '力场',
  lightning: '闪电',
  necrotic: '黯蚀',
  piercing: '穿刺',
  poison: '毒素',
  psychic: '心灵',
  radiant: '光耀',
  slashing: '挥砍',
  thunder: '雷鸣',
}

const enlargeReduceLabels = { enlarge: '变巨', reduce: '缩小' } as const
const enhanceAbilityLabels = {
  'bear-endurance': '熊之坚韧',
  'bull-strength': '牛之力量',
  'cat-grace': '猫之优雅',
  'eagle-splendor': '鹰之威仪',
  'fox-cunning': '狐之狡黠',
  'owl-wisdom': '枭之睿智',
} as const

type SpellOptionFields = Pick<
  Dnd5eSpellCastPayload,
  'conditionChoice' | 'effectDamageType' | 'enlargeReduceChoice' |
  'enhanceAbilityChoice' | 'higherSlotDamageType'
>

const selectableEffectDamageTypes = new Set<NonNullable<SpellOptionFields['effectDamageType']>>([
  'acid', 'cold', 'fire', 'lightning', 'thunder',
])

function isSelectableEffectDamageType(
  value: Dnd5eDamageType,
): value is NonNullable<SpellOptionFields['effectDamageType']> {
  return selectableEffectDamageTypes.has(value as NonNullable<SpellOptionFields['effectDamageType']>)
}

function spellChoicePayloads(
  spell: Dnd5eSrdSpellDefinition,
  slotLevel: number,
): readonly { fields: SpellOptionFields; suffix: string }[] {
  const conditionChoices = spell.conditionOptions?.length
    ? spell.conditionOptions.map((value) => ({ value, label: conditionChoiceLabels[value] }))
    : [{ value: undefined, label: '' }]
  const allowedEffectDamageTypes = spell.effectDamageTypeOptions?.filter(isSelectableEffectDamageType) ?? []
  const effectDamageTypes = allowedEffectDamageTypes.length
    ? allowedEffectDamageTypes.map((value) => ({ value, label: damageTypeLabels[value] }))
    : [{ value: undefined, label: '' }]
  const enlargeReduceChoices = spell.enlargeReduceOptions?.length
    ? spell.enlargeReduceOptions.map((value) => ({ value, label: enlargeReduceLabels[value] }))
    : [{ value: undefined, label: '' }]
  const enhanceAbilityChoices = spell.enhanceAbilityOptions?.length
    ? spell.enhanceAbilityOptions.map((value) => ({ value, label: enhanceAbilityLabels[value] }))
    : [{ value: undefined, label: '' }]
  const higherSlotDamageTypes = dnd5eSpellHigherSlotDamageChoices(spell, slotLevel)
  const higherChoices = higherSlotDamageTypes.length
    ? higherSlotDamageTypes.map((value) => ({ value, label: `${damageTypeLabels[value]}升环` }))
    : [{ value: undefined, label: '' }]

  return conditionChoices.flatMap((condition) =>
    effectDamageTypes.flatMap((damageType) =>
      enlargeReduceChoices.flatMap((sizeChoice) =>
        enhanceAbilityChoices.flatMap((abilityChoice) =>
          higherChoices.map((higherChoice) => {
            const labels = [
              condition.label,
              damageType.label,
              sizeChoice.label,
              abilityChoice.label,
              higherChoice.label,
            ].filter(Boolean)
            return {
              fields: {
                conditionChoice: condition.value,
                effectDamageType: damageType.value,
                enlargeReduceChoice: sizeChoice.value,
                enhanceAbilityChoice: abilityChoice.value,
                higherSlotDamageType: higherChoice.value,
              },
              suffix: labels.length > 0 ? ` · ${labels.join(' / ')}` : '',
            }
          }),
        ),
      ),
    ),
  )
}

/**
 * Builds only spell requests that the authoritative spell preparer accepts.
 * The returned action is still re-prepared and revalidated immediately before
 * settlement; this list is presentation, never an authority grant.
 */
export function dnd5eWarCasterOpportunitySpellOptions(input: {
  actionIdPrefix: string
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  combatId: string
  round: number
  initiativeIndex: number
  actorTokenId: string
  targetTokenId: string
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Dnd5eTurnEconomyByToken
  effectiveRules?: Dnd5eEffectiveRulesContextV1 | null
  now: number
}): readonly Dnd5eWarCasterOpportunitySpellOption[] {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId)
  const character = actorToken?.characterId
    ? input.characters.find((candidate) => candidate.id === actorToken.characterId)
    : undefined
  if (!actorToken || !character) return []

  const options: Dnd5eWarCasterOpportunitySpellOption[] = []
  for (const spellId of dnd5eSelectedCombatSpellIds(character)) {
    const spell = getDnd5eSrdCombatSpell(spellId)
    if (!spell || spell.castingTime !== 'action' || spell.target === 'area' || spell.area != null) continue
    const slotLevels = spell.level === 0
      ? [0]
      : Array.from({ length: 10 - spell.level }, (_, index) => spell.level + index)
    for (const slotLevel of slotLevels) {
      const projectileCount = dnd5eSpellProjectileCount(spell, character.level, slotLevel)
      const projectileTargetIds = dnd5eSpellAllowsRepeatedTargets(spell) && projectileCount != null
        ? Array.from({ length: projectileCount }, () => input.targetTokenId)
        : undefined
      for (const choice of spellChoicePayloads(spell, slotLevel)) {
        const optionIndex = options.length
        const id = `spell:${spell.id}:${slotLevel}:${optionIndex}`
        const payload: Dnd5eSpellCastPayload = {
          spellId: spell.id,
          slotLevel,
          targetTokenId: input.targetTokenId,
          targetTokenIds: [input.targetTokenId],
          projectileTargetIds,
          opportunityAttackSpell: true,
          ...choice.fields,
        }
        const action: SharedPlayerActionState = {
          id: `${input.actionIdPrefix}:${id}`,
          mapId: input.map.id,
          combatId: input.combatId,
          sourceMode: 'dm',
          status: 'pending',
          type: 'dnd5e-spell-cast',
          actorTokenId: input.actorTokenId,
          characterId: character.id,
          targetTokenId: input.targetTokenId,
          targetTokenIds: [input.targetTokenId],
          dnd5eSpellCast: payload,
          round: input.round,
          initiativeIndex: input.initiativeIndex,
          seq: optionIndex + 1,
          updatedAt: input.now,
        }
        const prepared = prepareDnd5eSpellCast({
          action,
          map: input.map,
          characters: input.characters,
          initiativeOrder: input.initiativeOrder,
          turnEconomy: input.turnEconomy,
          turnEconomyByToken: input.turnEconomyByToken,
          effectiveRules: input.effectiveRules,
        })
        if (!prepared.ok || prepared.prepared.targetTokens.length !== 1 ||
          prepared.prepared.targetTokens[0]?.id !== input.targetTokenId ||
          prepared.prepared.sustainedEffectAttack != null) continue
        options.push({
          id,
          label: `${spell.name}（${slotLevel === 0 ? '戏法' : `${slotLevel}环`}）${choice.suffix}`,
          description: `以反应施放；只以触发借机攻击的生物为目标。`,
          action,
        })
      }
    }
  }
  return options
}
