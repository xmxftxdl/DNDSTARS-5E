import type { Token } from '../store/maps'
import type { Character, ClassFeatureKey, Trait } from '../types/character'
import { canArmDoubleArrow, eagleEyeDexBonus } from './classFeatures'
import { getClassResourceCurrent } from './classResources'
import { isCalmMindActive, isOutOfBreath } from './calmMind'
import type {
  HeadlessActivateFeatureAction,
  HeadlessCombatEvent,
  HeadlessCombatResult,
  HeadlessDiceRoller,
  HeadlessDmCombatState,
} from './headlessDmCombatEngine'

export type FeatureUiTone = 'amber' | 'sky' | 'rose' | 'fuchsia'

export interface FeatureStatusView {
  text: string
  tone: 'amber' | 'sky' | 'rose' | 'cyan' | 'lime' | 'emerald' | 'teal' | 'orange' | 'fuchsia'
}

export interface FeatureActivationButtonView {
  label: string
  disabled: boolean
  tone: FeatureUiTone
}

export interface FeaturePresentationView {
  statuses: FeatureStatusView[]
  activation?: FeatureActivationButtonView
  auxiliary?: 'wilderness-checks'
}

export interface FeatureActivationContract {
  key: ClassFeatureKey
  apCost: number
  resourceCost?: { key: string; amount: number }
  requiresUse: boolean
  toggleActive?: (character: Character) => boolean
  buildPresentation?: (character: Character, trait: Trait) => FeaturePresentationView
}

export interface HeadlessFeatureActivationContext {
  state: HeadlessDmCombatState
  action: HeadlessActivateFeatureAction
  actorToken: Token
  actor: Character
  trait: Trait
  dice: HeadlessDiceRoller
  events: HeadlessCombatEvent[]
}

export type HeadlessFeatureActivationResolver = (
  context: HeadlessFeatureActivationContext,
) => HeadlessCombatResult

const contracts = new Map<ClassFeatureKey, FeatureActivationContract>()
const resolvers = new Map<ClassFeatureKey, HeadlessFeatureActivationResolver>()

export function registerFeatureActivationContract(contract: FeatureActivationContract): () => void {
  const previous = contracts.get(contract.key)
  contracts.set(contract.key, contract)
  return () => {
    if (contracts.get(contract.key) !== contract) return
    if (previous) contracts.set(contract.key, previous)
    else contracts.delete(contract.key)
  }
}

export function featureActivationContract(key: ClassFeatureKey): FeatureActivationContract | undefined {
  return contracts.get(key)
}

export function registerHeadlessFeatureActivationResolver(
  key: ClassFeatureKey,
  resolver: HeadlessFeatureActivationResolver,
): () => void {
  const previous = resolvers.get(key)
  resolvers.set(key, resolver)
  return () => {
    if (resolvers.get(key) !== resolver) return
    if (previous) resolvers.set(key, previous)
    else resolvers.delete(key)
  }
}

export function headlessFeatureActivationResolver(
  key: ClassFeatureKey,
): HeadlessFeatureActivationResolver | undefined {
  return resolvers.get(key)
}

export function buildFeaturePresentation(character: Character, trait: Trait): FeaturePresentationView {
  if (!trait.featureKey) return { statuses: [] }
  return featureActivationContract(trait.featureKey)?.buildPresentation?.(character, trait) ?? { statuses: [] }
}

function standardActivation(
  character: Character,
  trait: Trait,
  options: {
    apCost: number
    resourceCost?: { key: string; amount: number }
    active?: boolean
    activeLabel?: string
    label?: string
    tone?: FeatureUiTone
    requiresUse?: boolean
  },
): FeatureActivationButtonView {
  const resourceEnough = options.resourceCost
    ? getClassResourceCurrent(character, options.resourceCost.key) >= options.resourceCost.amount
    : true
  const disabled = !options.active && (
    character.currentAP < options.apCost ||
    ((options.requiresUse ?? true) && trait.uses <= 0) ||
    !resourceEnough
  )
  const costs = [
    options.apCost > 0 ? `${options.apCost} AP` : '',
    options.resourceCost ? `${options.resourceCost.amount} ${options.resourceCost.key === 'qi' ? '气' : options.resourceCost.key}` : '',
    trait.maxUses > 0 ? `${trait.uses}/${trait.maxUses}` : '',
  ].filter(Boolean)
  return {
    disabled,
    tone: options.tone ?? 'fuchsia',
    label: options.active
      ? (options.activeLabel ?? '已激活 · 点击取消')
      : (options.label ?? `激活（${costs.join(' · ')}）`),
  }
}

