import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'

export type CombatBannerRoute = 'turn' | 'spell' | 'attack' | 'action' | 'none'

/**
 * Exhaustive action-to-banner classification. Adding a new shared action type
 * is therefore a compile-time reminder to decide how its banner is presented.
 */
export const PLAYER_ACTION_COMBAT_BANNER_ROUTES = {
  'end-turn': 'none',
  'dnd5e-death-save': 'action',
  'dnd5e-weapon-attack': 'attack',
  'dnd5e-fighter-feature': 'action',
  'dnd5e-class-feature': 'action',
  'dnd5e-racial-action': 'action',
  'dnd5e-plugin-action': 'action',
  'dnd5e-item-use': 'action',
  'dnd5e-ability-check': 'action',
  'dnd5e-spell-cast': 'spell',
  'dnd5e-spell-whisper-reply': 'none',
  'dnd5e-persistent-area-move': 'action',
  'dnd5e-adjudicated-spell': 'spell',
  'dnd5e-map-interaction': 'none',
  'move-token': 'none',
  disengage: 'action',
  dodge: 'action',
  'dnd5e-basic-action': 'action',
} as const satisfies Record<SharedPlayerActionState['type'], CombatBannerRoute>

const BASIC_ACTION_LABELS: Readonly<Record<NonNullable<SharedPlayerActionState['dnd5eBasicAction']>['kind'], string | null>> = {
  dash: '疾走',
  hide: '躲藏',
  help: '协助',
  ready: '准备动作',
  'use-object': '使用物件',
  grapple: '擒抱',
  shove: '推撞',
  'release-grapple': null,
  'escape-grapple': null,
  'escape-effect': null,
  'dismiss-effect': null,
  'set-flame-blade-manifestation': null,
  'dismiss-warding-bond': null,
  wake: null,
  'command-animate-dead': '操纵死尸·心灵命令',
  'command-animate-objects': '活化物件·心灵命令',
  'other-action': null,
  'other-bonus-action': null,
}

function readableContentId(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const tail = value.split(':').at(-1) ?? value
  return tail.replace(/[-_]+/g, ' ').trim() || fallback
}

export function playerActionCombatBannerName(
  action: SharedPlayerActionState,
  options?: { pluginFeatureName?: (featureId: string) => string | undefined },
): string | null {
  if (PLAYER_ACTION_COMBAT_BANNER_ROUTES[action.type] !== 'action') return null
  if (action.type === 'dnd5e-death-save') return '死亡豁免'
  if (action.type === 'disengage') return '撤离'
  if (action.type === 'dodge') return '闪避'
  if (action.type === 'dnd5e-fighter-feature') {
    return action.dnd5eFighterFeature === 'second-wind' ? '回气' : '动作如潮'
  }
  if (action.type === 'dnd5e-class-feature') {
    // Attack-bearing class features already publish their individual attack
    // banners; avoid replacing the final strike with a second generic banner.
    if (action.dnd5eClassFeature?.feature === 'monk-unarmed-bonus') return null
    return readableContentId(action.dnd5eClassFeature?.feature, '职业特性')
  }
  if (action.type === 'dnd5e-racial-action') return '龙裔吐息'
  if (action.type === 'dnd5e-plugin-action') {
    const featureId = action.dnd5ePluginAction?.featureId
    const registeredName = featureId ? options?.pluginFeatureName?.(featureId)?.trim() : undefined
    return registeredName || readableContentId(featureId, '自定义特性')
  }
  if (action.type === 'dnd5e-item-use') return '使用物品'
  if (action.type === 'dnd5e-ability-check') return '属性检定'
  if (action.type === 'dnd5e-persistent-area-move') return '操控持续法术'
  if (action.type === 'dnd5e-basic-action') {
    const kind = action.dnd5eBasicAction?.kind
    return kind ? BASIC_ACTION_LABELS[kind] : '基础动作'
  }
  return '动作'
}
