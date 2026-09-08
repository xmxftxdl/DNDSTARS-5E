import type {
  MobileInterruptDescriptorV1,
  MobileInterruptRegistryV1,
  MobileInterruptView,
} from '../../../../packages/mobile-protocol/src'

export const MOBILE_INTERRUPT_REGISTRY_SCHEMA_VERSION = 1 as const

const entries: MobileInterruptDescriptorV1[] = [
  booleanEntry('dodge', '使用闪避', 'wantsDodge', '使用闪避', '不闪避'),
  booleanEntry('stable-mind', '稳定心神', 'useStableMind', '重新豁免', '保留次数'),
  booleanEntry('gale-combo', '继续连击', 'useGaleCombo', '继续连击', '结束连击'),
  booleanEntry('agile-leap', '敏捷跃动', 'useAgileLeap', '发动跃动', '不发动'),
  booleanEntry('opportunity-attack', '借机攻击', 'useOpportunityAttack', '借机攻击', '保留反应'),
  booleanEntry('protection', '防护战斗风格', 'useProtection', '使用防护', '保留反应'),
  booleanEntry('shield-spell', '护盾术', 'useShieldSpell', '施放护盾术', '不施放'),
  booleanEntry('counterspell', '反制法术', 'useCounterspell', '施放反制法术', '不反制'),
  booleanEntry('uncanny-dodge', '诡异闪避', 'useUncannyDodge', '使用诡异闪避', '保留反应'),
  booleanEntry('deflect-missiles', '拨挡飞弹', 'accept', '减免远程攻击', '不使用'),
  booleanEntry('saving-throw-reroll', '重掷豁免', 'useSavingThrowReroll', '重掷豁免', '保留次数'),
  booleanEntry('bardic-inspiration', '吟游激励', 'useBardicInspiration', '使用奖励骰', '不使用'),
  booleanEntry('cutting-words', '尖刻言辞', 'useCuttingWords', '发动尖刻言辞', '保留反应'),
  booleanEntry('dark-ones-own-luck', '黑暗幸运', 'useDarkOnesOwnLuck', '使用黑暗幸运', '不使用'),
  booleanEntry('stroke-of-luck', '幸运一击', 'useStrokeOfLuck', '发动幸运一击', '不使用'),
  { schemaVersion: 1, id: 'core.empowered-spell', interruptKind: 'empowered-spell', mode: 'empowered-spell' },
  { schemaVersion: 1, id: 'core.stand-against-tide', interruptKind: 'stand-against-tide', mode: 'target-list', optionIdKey: 'targetTokenId', optionsPayloadKey: 'candidates' },
  { schemaVersion: 1, id: 'core.plugin-choice', interruptKind: 'plugin-choice', mode: 'option-list', optionIdKey: 'optionId', optionsPayloadKey: 'options' },
  { schemaVersion: 1, id: 'core.roll-confirmation', interruptKind: 'roll-confirmation', mode: 'roll-confirmation' },
  { schemaVersion: 1, id: 'core.dm-adjudication', interruptKind: 'dm-adjudication', mode: 'host-only' },
  { schemaVersion: 1, id: 'core.legendary-resistance', interruptKind: 'legendary-resistance', mode: 'host-only' },
]

function booleanEntry(kind: string, title: string, responseKey: string, useLabel: string, declineLabel: string): MobileInterruptDescriptorV1 {
  return { schemaVersion: 1, id: `core.${kind}`, interruptKind: kind, mode: 'boolean', title, responseKey, useLabel, declineLabel }
}

export function buildMobileInterruptRegistry(): MobileInterruptRegistryV1 {
  return { schemaVersion: MOBILE_INTERRUPT_REGISTRY_SCHEMA_VERSION, generatedAt: Date.now(), entries: JSON.parse(JSON.stringify(entries)) as MobileInterruptDescriptorV1[] }
}

export function resolveMobileInterruptDescriptor(
  registry: MobileInterruptRegistryV1,
  interrupt: MobileInterruptView,
): MobileInterruptDescriptorV1 {
  const registered = registry.entries.find((entry) => entry.interruptKind === interrupt.kind)
  if (registered) return registered

  // A future Host/plugin may publish a presentation hint. Accept only the
  // closed visual vocabulary; the response still goes through Host validation.
  const hint = object(interrupt.payload.mobilePresentation)
  const mode = string(hint?.mode)
  if (hint?.schemaVersion === 1 && ['boolean', 'option-list', 'target-list'].includes(mode)) {
    const responseKey = safeResponseKey(string(hint.responseKey))
    const optionIdKey = safeResponseKey(string(hint.optionIdKey))
    if ((mode === 'boolean' && responseKey) || (mode !== 'boolean' && optionIdKey)) return {
      schemaVersion: 1,
      id: `host:${interrupt.kind}`,
      interruptKind: interrupt.kind,
      mode: mode as MobileInterruptDescriptorV1['mode'],
      title: limited(string(hint.title), 80),
      useLabel: limited(string(hint.useLabel), 48),
      declineLabel: limited(string(hint.declineLabel), 48),
      responseKey: responseKey || undefined,
      optionIdKey: optionIdKey || undefined,
      optionsPayloadKey: safePayloadKey(string(hint.optionsPayloadKey)) || 'options',
    }
  }
  if (Array.isArray(interrupt.payload.options)) return {
    schemaVersion: 1, id: `host-options:${interrupt.kind}`, interruptKind: interrupt.kind,
    mode: 'option-list', optionIdKey: 'optionId', optionsPayloadKey: 'options',
  }
  return { schemaVersion: 1, id: `unsupported:${interrupt.kind}`, interruptKind: interrupt.kind, mode: 'host-only' }
}

export function safeInterruptOptions(interrupt: MobileInterruptView, descriptor: MobileInterruptDescriptorV1) {
  const source = interrupt.payload[descriptor.optionsPayloadKey || 'options']
  if (!Array.isArray(source)) return []
  return source.slice(0, 32).flatMap((candidate) => {
    const entry = object(candidate)
    const id = string(entry?.id) || string(entry?.tokenId)
    const label = string(entry?.label)
    if (!id || !label) return []
    return [{ id: limited(id, 160), label: limited(label, 96), description: limited(string(entry?.description), 240) || undefined }]
  })
}

function safeResponseKey(value: string) {
  return /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value) ? value : ''
}
function safePayloadKey(value: string) {
  return /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value) ? value : ''
}
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function string(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function limited(value: string, maximum: number) { return value.slice(0, maximum) }