function registerBuiltins(): void {
  const define = (contract: FeatureActivationContract) => registerFeatureActivationContract(contract)

  define({
    key: 'doubleArrow', apCost: 1, requiresUse: true,
    toggleActive: (character) => !!character.combatBuffs?.doubleArrowReady,
    buildPresentation: (character, trait) => {
      const active = !!character.combatBuffs?.doubleArrowReady
      return {
        statuses: active ? [{ text: '双箭已就绪，等待单箭射击', tone: 'amber' }] : [],
        activation: {
          ...standardActivation(character, trait, {
            apCost: 1,
            active,
            activeLabel: '双箭已就绪 · 点击取消',
            label: trait.uses > 0 ? `启用双箭（${trait.uses}/${trait.maxUses}）` : '本场次数已用完',
            tone: 'amber',
          }),
          disabled: (!canArmDoubleArrow(character) || character.currentAP < 1) && !active,
        },
      }
    },
  })
  define({
    key: 'eagleEye', apCost: 1, requiresUse: true,
    buildPresentation: (character, trait) => {
      const turns = character.combatBuffs?.eagleEyeTurns ?? 0
      return {
        statuses: turns > 0
          ? [{ text: `鹰眼进行中：剩余 ${turns} 回合 · 敏捷 +${eagleEyeDexBonus(trait.level)}`, tone: 'sky' }]
          : [],
        activation: standardActivation(character, trait, {
          apCost: 1,
          label: turns > 0
            ? `鹰眼进行中（${turns} 回合）· 再次激活刷新（${trait.uses}/${trait.maxUses}）`
            : `激活鹰眼（3 回合 · ${trait.uses}/${trait.maxUses}）`,
          tone: 'sky',
        }),
      }
    },
  })
  define({
    key: 'preciseStrike', apCost: 1, requiresUse: true,
    toggleActive: (character) => !!character.combatBuffs?.preciseStrikeReady,
    buildPresentation: (character, trait) => {
      const active = !!character.combatBuffs?.preciseStrikeReady
      return {
        statuses: active ? [{ text: '精准打击已就绪', tone: 'rose' }] : [],
        activation: standardActivation(character, trait, {
          apCost: 1,
          active,
          activeLabel: '精准打击已就绪 · 点击取消',
          label: character.currentAP < 1
            ? '行动点不足（需要 1 AP）'
            : `启用精准打击（1 AP · ${trait.uses}/${trait.maxUses}）`,
          tone: 'rose',
        }),
      }
    },
  })
  define({
    key: 'wildernessGuide', apCost: 1, requiresUse: true,
    buildPresentation: (character, trait) => ({
      statuses: character.combatBuffs?.wildernessGuideBoost
        ? [{ text: '特殊指引已激活', tone: 'emerald' }]
        : [],
      activation: standardActivation(character, trait, { apCost: 1 }),
      auxiliary: 'wilderness-checks',
    }),
  })
  define({
    key: 'calmMind', apCost: 0, requiresUse: false,
    buildPresentation: (character, trait) => ({
      statuses: [
        ...(isCalmMindActive(character)
          ? [{ text: `静心状态 · 伤害骰 +${trait.level}D6`, tone: 'teal' as const }]
          : []),
        ...(isOutOfBreath(character)
          ? [{
              text: `气喘状态 · 所有攻击获得劣势${(character.combatBuffs?.outOfBreathTurns ?? 0) > 0 ? ` · 剩余 ${character.combatBuffs!.outOfBreathTurns} 回合` : ''}`,
              tone: 'orange' as const,
            }]
          : []),
      ],
    }),
  })
  define({
    key: 'galeCombo', apCost: 0, requiresUse: false,
    buildPresentation: (character) => ({
      statuses: character.combatBuffs?.galeComboReady
        ? [{ text: '疾风连击已就绪 · 下次技能/基础射击免 AP', tone: 'cyan' }]
        : [],
    }),
  })
  define({
    key: 'agileLeap', apCost: 0, requiresUse: false,
    buildPresentation: (character) => ({
      statuses: (character.combatBuffs?.agileLeapMoveFeet ?? 0) > 0
        ? [{ text: `灵巧跳跃：点击地图移动至多 ${character.combatBuffs!.agileLeapMoveFeet} 尺`, tone: 'lime' }]
        : [],
    }),
  })

  for (const [key, apCost, requiresUse, resourceCost] of [
    ['stillWater', 1, false, undefined],
    ['finale', 2, true, undefined],
    ['illusionDance', 1, true, { key: 'qi', amount: 1 }],
    ['shadowVeil', 1, true, undefined],
    ['trackingArrow', 1, true, undefined],
    ['flexibleBody', 1, false, { key: 'qi', amount: 1 }],
    ['showtime', 1, true, { key: 'qi', amount: 1 }],
    ['windBlade', 0, false, { key: 'qi', amount: 1 }],
  ] as const) {
    define({
      key,
      apCost,
      requiresUse,
      resourceCost,
      toggleActive: key === 'finale' ? (character) => !!character.combatBuffs?.finaleReady : undefined,
      buildPresentation: (character, trait) => {
        const active = key === 'finale' && !!character.combatBuffs?.finaleReady
        return {
          statuses: active ? [{ text: '曲终待触发', tone: 'fuchsia' }] : [],
          activation: standardActivation(character, trait, {
            apCost,
            resourceCost,
            requiresUse,
            active,
            activeLabel: '曲终待触发 · 点击取消',
          }),
        }
      },
    })
  }
}

registerBuiltins()
