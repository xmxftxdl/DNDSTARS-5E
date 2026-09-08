import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { RegisteredContentDefinition } from '../../../domain/content/contentDefinitionRegistry'
import type { Dnd5ePluginSpellDefinition } from '../pluginApi'
import type { RegisteredDnd5ePluginSpell } from '../plugins/pluginRegistryContracts'
import { DND5E_SRD_SPELL_CATALOG } from '../spellCatalog'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from '../spellDescriptionsZh.reviewed.generated'
import type { Dnd5eImportedSpell } from '../spellbook'
import {
  DND5E_SRD_AUDITED_SPELL_DECISIONS_V1,
} from './dnd5eSrdAuditedSpellDecisions'
export {
  dnd5eSrdAuditedSpellDecisionV1,
  type Dnd5eSrdAuditedSpellTargetV1,
} from './dnd5eSrdAuditedSpellDecisions'
import { dnd5eActivityFromSpellDefinition } from './legacyContentActivityAdapters'
import type {
  Dnd5eActivityChoiceOptionV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityOperationV1,
} from './dnd5eActivityContracts'
import type { Dnd5eEffectDefinitionV1 } from './dnd5eEffectContracts'
import type { AbilityKey } from '../../../lib/dnd'
import { DND5E_DAMAGE_TYPES } from '../damageTypes'
import { DND5E_SRD_MONSTERS } from '../monsters'
import { dnd5eChallengeRatingValue } from '../wildShape'
import { dnd5eCoreSpellMaterialRequirement } from '../spellMaterials'

export const DND5E_SRD_AUDITED_SPELL_PACKAGE_ID = 'srd-5.1'
export const DND5E_SRD_AUDITED_SPELL_PACKAGE_VERSION = '1.0.2'

const decisions = DND5E_SRD_AUDITED_SPELL_DECISIONS_V1
const catalogById = new Map(DND5E_SRD_SPELL_CATALOG.map((spell) => [spell.id, spell]))

const SCHOOL_IDS: Readonly<Record<string, Dnd5eImportedSpell['school']>> = {
  防护: 'abjuration',
  咒法: 'conjuration',
  预言: 'divination',
  附魔: 'enchantment',
  塑能: 'evocation',
  幻术: 'illusion',
  死灵: 'necromancy',
  变化: 'transmutation',
}

/** Shapes stated in spell bodies rather than in the SRD range header. */
const AUDITED_AREA_SHAPES: Readonly<Record<string, {
  shape: NonNullable<Dnd5eImportedSpell['range']['shape']>
  sizeFeet: number
  widthFeet?: number
}>> = {
  alarm: { shape: 'cube', sizeFeet: 20 },
  'antilife-shell': { shape: 'radius', sizeFeet: 10 },
  'antimagic-field': { shape: 'radius', sizeFeet: 10 },
  'antipathy-sympathy': { shape: 'radius', sizeFeet: 60 },
  'delayed-blast-fireball': { shape: 'sphere', sizeFeet: 20 },
  earthquake: { shape: 'radius', sizeFeet: 100 },
  'faithful-hound': { shape: 'radius', sizeFeet: 5 },
  'fire-storm': { shape: 'cube', sizeFeet: 10 },
  forbiddance: { shape: 'cube', sizeFeet: 200 },
  forcecage: { shape: 'cube', sizeFeet: 20 },
  'globe-of-invulnerability': { shape: 'sphere', sizeFeet: 10 },
  confusion: { shape: 'sphere', sizeFeet: 10 },
  'guardian-of-faith': { shape: 'radius', sizeFeet: 10 },
  'gust-of-wind': { shape: 'line', sizeFeet: 60, widthFeet: 10 },
  hallow: { shape: 'radius', sizeFeet: 60 },
  'incendiary-cloud': { shape: 'sphere', sizeFeet: 20 },
  'magic-circle': { shape: 'cylinder', sizeFeet: 10 },
  'private-sanctum': { shape: 'cube', sizeFeet: 100 },
  'plant-growth': { shape: 'radius', sizeFeet: 100 },
  'reverse-gravity': { shape: 'cylinder', sizeFeet: 50 },
  'silent-image': { shape: 'cube', sizeFeet: 15 },
  'storm-of-vengeance': { shape: 'radius', sizeFeet: 360 },
  'tiny-hut': { shape: 'sphere', sizeFeet: 10 },
  weird: { shape: 'sphere', sizeFeet: 30 },
  'zone-of-truth': { shape: 'sphere', sizeFeet: 15 },
}

function firstPositiveInteger(value: string, fallback = 1): number {
  const match = value.match(/(\d+)/)
  return match ? Math.max(1, Number(match[1])) : fallback
}

function castingTime(value: string): Dnd5eImportedSpell['castingTime'] {
  const amount = firstPositiveInteger(value)
  if (value.includes('附赠动作')) return { value: amount, unit: 'bonus-action' }
  if (value.includes('反应')) {
    const reactionTrigger = value.split(/[，,]/).slice(1).join('，').trim()
    return { value: amount, unit: 'reaction', ...(reactionTrigger ? { reactionTrigger } : {}) }
  }
  if (value.includes('分钟')) return { value: amount, unit: 'minute' }
  if (value.includes('小时')) return { value: amount, unit: 'hour' }
  return { value: amount, unit: 'action' }
}

function range(value: string): Dnd5eImportedSpell['range'] {
  const self = value.startsWith('自身')
  const type: Dnd5eImportedSpell['range']['type'] = self
    ? 'self'
    : value.includes('触及')
      ? 'touch'
      : value.includes('视线')
        ? 'sight'
        : value.includes('无限')
          ? 'unlimited'
          : value.includes('特殊')
            ? 'special'
            : 'distance'
  const miles = value.match(/(\d+)\s*英里/)
  // Activity V1 caps finite map ranges at 100,000 feet. On any supported
  // battle map that is effectively unlimited while the reviewed rules text
  // remains the canonical source for the true long-distance range.
  const feet = Math.min(100_000, miles ? Number(miles[1]) * 5_280 : firstPositiveInteger(value, 0))
  const shape: Dnd5eImportedSpell['range']['shape'] | undefined = value.includes('锥')
    ? 'cone'
    : value.includes('直线') || value.includes('线状')
      ? 'line'
      : value.includes('立方')
        ? 'cube'
        : value.includes('圆柱')
          ? 'cylinder'
          : value.includes('球形')
            ? 'sphere'
            : value.includes('半径')
              ? 'radius'
              : undefined
  const parenthesized = value.match(/[（(]([^）)]+)[）)]/)?.[1] ?? ''
  const sizeFeet = shape ? firstPositiveInteger(parenthesized || value, 5) : undefined
  return {
    type,
    ...((type === 'distance' || type === 'special') && feet > 0 ? { feet } : {}),
    ...(shape ? { shape, sizeFeet } : {}),
  }
}

function components(value: string): Dnd5eImportedSpell['components'] {
  const material = value.includes('材料')
  const materialText = material ? value.match(/材料[（(]([^）)]+)[）)]/)?.[1]?.trim() : undefined
  return {
    verbal: value.includes('言语'),
    somatic: value.includes('姿势'),
    material,
    ...(materialText ? { materialText } : {}),
  }
}

function duration(value: string): Dnd5eImportedSpell['duration'] {
  const concentration = value.includes('专注')
  if (value.includes('立即')) return { type: 'instantaneous', concentration: false }
  if (value.includes('直到被解除') || value.includes('直至被解除')) {
    return { type: 'until-dispelled', concentration }
  }
  const amount = firstPositiveInteger(value)
  const unit: Dnd5eImportedSpell['duration']['unit'] | undefined = value.includes('轮')
    ? 'round'
    : value.includes('分钟')
      ? 'minute'
      : value.includes('小时')
        ? 'hour'
        : value.includes('日') || value.includes('天')
          ? 'day'
          : undefined
  return unit
    ? { type: 'timed', value: amount, unit, concentration }
    : { type: 'special', concentration }
}

function targeting(
  spellId: string,
  parsedRange: Dnd5eImportedSpell['range'],
): Dnd5eImportedSpell['targeting'] {
  if (parsedRange.type === 'self' && !parsedRange.shape) {
    return { relation: 'any', includeSelf: true, maximumTargets: 1 }
  }
  const hostile = new Set([
    'animal-friendship', 'compulsion', 'contagion',
    'enthrall', 'eyebite', 'fear', 'feeblemind', 'flesh-to-stone', 'guardian-of-faith',
    'irresistible-dance', 'ray-of-enfeeblement', 'weird',
  ]).has(spellId)
  const allied = new Set([
    'aid', 'beacon-of-hope', 'foresight', 'freedom-of-movement',
    'gaseous-form', 'glibness', 'haste', 'heroes-feast', 'holy-aura', 'mind-blank',
    'pass-without-trace', 'protection-from-evil-and-good', 'regenerate', 'raise-dead',
    'resurrection', 'revivify', 'spider-climb', 'stoneskin', 'telepathic-bond',
    'true-resurrection', 'true-seeing', 'water-breathing', 'water-walk', 'wind-walk',
  ]).has(spellId)
  const maximumTargets: Readonly<Record<string, number>> = {
    aid: 3,
    'beacon-of-hope': 256,
    compulsion: 256,
    'divine-word': 256,
    enthrall: 256,
    'feather-fall': 5,
    // Giant Insect has a form-dependent cap: 10 centipedes, 3 spiders,
    // 5 wasps, or 1 scorpion.  Keep the Activity ceiling at the largest
    // rules-legal group so the player can actually declare every target;
    // the existing DM boundary remains responsible for confirming the
    // selected insect form and its narrower per-form cap.
    'giant-insect': 10,
    'heroes-feast': 12,
    'holy-aura': 256,
    passwall: 256,
    'pass-without-trace': 256,
    'telepathic-bond': 8,
    'water-breathing': 10,
    'water-walk': 10,
    weird: 256,
    // Wind Walk affects the caster plus up to ten willing creatures.
    'wind-walk': 11,
  }
  return {
    relation: hostile ? 'enemy' : allied ? 'ally' : 'any',
    // Non-hostile and world-state spells may be anchored on the caster while
    // their closed Activity state remains Host-owned.
    // A self-origin line starts at the caster's space but does not force the
    // caster to become one of its occupants. In particular, Gust of Wind must
    // not make its own caster save against the wind at the start of each turn.
    includeSelf: spellId === 'gust-of-wind' || spellId === 'prismatic-spray'
      ? false
      : !hostile,
    maximumTargets: maximumTargets[spellId] ?? (parsedRange.shape ? 256 : 1),
  }
}

function pluginSpell(id: string): RegisteredDnd5ePluginSpell | undefined {
  const catalog = catalogById.get(id)
  const reference = DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED[id]
  const decision = decisions[id] ?? (id === 'minor-illusion'
    ? ['full', 'action-economy'] as const
    : undefined)
  // Minor Illusion is present in the legacy combat catalog but intentionally
  // uses the audited action-only Activity instead of the old image/sound and
  // DM-approval route. It therefore has no catalog-only migration decision.
  if (!catalog || !reference || !decision) return undefined
  const parsedRange = range(reference.range)
  const auditedArea = AUDITED_AREA_SHAPES[id]
  const effectiveRange = auditedArea
    ? {
        ...parsedRange,
        shape: auditedArea.shape,
        sizeFeet: auditedArea.sizeFeet,
        ...(auditedArea.widthFeet != null ? { widthFeet: auditedArea.widthFeet } : {}),
      }
    : parsedRange
  const effectiveHeadlessTarget = id === 'magic-mouth'
    ? 'partial'
    : id === 'disguise-self' || id === 'illusory-script' || id === 'mirage-arcane'
      ? 'full'
      : decision[0]
  return {
    id,
    name: catalog.name,
    englishName: catalog.englishName,
    level: catalog.level,
    school: SCHOOL_IDS[reference.school],
    ritual: reference.ritual,
    castingTime: castingTime(reference.castingTime),
    range: effectiveRange,
    targeting: targeting(id, effectiveRange),
    components: components(reference.components),
    duration: duration(reference.duration),
    classes: catalog.classes.filter((classId): classId is Dnd5eImportedSpell['classes'][number] =>
      ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'].includes(classId)),
    description: reference.description,
    ...(reference.higherLevels ? { higherLevels: reference.higherLevels } : {}),
    ...(id === 'animal-friendship' ? {
      mechanics: {
        kind: 'utility' as const,
        resolution: 'automatic' as const,
        upcast: {
          fromSlotLevel: 1,
          effects: [{ kind: 'additional-targets' as const, countPerSlot: 1 }],
        },
      },
    } : id === 'magic-circle' ? {
      mechanics: {
        kind: 'utility' as const,
        resolution: 'automatic' as const,
        upcast: {
          fromSlotLevel: 3,
          effects: [{ kind: 'duration-rounds' as const, roundsPerSlot: 600 }],
        },
      },
    } : {}),
    tags: ['srd-5.1', `headless-target:${effectiveHeadlessTarget}`, ...decision.slice(1)],
    source: {
      title: 'System Reference Document 5.1',
      publisher: 'Wizards of the Coast',
      license: 'CC BY 4.0',
    },
    automation: { mode: 'headless-action', actionId: `spell:${id}` },
    ownerPluginId: DND5E_SRD_AUDITED_SPELL_PACKAGE_ID,
    ownerPluginName: 'SRD 5.1',
    ownerPluginLicense: 'CC BY 4.0',
  }
}

/**
 * Keeps open-ended SRD information gathering inside the shared DM boundary
 * without dropping the deterministic outer spell transaction. The Host still
 * owns spell slots, costly/consumed materials and long casting time; only the
 * answer itself remains a DM decision.
 */
function manualActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const decision = decisions[spell.id]!
  return {
    ...activity,
    outcomes: [{
      id: 'dm-boundary',
      when: { kind: 'always' },
      operations: [{
        id: 'dm-adjudication',
        kind: 'manual-adjudication',
        prompt: `记录施法者为${spell.name}声明的人物、地点、物件或问题，并提交准确的 DM 回答。`,
        reason: `开放式规则结果：${decision.slice(1).join('、')}`,
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      '法术位、材料与施法时间由 Host 管理；开放式信息由 DM 裁定。',
    ]),
  }
}

function magicMouthActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: { kind: 'self' },
    outcomes: [{
      id: 'dm-boundary',
      when: { kind: 'always' },
      operations: [{
        id: 'magic-mouth-dm-adjudication', kind: 'manual-adjudication',
        prompt: '玩家通过语音声明附魔物件、最多 25 个词的讯息、可见或可听触发条件及是否重复；全部效果由 DM 记录与触发。',
        reason: '魔嘴术的开放式物件与感官触发条件不进入地图自动化。',
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('manual', [
      '只由 Host 校验施法资格和资源；附魔对象、讯息与触发全部交由 DM。',
    ]),
  }
}

/**
 * Continual Flame enchants a physical object, which has no durable object
 * identity in the shared map model.  Keep the deterministic casting cost in
 * the Host, but deliberately leave the chosen object and its permanent light
 * in the voice/DM record instead of presenting a creature or map-object
 * picker that would imply an authoritative object binding.
 */
function continualFlameActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: { kind: 'self' },
    outcomes: [{
      id: 'dm-object-narration',
      when: { kind: 'always' },
      operations: [{
        id: 'continual-flame-dm-adjudication',
        kind: 'manual-adjudication',
        prompt: '施法者通过语音声明所触及的非魔法物件。确认价值 50 gp 的红宝石粉末已消耗；该物件发出 20 尺明亮光和额外 20 尺微光，不产生热或消耗氧气，可被遮挡但不能被扑灭或浸灭，直至被解除魔法。物件身份、携带与遮挡状态均由 DM 记录。',
        reason: '物件不是当前地图的权威实体；不显示生物或地图物件目标弹窗，也不创建伪造的地图光源。',
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 自动校验施法动作、法术位与会被消耗的 50 gp 红宝石粉末。',
      '被触及物件及其永久光照、携带、遮挡和解除效果只通过语音/DM 叙事记录，不创建对象交互 UI。',
    ]),
  }
}

/**
 * Control Water needs a real open-water volume and terrain semantics the map
 * does not own. Do not default that environment spell to a creature picker;
 * the player declares one printed mode and the water volume in the shared
 * voice/DM record while Host settles the casting transaction.
 */
function controlWaterActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: { kind: 'self' },
    outcomes: [{
      id: 'dm-environment-narration',
      when: { kind: 'always' },
      operations: [{
        id: 'control-water-dm-adjudication',
        kind: 'manual-adjudication',
        prompt: '确认操控水体的模式、至多 100 尺立方开放水体与场景结果；洪水、分水、改流和漩涡不创建虚假的生物目标。',
        reason: '开放水体、地形几何、环境状态与漩涡中的生物／物件交互由 DM 裁定。',
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 校验施法成分与法术位；模式、水体体积、地形变化、载具和漩涡交互由房间内置语音与 DM 记录。',
    ]),
  }
}

/**
 * Control Weather changes the table's regional weather rather than a map
 * token or map template. The actual sky, season and later weather changes
 * are shared by voice, while Host owns the casting transaction and its
 * bounded declaration record.
 */
function controlWeatherActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: { kind: 'self' },
    outcomes: [{
      id: 'weather-voice-declaration',
      when: { kind: 'always' },
      operations: [{
        id: 'control-weather-voice-declaration',
        kind: 'mechanic',
        target: 'actor',
        handlerId: 'core.resolve-only',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 校验施法成分、法术位和 10 分钟施法耗时，并记录户外、天空、5 英里范围、天气阶段与生效延迟的声明。',
      '当前天气、季节、实际风向以及法术期间的后续天气变化由房间内置语音处理，不创建地图生物、范围模板、伤害或虚假的天气状态。',
    ]),
  }
}

function messageActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    // Message is intentionally action-only in the tabletop runtime. Its
    // narrative content is handled at the table and must not open a private
    // chat, target picker, reply window or DM adjudication transaction.
    target: { kind: 'self' },
    outcomes: [{
      id: 'message-action-only',
      when: { kind: 'always' },
      operations: [{
        id: 'message-resolved', kind: 'mechanic', target: 'actor',
        handlerId: 'core.resolve-only',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

/**
 * Legend Lore deliberately settles only the authoritative casting resources.
 * Its narrative answer remains at the table and must not create or wait for a
 * DM/Headless adjudication transaction after the ten-minute cast completes.
 */
function legendLoreActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: { kind: 'self' },
    outcomes: [{
      id: 'legend-lore-resource-only',
      when: { kind: 'always' },
      operations: [{
        id: 'legend-lore-resolved', kind: 'mechanic', target: 'actor',
        handlerId: 'core.resolve-only',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

/**
 * Planar Binding is intentionally resource-only in the tabletop UI. The
 * bound creature and command semantics remain at the table, but they must not
 * create a creature picker, saving throw, or blocking DM confirmation after
 * the long cast has spent its authoritative resources.
 */
function planarBindingActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: { kind: 'self' },
    requirements: undefined,
    checks: undefined,
    choices: undefined,
    effects: undefined,
    outcomes: [{
      id: 'planar-binding-resource-only',
      when: { kind: 'always' },
      operations: [{
        id: 'planar-binding-resolved', kind: 'mechanic', target: 'actor',
        handlerId: 'core.resolve-only',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

/**
 * Move Earth selects terrain, never a creature. The Host owns the bounded
 * square, casting resources and concentration marker; the table/DM decides
 * every actual terrain change without an additional approval interrupt.
 */
function moveEarthActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'rect',
      placeRangeFeet: 120,
      widthFeet: 40, minimumWidthFeet: 5,
      lengthFeet: 40, minimumLengthFeet: 5,
      heightFeet: 5,
      maximumTargets: 256, includeSelf: true,
      gridAligned: true,
      rotatable: false,
      requiresLineOfSight: false,
      requiresLineOfEffect: true,
    },
    outcomes: [{
      id: 'move-earth-area',
      when: { kind: 'always' },
      operations: [{
        id: 'create-move-earth-area',
        kind: 'create-persistent-area',
        label: spell.name,
        durationRounds: auditedDurationRounds(spell),
        concentration: true,
        color: '#d97706',
        anchorMode: 'fixed',
      }],
    }],
    // The VTT transaction is complete once the bounded area is persisted.
    // Slow terrain reshaping remains ordinary table adjudication and must not
    // be represented as a blocking Headless confirmation step.
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

function minorIllusionActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    // The tabletop owns the illusion's appearance, sound and discovery. The
    // digital transaction deliberately records only the printed action cost;
    // it must not ask for a mode, create a map entity or pause for DM approval.
    target: { kind: 'self' },
    outcomes: [{
      id: 'minor-illusion-action-only',
      when: { kind: 'always' },
      operations: [{
        id: 'minor-illusion-resolved', kind: 'mechanic', target: 'actor',
        handlerId: 'core.resolve-only',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

function antipathySympathyActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const auraTarget = {
    kind: 'area' as const, relation: 'any' as const, origin: 'point' as const,
    shape: 'circle' as const, placeRangeFeet: 60, radiusFeet: 60,
    maximumTargets: 256, includeSelf: true,
    requiresLineOfSight: false, requiresLineOfEffect: true,
  }
  return {
    ...activity,
    target: auraTarget,
    choices: [{
      id: 'mode', label: '灵光效应', defaultOptionId: 'antipathy', options: [
        { id: 'antipathy', label: '嫌恶', description: '指定类别的生物会被排斥；失败时陷入恐慌并远离目标。' },
        { id: 'sympathy', label: '关怀', description: '指定类别的生物会被吸引；失败时必须接近目标。' },
      ],
    }, {
      id: 'target-form', label: '灵光目标', defaultOptionId: 'creature', options: [
        {
          id: 'creature', label: '巨型或更小的生物（以地图落点表示）',
          description: '选择生物当前中心；其后续移动由 DM 按裁定备注跟踪。',
          targetOverride: auraTarget,
        },
        {
          id: 'area', label: '区域（最大 200 尺立方）',
          description: '选择 5–200 尺立方区域；边长在下一步填写。',
          targetOverride: {
            kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
            placeRangeFeet: 60,
            lengthFeet: 200, widthFeet: 200, heightFeet: 200,
            minimumLengthFeet: 5, minimumWidthFeet: 5, minimumHeightFeet: 5,
            maximumTargets: 256, includeSelf: true,
            requiresLineOfSight: false, requiresLineOfEffect: true,
          },
        },
      ],
    }],
    outcomes: [{
      id: 'persistent-aura', when: { kind: 'always' }, operations: [{
        id: 'antipathy-sympathy-aura', kind: 'create-persistent-area',
        label: spell.name,
        durationRounds: 144_000,
        concentration: false,
        color: '#c026d3',
        visual: { preset: 'arcane', intensity: 'subtle' },
        anchorMode: 'fixed',
      }],
    }, {
      id: 'dm-boundary', when: { kind: 'always' }, operations: [{
        id: 'antipathy-sympathy-adjudication', kind: 'manual-adjudication',
        prompt: '确认玩家声明的嫌恶/关怀模式、目标种类与智慧生物类别。按 60 尺或视线触发感知豁免；嫌恶失败时恐慌并远离，关怀失败时接近且不能自愿远离。目标造成伤害、回合结束时远离且不可见、每 24 小时及成功后的 1 分钟免疫均由 DM 跟踪。',
        reason: '生物类别是开放文本，且视线、强制移动、安全地点、目标危害和每 24 小时重试都依赖实时场景语义。',
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
       'Host 自动校验 60 尺施法距离、1 小时施法时间、8/9 环法术位、10 天且无需专注的地图记录；生物或区域目标、模式、智慧生物类别和区域边长由玩家结构化声明，物体目标只通过语音叙事。',
    ]),
  }
}

function bestowCurseActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const source = spell as Dnd5ePluginSpellDefinition
  const base = dnd5eActivityFromSpellDefinition(source, 'headless-action')
  const ordinaryProfiles: NonNullable<Dnd5eEffectDefinitionV1['castLevelProfiles']> = [{
    minimumCastLevel: 3,
    duration: { kind: 'concentration', maximumRounds: 10 },
    concentration: true,
  }, {
    minimumCastLevel: 4,
    duration: { kind: 'concentration', maximumRounds: 100 },
    concentration: true,
  }, {
    minimumCastLevel: 5,
    duration: { kind: 'rounds', rounds: 4_800, expiresAt: 'target-turn-end' },
    concentration: false,
  }, {
    minimumCastLevel: 7,
    duration: { kind: 'rounds', rounds: 14_400, expiresAt: 'target-turn-end' },
    concentration: false,
  }, {
    minimumCastLevel: 9,
    duration: { kind: 'permanent' },
    concentration: false,
  }]
  const turnLossProfiles: NonNullable<Dnd5eEffectDefinitionV1['castLevelProfiles']> = ordinaryProfiles.map(
    (profile) => ({
      ...profile,
      // This option repeats a save every turn without ending on a success.
      // Keep the repeat-save carrier bounded at 9th level; the Host treats its
      // semantic tag as until-dispelled rather than removing it on a success.
      duration: profile.minimumCastLevel === 9
        ? {
            kind: 'save-ends' as const,
            maximumRounds: 5_256_000,
            timing: 'target-turn-start' as const,
            ability: 'wis' as const,
            dc: { kind: 'reference' as const, reference: { kind: 'actor-spell-save-dc' as const } },
          }
        : {
            kind: 'save-ends' as const,
            maximumRounds: profile.duration.kind === 'concentration'
              ? profile.duration.maximumRounds
              : profile.duration.kind === 'rounds'
                ? profile.duration.rounds
                : 5_256_000,
            timing: 'target-turn-start' as const,
            ability: 'wis' as const,
            dc: { kind: 'reference' as const, reference: { kind: 'actor-spell-save-dc' as const } },
          },
    }),
  )
  const duration = ordinaryProfiles[0].duration
  const abilityEffects: Dnd5eEffectDefinitionV1[] = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const)
    .map((ability) => ({
      schemaVersion: 1,
      id: `bestow-curse-${ability}`,
      name: `${spell.name}·${ability.toUpperCase()}劣势`,
      disposition: 'debuff',
      tags: ['curse', 'bestow-curse', `bestow-curse.ability.${ability}`],
      duration,
      castLevelProfiles: ordinaryProfiles,
      modifiers: [
        { kind: 'ability-check', ability, mode: 'disadvantage' },
        { kind: 'saving-throw', ability, mode: 'disadvantage' },
      ],
      stacking: 'replace',
      concentration: true,
    }))
  const modeEffects: Dnd5eEffectDefinitionV1[] = [{
    schemaVersion: 1,
    id: 'bestow-curse-attacks-against-source',
    name: `${spell.name}·攻击施法者劣势`,
    disposition: 'debuff',
    tags: ['curse', 'bestow-curse', 'bestow-curse.attacks-against-source'],
    duration,
    castLevelProfiles: ordinaryProfiles,
    stacking: 'replace',
    concentration: true,
  }, {
    schemaVersion: 1,
    id: 'bestow-curse-lose-action',
    name: `${spell.name}·回合开始豁免`,
    disposition: 'debuff',
    tags: ['curse', 'bestow-curse', 'bestow-curse.lose-action'],
    duration: turnLossProfiles[0].duration,
    castLevelProfiles: turnLossProfiles,
    stacking: 'replace',
    concentration: true,
  }, {
    schemaVersion: 1,
    id: 'bestow-curse-source-bonus-damage',
    name: `${spell.name}·施法者额外伤害`,
    disposition: 'debuff',
    tags: ['curse', 'bestow-curse', 'bestow-curse.source-bonus-damage'],
    duration,
    castLevelProfiles: ordinaryProfiles,
    stacking: 'replace',
    concentration: true,
  }]
  const failedSave = { kind: 'check' as const, checkId: 'spell-save', result: 'failure' as const }
  return {
    ...base,
    target: {
      kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5,
      includeSelf: false, requiresLineOfSight: false, requiresLineOfEffect: true,
    },
    checks: [{
      id: 'spell-save', kind: 'saving-throw', rollId: 'bestow-curse-save',
      ability: 'wis', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      rollMode: 'host-derived', scope: 'per-target',
    }],
    choices: [{
      id: 'mode', label: '诅咒性质', defaultOptionId: 'ability', options: [{
        id: 'ability', label: '一项属性的检定与豁免劣势',
      }, {
        id: 'attacks-against-source', label: '攻击施法者时具有劣势',
      }, {
        id: 'lose-action', label: '回合开始豁免，失败浪费动作',
      }, {
        id: 'source-bonus-damage', label: '施法者额外造成 1d8 黯蚀伤害',
      }, {
        id: 'other', label: '其他同等强度诅咒（DM 裁定）',
      }],
    }, {
      id: 'ability', label: '受诅咒属性', defaultOptionId: 'wis',
      options: (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => ({
        id: ability, label: ability.toUpperCase(),
      })),
    }],
    outcomes: [
      ...(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => ({
        id: `curse-${ability}`,
        when: { kind: 'all' as const, conditions: [
          failedSave,
          { kind: 'choice' as const, choiceId: 'mode', optionId: 'ability' },
          { kind: 'choice' as const, choiceId: 'ability', optionId: ability },
        ] },
        operations: [{
          id: `remove-existing-bestow-curse-${ability}`, kind: 'remove-effects-by-tag' as const,
          target: 'target' as const, tags: ['bestow-curse'], match: 'any' as const,
          source: 'self' as const,
        }, {
          id: `apply-bestow-curse-${ability}`, kind: 'apply-effect' as const,
          target: 'target' as const, effectId: `bestow-curse-${ability}`,
        }],
      })),
      ...modeEffects.map((effect) => ({
        id: effect.id,
        when: { kind: 'all' as const, conditions: [
          failedSave,
          { kind: 'choice' as const, choiceId: 'mode', optionId: effect.id.replace('bestow-curse-', '') },
        ] },
        operations: [{
          id: `remove-existing-${effect.id}`, kind: 'remove-effects-by-tag' as const,
          target: 'target' as const, tags: ['bestow-curse'], match: 'any' as const,
          source: 'self' as const,
        }, {
          id: `apply-${effect.id}`, kind: 'apply-effect' as const,
          target: 'target' as const, effectId: effect.id,
        }],
      })),
      {
        id: 'other-curse',
        when: { kind: 'all', conditions: [
          failedSave,
          { kind: 'choice', choiceId: 'mode', optionId: 'other' },
        ] },
        operations: [{
          id: 'bestow-curse-other-adjudication', kind: 'manual-adjudication',
          prompt: '记录玩家声明的其他诅咒，并确认其强度不超过降咒列出的四种标准效果。',
          reason: '“其他诅咒”是规则明确交给 DM 的开放式选项。',
          requiresDmApproval: true as const,
        }],
      },
    ],
    effects: [...abilityEffects, ...modeEffects],
    automation: automationCapabilityFromLegacyStatus('partial', [
      '四种标准诅咒、触及距离、感知豁免、持续时间与 5 环起免专注均由 Host 结算；只有“其他诅咒”选项需要 DM。',
    ]),
  }
}

function geasDurationProfiles(): NonNullable<Dnd5eEffectDefinitionV1['castLevelProfiles']> {
  return [{
    minimumCastLevel: 5,
    duration: { kind: 'rounds', rounds: 432_000, expiresAt: 'target-turn-end' },
    concentration: false,
  }, {
    minimumCastLevel: 7,
    duration: { kind: 'rounds', rounds: 5_256_000, expiresAt: 'target-turn-end' },
    concentration: false,
  }, {
    minimumCastLevel: 9,
    duration: { kind: 'permanent' },
    concentration: false,
  }]
}

function geasActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const durationProfiles = geasDurationProfiles()
  const geasEffect: Dnd5eEffectDefinitionV1 = {
    schemaVersion: 1,
    id: 'geas-charmed',
    name: spell.name,
    disposition: 'debuff',
    tags: ['charm', 'curse', 'command', 'geas'],
    duration: durationProfiles[0]!.duration,
    castLevelProfiles: durationProfiles,
    conditions: ['charmed'],
    grants: ['spell:geas:violate-command'],
    stacking: 'replace',
  }
  const controllerEffect: Dnd5eEffectDefinitionV1 = {
    schemaVersion: 1,
    id: 'geas-caster-controller',
    name: `${spell.name}·施法者控制`,
    disposition: 'buff',
    tags: ['geas', 'geas-controller'],
    duration: durationProfiles[0]!.duration,
    castLevelProfiles: durationProfiles,
    grants: ['spell:geas:dismiss'],
    // Each successful casting retains its own natural lifetime. The granted
    // Activity is de-duplicated by id and can only target this caster's Geas.
    stacking: 'stack',
  }
  return {
    ...activity,
    target: {
      kind: 'creature', relation: 'any', rangeFeet: 60, count: 1,
      includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    checks: [{
      id: 'geas-save', kind: 'saving-throw', rollId: 'geas-save-d20', ability: 'wis',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      rollMode: 'host-derived', scope: 'per-target',
      automaticSuccessIfConditionImmune: 'charmed',
      appliesWhenChoice: { choiceId: 'target-response', optionIds: ['understands'] },
    }],
    choices: [{
      id: 'target-response', label: '目标与命令', defaultOptionId: 'understands', options: [{
        id: 'understands', label: '目标理解且命令并非必死',
        description: 'Host 进行感知豁免；失败时施加指使术。',
      }, {
        id: 'cannot-understand', label: '目标无法理解',
        description: '法术仍完成并消耗法术位，但目标不受影响且不进行豁免。',
      }, {
        id: 'certain-death', label: '命令会导致必死',
        description: '法术仍完成并消耗法术位，但立即结束且目标不受影响。',
      }],
    }],
    effects: [geasEffect, controllerEffect],
    outcomes: [{
      id: 'geas-on-failed-save',
      when: { kind: 'all', conditions: [
        { kind: 'choice', choiceId: 'target-response', optionId: 'understands' },
        { kind: 'check', checkId: 'geas-save', result: 'failure' },
      ] },
      operations: [{
        id: 'apply-geas', kind: 'apply-effect', target: 'target', effectId: geasEffect.id,
      }, {
        id: 'apply-geas-caster-controller', kind: 'apply-effect', target: 'actor',
        effectId: controllerEffect.id,
      }],
    }, {
      id: 'geas-dm-boundary', when: { kind: 'always' }, operations: [{
        id: 'geas-dm-adjudication', kind: 'manual-adjudication',
        prompt: '记录施法者给出的具体指令，并确认目标是否能理解、指令是否会导致必死。目标无法理解或命令会导致必死时，法术位与 1 分钟施法时间仍照常消耗，但目标不受影响；其他情况下采用 Host 的感知豁免与魅惑免疫结果。批准后，Host 按施法环位保存 30 日、1 年或永久效果。',
        reason: '开放式指令、语言互通和“会导致必死”的场景判断需要 DM 明示确认。',
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 自动校验 60 尺可见目标、1 分钟施法时间、感知豁免、魅惑免疫、5/7/9 环的 30 日/1 年/永久持续时间，并授予每日一次 5d10 心灵伤害及施法者动作解除入口。',
      '具体指令、语言理解、必死命令以及一次具体行为是否直接违令由共享 DM 边界裁定。',
    ]),
  }
}

function commandActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const modes = [
    { id: 'approach', label: '过来', description: '目标在其下一回合沿最短、最直接路线向施法者移动。' },
    { id: 'drop', label: '丢下', description: '目标在其下一回合丢下手中持握的一切并结束回合。' },
    { id: 'flee', label: '逃跑', description: '目标在其下一回合以最快的可行方式远离施法者。' },
    { id: 'grovel', label: '趴下', description: '目标在其下一回合倒地并结束回合。' },
    { id: 'halt', label: '停住', description: '目标在其下一回合不移动，也不执行动作。' },
    { id: 'other', label: '其他单词命令（语音说明）', description: '玩家通过内置语音说明命令；Host 记录一轮命令状态，不弹出 DM 审批。' },
  ] as const
  const effects: Dnd5eEffectDefinitionV1[] = modes.map((mode) => ({
    schemaVersion: 1,
    id: `command-${mode.id}`,
    name: `${spell.name}·${mode.label}`,
    disposition: 'debuff',
    tags: ['command-spell', `command-mode:${mode.id}`],
    extensionCondition: `command-${mode.id}`,
    duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' },
    stacking: 'replace',
    exclusiveGroup: 'command-mode',
  }))
  const failedSave = {
    kind: 'check' as const,
    checkId: 'command-save',
    result: 'failure' as const,
  }
  return {
    ...activity,
    target: {
      kind: 'creature', relation: 'any', rangeFeet: 60, count: 1,
      includeSelf: false, requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    checks: [{
      id: 'command-save', kind: 'saving-throw', rollId: 'command-save-d20',
      ability: 'wis', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      rollMode: 'host-derived', scope: 'per-target',
    }],
    choices: [{
      id: 'command-mode', label: '单词命令', defaultOptionId: 'halt',
      options: modes,
    }],
    effects,
    outcomes: modes.map((mode) => ({
      id: `command-${mode.id}-on-failed-save`,
      when: {
        kind: 'all' as const,
        conditions: [
          failedSave,
          { kind: 'choice' as const, choiceId: 'command-mode', optionId: mode.id },
        ],
      },
      operations: [{
        id: `apply-command-${mode.id}`,
        kind: 'apply-effect' as const,
        target: 'target' as const,
        effectId: `command-${mode.id}`,
      }],
    })),
    scaling: [{
      basis: 'slot-level', baseLevel: 1,
      adjustments: modes.map((mode) => ({
        operationId: `apply-command-${mode.id}`,
        additionalTargetsPerStep: 1,
      })),
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

function conjureCelestialActivity(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const choices = auditedModeChoices(spell)!
  return {
    ...activity,
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 90, lengthFeet: 5, widthFeet: 5, heightFeet: 5,
      rotatable: false, maximumTargets: 1,
      requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    choices,
    outcomes: choices[0]!.options.map((option) => ({
      id: `summon-${option.id.replace(/^srd-5\.1:/, '')}`,
      when: { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
      operations: [{
        id: `summon-${option.id.replace(/^srd-5\.1:/, '')}`,
        kind: 'summon' as const,
        monsterId: option.id,
        count: { kind: 'constant' as const, value: 1 },
        timing: 'immediate' as const,
        durationRounds: 600,
        concentration: true,
        side: 'ally' as const,
      }],
    })),
    // The DM's bounded catalogue choice is captured as structured data. Verbal
    // commands and alignment-consistency conversations remain available over
    // the room voice channel and do not interrupt the atomic cast transaction.
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

function conjureElementalActivity(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const choices = auditedModeChoices(spell)!
  return {
    ...activity,
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 90, lengthFeet: 10, widthFeet: 10, heightFeet: 10,
      rotatable: false, maximumTargets: 1,
      requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    choices,
    outcomes: choices[0]!.options.map((option) => ({
      id: `summon-${option.id.replace(/^srd-5\.1:/, '')}`,
      when: { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
      operations: [{
        id: `summon-${option.id.replace(/^srd-5\.1:/, '')}`,
        kind: 'summon' as const,
        monsterId: option.id,
        count: { kind: 'constant' as const, value: 1 },
        timing: 'immediate' as const,
        durationRounds: 600,
        concentration: true,
        side: 'ally' as const,
        becomesHostileAfterConcentrationEnds: true as const,
      }],
    })),
    // The selected 10-foot elemental medium is the actual player map area.
    // The Host-owned creature choice is bounded by the cast slot. Commands use
    // room voice; concentration loss is a deterministic side transition.
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

function conjureFeyActivity(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const choices = auditedModeChoices(spell)!
  return {
    ...activity,
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 90, lengthFeet: 5, widthFeet: 5, heightFeet: 5,
      rotatable: false, maximumTargets: 1,
      requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    choices,
    outcomes: choices[0]!.options.map((option) => ({
      id: `summon-${option.id.replace(/^srd-5\.1:/, '')}`,
      when: { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
      operations: [{
        id: `summon-${option.id.replace(/^srd-5\.1:/, '')}`,
        kind: 'summon' as const,
        monsterId: option.id,
        count: { kind: 'constant' as const, value: 1 },
        timing: 'immediate' as const,
        durationRounds: 600,
        concentration: true,
        side: 'ally' as const,
        becomesHostileAfterConcentrationEnds: true as const,
      }],
    })),
    // The player places the summoned creature and the Host selects a legal Fey
    // stat block (or a Beast stat block for a Fey spirit in Beast form). Verbal
    // commands remain on room voice; concentration loss deterministically ends
    // control without dismissing the creature before its one-hour duration.
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

const CONJURE_MINOR_ELEMENTALS_FORMATIONS = [
  { id: 'one-cr-2', label: '1 个 CR 2 或更低', baseCount: 1, maximumChallengeRating: 2 },
  { id: 'two-cr-1', label: '2 个 CR 1 或更低', baseCount: 2, maximumChallengeRating: 1 },
  { id: 'four-cr-half', label: '4 个 CR 1/2 或更低', baseCount: 4, maximumChallengeRating: 0.5 },
  { id: 'eight-cr-quarter', label: '8 个 CR 1/4 或更低', baseCount: 8, maximumChallengeRating: 0.25 },
] as const

type ConjureMinorElementalsFormationId = typeof CONJURE_MINOR_ELEMENTALS_FORMATIONS[number]['id']

function conjureMinorElementalsCountFormula(baseCount: number) {
  // floor((slot - 2) / 2) produces the printed multiplier table:
  // 4th/5th = 1, 6th/7th = 2, 8th/9th = 3.
  return {
    kind: 'multiply' as const,
    values: [
      { kind: 'constant' as const, value: baseCount },
      {
        kind: 'floor' as const,
        value: {
          kind: 'multiply' as const,
          values: [
            {
              kind: 'add' as const,
              values: [
                { kind: 'reference' as const, reference: { kind: 'cast-level' as const } },
                { kind: 'constant' as const, value: -2 },
              ],
            },
            { kind: 'constant' as const, value: 0.5 },
          ],
        },
      },
    ],
  }
}

function conjureMinorElementalsActivity(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const modeChoice = {
    id: 'mode',
    label: 'DM 选择元素生物数据卡',
    options: AUDITED_CONJURE_MINOR_ELEMENTAL_CHOICES,
    defaultOptionId: AUDITED_CONJURE_MINOR_ELEMENTAL_CHOICES[0]!.id,
  }
  const formationChoice = {
    id: 'formation',
    label: '出现方式',
    options: CONJURE_MINOR_ELEMENTALS_FORMATIONS.map((formation) => ({
      id: formation.id,
      label: formation.label,
      description: '6 环数量翻倍；8 环数量变为三倍。',
    })),
    defaultOptionId: CONJURE_MINOR_ELEMENTALS_FORMATIONS[0]!.id,
  }
  return {
    ...activity,
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 90, lengthFeet: 5, widthFeet: 5, heightFeet: 5,
      rotatable: false, maximumTargets: 1,
      requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    choices: [modeChoice, formationChoice],
    outcomes: CONJURE_MINOR_ELEMENTALS_FORMATIONS.flatMap((formation) =>
      dnd5eConjureMinorElementalChoicesForFormationV1(formation.id).map((option) => ({
        id: `summon-${formation.id}-${option.id.replace(/^srd-5\.1:/, '')}`,
        when: {
          kind: 'all' as const,
          conditions: [
            { kind: 'choice' as const, choiceId: 'formation', optionId: formation.id },
            { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
          ],
        },
        operations: [{
          id: `summon-${formation.id}-${option.id.replace(/^srd-5\.1:/, '')}`,
          kind: 'summon' as const,
          monsterId: option.id,
          count: conjureMinorElementalsCountFormula(formation.baseCount),
          timing: 'immediate' as const,
          durationRounds: 600,
          concentration: true,
          side: 'ally' as const,
        }],
      }))),
    // The caster chooses the printed count/CR formation. The Host then chooses
    // one bounded elemental stat block legal for that formation and places all
    // occurrences; verbal commands remain in room voice.
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

function conjureWoodlandBeingsActivity(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const modeChoice = {
    id: 'mode',
    label: 'DM 选择精类生物数据卡',
    options: AUDITED_CONJURE_WOODLAND_BEING_CHOICES,
    defaultOptionId: AUDITED_CONJURE_WOODLAND_BEING_CHOICES[0]!.id,
  }
  const formationChoice = {
    id: 'formation',
    label: '出现方式',
    options: CONJURE_MINOR_ELEMENTALS_FORMATIONS.map((formation) => ({
      id: formation.id,
      label: formation.label,
      description: '6 环数量翻倍；8 环数量变为三倍。',
    })),
    defaultOptionId: CONJURE_MINOR_ELEMENTALS_FORMATIONS[0]!.id,
  }
  return {
    ...activity,
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 60, lengthFeet: 5, widthFeet: 5, heightFeet: 5,
      rotatable: false, maximumTargets: 1,
      requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    choices: [modeChoice, formationChoice],
    outcomes: CONJURE_MINOR_ELEMENTALS_FORMATIONS.flatMap((formation) =>
      dnd5eConjureWoodlandBeingChoicesForFormationV1(formation.id).map((option) => ({
        id: `summon-${formation.id}-${option.id.replace(/^srd-5\.1:/, '')}`,
        when: {
          kind: 'all' as const,
          conditions: [
            { kind: 'choice' as const, choiceId: 'formation', optionId: formation.id },
            { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
          ],
        },
        operations: [{
          id: `summon-${formation.id}-${option.id.replace(/^srd-5\.1:/, '')}`,
          kind: 'summon' as const,
          monsterId: option.id,
          count: conjureMinorElementalsCountFormula(formation.baseCount),
          timing: 'immediate' as const,
          durationRounds: 600,
          concentration: true,
          side: 'ally' as const,
        }],
      }))),
    // The caster chooses the printed count/CR formation. The Host then chooses
    // one legal Fey stat block and places every occurrence. The spell's
    // non-costly holly-berry material is satisfied by normal component rules,
    // including a held druidic focus.
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

type ContingencyStoredSpellV1 = {
  spell: RegisteredDnd5ePluginSpell
  activity: Dnd5eActivityDefinitionV1
}

const CONTINGENCY_SAFE_OPERATION_KINDS = new Set<Dnd5eActivityOperationV1['kind']>([
  'apply-effect',
  'mechanic',
  'temporary-hit-points',
  'healing',
  'remove-standard-condition',
  'remove-effect',
  'remove-effects-by-tag',
  'adjust-exhaustion',
  'recover-ability-score',
  'recover-hit-point-maximum',
])

/**
 * Returns the closed subset that can be stored without deferring a target,
 * mode, save, roll, map handoff or costly secondary material until trigger
 * time. The caster still has to know the selected spell and carry an ordinary
 * focus when the two spells are cast.
 */
function contingencyStoredSpellsV1(): readonly ContingencyStoredSpellV1[] {
  return fullSpells.flatMap((spell) => {
    if (
      spell.level < 1 || spell.level > 5 ||
      spell.castingTime.unit !== 'action' || spell.castingTime.value !== 1 ||
      !spell.classes.includes('wizard') ||
      dnd5eCoreSpellMaterialRequirement(spell.id) != null
    ) return []
    const activity = fullActivity(spell)
    const canTargetSelf = activity.target.kind === 'self' ||
      (activity.target.kind === 'creature' && activity.target.includeSelf === true)
    const operations = activity.outcomes.flatMap((outcome) => outcome.operations)
    if (
      !canTargetSelf || activity.authorityBinding != null ||
      (activity.choices?.length ?? 0) > 0 || (activity.checks?.length ?? 0) > 0 ||
      (activity.scaling?.length ?? 0) > 0 ||
      operations.length === 0 ||
      operations.some((operation) => !CONTINGENCY_SAFE_OPERATION_KINDS.has(operation.kind))
    ) return []
    return [{ spell, activity }]
  }).sort((left, right) =>
    left.spell.level - right.spell.level || left.spell.name.localeCompare(right.spell.name, 'zh-CN'))
}

type ContingencyTriggerModeV1 = 'takes-damage' | 'manual'

function contingencyControllerEffectId(
  storedSpellId: string,
  triggerMode: ContingencyTriggerModeV1,
): string {
  return `contingency-${storedSpellId}-${triggerMode}`
}

function contingencyTriggerActivityId(
  storedSpellId: string,
  triggerMode: ContingencyTriggerModeV1,
): string {
  return `spell:contingency:trigger:${storedSpellId}:${triggerMode}`
}

function contingencyActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const storedSpells = contingencyStoredSpellsV1()
  const triggerModes = [{
    id: 'takes-damage',
    label: '第一次受到伤害时（自动）',
    description: 'Host 在实际伤害结算后立即触发所存法术；临时生命值完全吸收时不算受到伤害。',
  }, {
    id: 'manual',
    label: '自定义明确条件（语音／DM 记录）',
    description: '通过语音声明可客观判断的条件；条件首次满足时使用获授的零动作按钮立即结算。',
  }] as const
  const defaultStoredSpellId = storedSpells.some((entry) => entry.spell.id === 'mirror-image')
    ? 'mirror-image'
    : storedSpells[0]?.spell.id
  return {
    ...activity,
    target: { kind: 'self' },
    choices: [{
      id: 'stored-spell',
      label: '同时施放并储存的法术',
      options: storedSpells.map(({ spell: storedSpell }) => ({
        id: storedSpell.id,
        label: `${storedSpell.name}（${storedSpell.level} 环）`,
        description: '必须是施法者当前能够施放的已知／已准备法术；设置触发术时立即花费该法术位，但效果暂不发生。',
      })),
      defaultOptionId: defaultStoredSpellId,
    }, {
      id: 'trigger-mode',
      label: '首次触发条件',
      options: triggerModes,
      defaultOptionId: 'takes-damage',
    }],
    effects: storedSpells.flatMap(({ spell: storedSpell }) => triggerModes.map((mode) => ({
      schemaVersion: 1 as const,
      id: contingencyControllerEffectId(storedSpell.id, mode.id),
      name: `${spell.name}·储存${storedSpell.name}`,
      disposition: 'buff' as const,
      tags: ['contingency', 'stored-spell', `stored-spell:${storedSpell.id}`, `trigger:${mode.id}`],
      duration: {
        kind: 'rounds' as const,
        rounds: auditedDurationRounds(spell),
        expiresAt: 'target-turn-end' as const,
      },
      extensionCondition: `contingency:${storedSpell.id}:${mode.id}`,
      grants: [contingencyTriggerActivityId(storedSpell.id, mode.id)],
      stacking: 'replace' as const,
      exclusiveGroup: 'contingency-controller',
    }))),
    outcomes: storedSpells.flatMap(({ spell: storedSpell }) => triggerModes.map((mode) => ({
      id: `store-${storedSpell.id}-${mode.id}`,
      when: {
        kind: 'all' as const,
        conditions: [{
          kind: 'choice' as const,
          choiceId: 'stored-spell',
          optionId: storedSpell.id,
        }, {
          kind: 'choice' as const,
          choiceId: 'trigger-mode',
          optionId: mode.id,
        }],
      },
      operations: [{
        id: `spend-stored-${storedSpell.id}-slot-${mode.id}`,
        kind: 'resource' as const,
        subject: 'actor' as const,
        resourceId: `dnd5e-spell-slot-${storedSpell.level}`,
        mode: 'spend' as const,
        amount: { kind: 'constant' as const, value: 1 },
      }, {
        id: `apply-${contingencyControllerEffectId(storedSpell.id, mode.id)}`,
        kind: 'apply-effect' as const,
        target: 'actor' as const,
        effectId: contingencyControllerEffectId(storedSpell.id, mode.id),
      }],
    }))),
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 自动校验并保留价值至少 1,500 gp 的自塑像、花费触发术与所存法术的两个法术位，并维持 10 天的唯一储存状态。',
      '“第一次受到伤害”由权威伤害事件自动触发；其他开放式条件通过语音记录，并在首次满足时使用零动作触发按钮。',
      '当前结构化储存列表只包含无需延迟目标、模式、检定、骰值、地图交接或额外贵重材料即可精确重放的 1 动作自施法术。',
    ]),
  }
}

function hallowActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const creatureTypes = [
    ['aberration', '异怪'], ['beast', '野兽'], ['celestial', '天界生物'],
    ['construct', '构装生物'], ['dragon', '龙'], ['elemental', '元素生物'],
    ['fey', '精类生物'], ['fiend', '邪魔'], ['giant', '巨人'],
    ['humanoid', '类人生物'], ['monstrosity', '怪兽'], ['ooze', '软泥怪'],
    ['plant', '植物生物'], ['undead', '亡灵'],
  ] as const
  const wardTypes = [
    ['celestial', '天界生物'], ['elemental', '元素生物'], ['fey', '精类生物'],
    ['fiend', '邪魔'], ['undead', '亡灵'],
  ] as const
  return {
    ...activity,
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
      placeRangeFeet: 5, radiusFeet: 60,
      maximumTargets: 256, includeSelf: true,
      requiresLineOfSight: false, requiresLineOfEffect: true,
    },
    choices: [{
      id: 'hallow-effect', label: '圣居附加效果', defaultOptionId: 'courage', options: [
        { id: 'courage', label: '勇气', description: '作用对象在区域内免疫恐慌。' },
        { id: 'darkness', label: '黑暗', description: '区域充满魔法黑暗，并压制四环或更低的魔法光照。' },
        { id: 'daylight', label: '昼明', description: '区域充满明亮光照，并压制四环或更低的魔法黑暗。' },
        { id: 'energy-protection', label: '能量防护', description: '作用对象获得所选能量伤害抗性。' },
        { id: 'energy-vulnerability', label: '能量易伤', description: '作用对象获得所选能量伤害易伤。' },
        { id: 'everlasting-rest', label: '永恒安息', description: '尸体无法在区域内被转化为亡灵。' },
        { id: 'extradimensional-interference', label: '异次元干涉', description: '作用对象无法用传送或位面旅行进入或离开区域。' },
        { id: 'fear', label: '恐惧', description: '首次进入或在区域内开始回合时进行魅力豁免。' },
        { id: 'silence', label: '静默', description: '声音无法从区域内传出，也无法传入区域。' },
        { id: 'tongues', label: '巧言', description: '区域内作用对象可以跨语言互相沟通。' },
      ],
    }, {
      id: 'hallow-damage-type', label: '能量类型（仅能量效果使用）', defaultOptionId: 'fire',
      options: (['acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder'] as const).map((id) => ({
        id,
        label: ({
          acid: '强酸', cold: '寒冷', fire: '火焰', force: '力场', lightning: '闪电',
          necrotic: '黯蚀', poison: '毒素', psychic: '心灵', radiant: '光耀', thunder: '雷鸣',
        } as const)[id],
      })),
    }, {
      id: 'hallow-scope', label: '附加效果作用对象', defaultOptionId: 'all', options: [
        { id: 'all', label: '区域内全部生物' },
        { id: 'allies', label: '施法者同阵营（指定神祇／领袖追随者）' },
        { id: 'enemies', label: '施法者敌对阵营' },
        ...creatureTypes.map(([id, label]) => ({ id: `type-${id}`, label: `指定种类：${label}` })),
      ],
    }, ...wardTypes.map(([id, label]) => ({
      id: `hallow-exempt-${id}`,
      label: `${label}是否可进入`,
      defaultOptionId: 'ward',
      options: [
        { id: 'ward', label: '阻止进入（默认）' },
        { id: 'exempt', label: '列为豁免' },
      ],
    }))],
    checks: undefined,
    effects: undefined,
    outcomes: [{
      id: 'create-hallow', when: { kind: 'always' }, operations: [{
        id: 'hallow-area', kind: 'create-persistent-area', label: spell.name,
        durationRounds: 5_256_000, permanent: true, concentration: false,
        color: '#f5d76e', visual: { preset: 'daylight', intensity: 'subtle' },
        anchorMode: 'fixed',
        creationConstraints: { forbidCoreSpellOverlap: 'hallow' },
        hallow: {
          effectChoiceId: 'hallow-effect',
          damageTypeChoiceId: 'hallow-damage-type',
          scopeChoiceId: 'hallow-scope',
          wardExemptionChoiceIds: {
            celestial: 'hallow-exempt-celestial',
            elemental: 'hallow-exempt-elemental',
            fey: 'hallow-exempt-fey',
            fiend: 'hallow-exempt-fiend',
            undead: 'hallow-exempt-undead',
          },
        },
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 自动校验 24 小时施法、V/S/M、消费价值至少 1,000 gp 的圣化材料和五环法术位，并持久化 60 尺圣居。',
      'Host 自动结算五类生物的进入阻挡与来源限定状态防护，以及勇气、光暗、能量抗性／易伤、异次元干涉、恐惧、静默和巧言。',
      '“永恒安息”的尸体／物件互动、DM 自订的其他效果和无法由地图阵营表达的精确神祇／领袖名单通过桌内语音沟通，不额外弹出 DM 审批。',
    ]),
  }
}

function prismaticSprayActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const base = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const target: Dnd5eActivityDefinitionV1['target'] = {
    kind: 'area', relation: 'any', origin: 'self', shape: 'cone',
    lengthFeet: 60, maximumTargets: 256, includeSelf: false,
    requiresLineOfSight: false, requiresLineOfEffect: true,
  }
  return {
    ...base,
    target,
    checks: [{
      id: 'spell-save', kind: 'saving-throw', rollId: 'spell-save-d20', ability: 'dex',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      rollMode: 'host-derived', scope: 'per-target',
    }, {
      id: 'prismatic-ray', kind: 'random-roll', rollId: 'prismatic-ray-d8',
      label: '光束颜色 d8', count: 1, sides: 8, scope: 'per-target',
    }, {
      id: 'prismatic-primary-damage', kind: 'random-roll', rollId: 'prismatic-primary-damage-d6',
      label: '光束伤害 10d6', count: 10, sides: 6, scope: 'per-target',
      appliesWhenCheckTotal: { checkId: 'prismatic-ray', minimum: 1, maximum: 5 },
    }, {
      id: 'prismatic-extra-ray-a', kind: 'random-roll', rollId: 'prismatic-extra-ray-a-d8',
      label: '特殊结果·第一道光束 d8', count: 1, sides: 8, rerollValues: [8], scope: 'per-target',
      appliesWhenCheckTotal: { checkId: 'prismatic-ray', minimum: 8, maximum: 8 },
    }, {
      id: 'prismatic-extra-damage-a', kind: 'random-roll', rollId: 'prismatic-extra-damage-a-d6',
      label: '特殊结果·第一道光束伤害 10d6', count: 10, sides: 6, scope: 'per-target',
      appliesWhenCheckTotal: { checkId: 'prismatic-extra-ray-a', minimum: 1, maximum: 5 },
    }, {
      id: 'prismatic-extra-ray-b', kind: 'random-roll', rollId: 'prismatic-extra-ray-b-d8',
      label: '特殊结果·第二道光束 d8', count: 1, sides: 8, rerollValues: [8], scope: 'per-target',
      appliesWhenCheckTotal: { checkId: 'prismatic-ray', minimum: 8, maximum: 8 },
    }, {
      id: 'prismatic-extra-damage-b', kind: 'random-roll', rollId: 'prismatic-extra-damage-b-d6',
      label: '特殊结果·第二道光束伤害 10d6', count: 10, sides: 6, scope: 'per-target',
      appliesWhenCheckTotal: { checkId: 'prismatic-extra-ray-b', minimum: 1, maximum: 5 },
    }],
    effects: undefined,
    outcomes: [{
      id: 'resolve-prismatic-rays', when: { kind: 'always' }, operations: [{
        id: 'resolve-prismatic-rays', kind: 'mechanic', target: 'target',
        handlerId: 'core.prismatic-spray', parameters: {},
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 逐目标结算敏捷豁免、光束颜色 d8、伤害、靛色束缚与石化进度，以及紫色目盲和后续感知豁免。',
      '特殊结果会自动再掷两次 d8，并自动重掷其中的 8；紫色豁免失败后的具体目的位面仍由 DM 叙事决定。',
    ]),
  }
}

function hallucinatoryTerrainActivity(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 300, lengthFeet: 150, widthFeet: 150, heightFeet: 150,
      gridAligned: true, rotatable: false, maximumTargets: 256, includeSelf: true,
      requiresLineOfSight: false, requiresLineOfEffect: true,
    },
    choices: [{
      id: 'hallucinatory-terrain-appearance',
      label: '幻景中的自然地形外观',
      defaultOptionId: 'swamp',
      options: [
        { id: 'swamp', label: '沼泽', description: '使天然地形看起来、听起来并闻起来像沼泽。' },
        { id: 'hill', label: '山丘', description: '使天然地形看起来、听起来并闻起来像山丘。' },
        { id: 'crevasse', label: '裂谷', description: '使天然地形看起来、听起来并闻起来像裂谷。' },
        { id: 'meadow', label: '草地', description: '使天然地形看起来、听起来并闻起来像草地。' },
        { id: 'gentle-slope', label: '缓坡', description: '使天然地形看起来、听起来并闻起来像缓坡。' },
        { id: 'road', label: '道路', description: '使天然地形看起来、听起来并闻起来像道路。' },
        {
          id: 'other-natural-terrain', label: '其他自然地形',
          description: '通过房间内置语音说明具体自然地形外观；无需 DM 审批弹窗。',
        },
      ],
    }],
    checks: undefined,
    effects: undefined,
    outcomes: [{
      id: 'create-hallucinatory-terrain', when: { kind: 'always' }, operations: [{
        id: 'hallucinatory-terrain-area', kind: 'create-persistent-area', label: spell.name,
        durationRounds: 14_400, concentration: false,
        color: '#8b5cf6', visual: { preset: 'major-image', intensity: 'subtle' },
        anchorMode: 'fixed',
        hallucinatoryTerrain: {
          appearanceChoiceId: 'hallucinatory-terrain-appearance',
        },
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 自动校验 10 分钟施法、300 尺射程、V/S/M 与四环法术位，并持久化 150 尺立方、持续 24 小时且无需专注的幻景地形。',
      '施法者从印刷示例中选择外观；其他自然地形通过房间语音说明，不弹出 DM 审批。地形的触觉、人工结构、装备和生物保持不变。',
      '仔细调查者进行智力（调查）检定对抗施法豁免 DC；当前地图区域保留 DC 与识破规则说明，但逐生物识破状态不自动持久化。',
    ]),
  }
}

function programmedIllusionActivity(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: {
      // Programmed Illusion creates an illusion at a point; creatures inside
      // the volume are observers, never spell targets. The footprint may be
      // reduced in five-foot steps but cannot exceed the printed 30-foot cube.
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 120,
      lengthFeet: 30, minimumLengthFeet: 5,
      widthFeet: 30, minimumWidthFeet: 5,
      heightFeet: 30,
      gridAligned: true, rotatable: false, maximumTargets: 256, includeSelf: true,
      requiresLineOfSight: false, requiresLineOfEffect: true,
    },
    // The map volume is the only declaration the Host needs before casting.
    // Appearance, performance and trigger wording stay at the table so this
    // spell proceeds directly to size/placement instead of opening prompts.
    choices: undefined,
    checks: undefined,
    effects: undefined,
    outcomes: [{
      id: 'create-programmed-illusion', when: { kind: 'always' }, operations: [{
        id: 'programmed-illusion-area', kind: 'create-persistent-area', label: spell.name,
        durationRounds: 5_256_000, permanent: true, concentration: false,
        color: '#8b5cf6', visual: { preset: 'major-image', intensity: 'strong' },
        anchorMode: 'fixed',
      }],
    }],
    // The open-ended performance is table narration, not an unresolved Host
    // transaction. Mark the executable Activity full so the live spell route
    // reaches map placement instead of falling back to creature/manual casting.
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

function partialActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  if (spell.id === 'hallow') return hallowActivity(spell)
  if (spell.id === 'hallucinatory-terrain') return hallucinatoryTerrainActivity(spell)
  if (spell.id === 'programmed-illusion') return programmedIllusionActivity(spell)
  if (spell.id === 'prismatic-spray') return prismaticSprayActivity(spell)
  if (spell.id === 'detect-evil-and-good') {
    // The creature-presence sensor is a closed Host transaction and must stay
    // available from the live cast route. The catalog remains `partial`
    // because consecrated/desecrated scenery and the material-specific barrier
    // thickness clauses are deliberately outside the current map model; those
    // environmental facts are communicated at the table instead of fabricating
    // a creature target or an inert rule-state marker.
    return {
      ...fullActivity(spell),
      automation: automationCapabilityFromLegacyStatus('partial', [
        'Host 自动结算 30 尺内指定生物类型的存在、持续时间与专注；圣化/亵渎地点或物件，以及障碍材质厚度由 DM 根据场景裁定。',
      ]),
    }
  }
  if (spell.id === 'detect-magic') {
    // Creature spell effects, concentration and character inventory are
    // deterministic Host inputs. Independent magical scenery and exact
    // barrier materials/thicknesses are not represented by the current map
    // schema, so retain both the cast and reveal-aura Activities as partial.
    return {
      ...fullActivity(spell),
      automation: automationCapabilityFromLegacyStatus('partial', [
        'Host 自动结算 30 尺内生物法术效果、专注与随身魔法物品，并提供显化灵光动作；独立地图魔法物件及障碍材质厚度由 DM 根据场景裁定。',
      ]),
    }
  }
  if (spell.id === 'detect-poison-and-disease') {
    // Poisoned conditions, disease effects and poisonous SRD stat-block
    // payloads are deterministic Host inputs. Free-standing poison objects,
    // exact poison-kind metadata and barrier material/thickness are not yet
    // represented, so keep the implemented persistent detector as partial.
    return {
      ...fullActivity(spell),
      automation: automationCapabilityFromLegacyStatus('partial', [
        'Host 自动结算 30 尺内中毒状态、疾病效果与带毒 SRD 生物的位置；独立毒药物件、精确毒药种类及障碍材质厚度由 DM 根据场景裁定。',
      ]),
    }
  }
  if (spell.id === 'detect-thoughts') return detectThoughtsActivity(spell)
  if (spell.id === 'conjure-celestial') return conjureCelestialActivity(spell)
  if (spell.id === 'conjure-elemental') return conjureElementalActivity(spell)
  if (spell.id === 'conjure-fey') return conjureFeyActivity(spell)
  if (spell.id === 'conjure-minor-elementals') return conjureMinorElementalsActivity(spell)
  if (spell.id === 'conjure-woodland-beings') return conjureWoodlandBeingsActivity(spell)
  if (spell.id === 'contact-other-plane') return contactOtherPlaneActivity(spell)
  if (spell.id === 'contingency') return contingencyActivity(spell)
  if (spell.id === 'bestow-curse') return bestowCurseActivity(spell)
  if (spell.id === 'geas') return geasActivity(spell)
  if (spell.id === 'command') return commandActivity(spell)
  if (spell.id === 'message') return messageActivity(spell)
  if (spell.id === 'magic-mouth') return magicMouthActivity(spell)
  if (spell.id === 'continual-flame') return continualFlameActivity(spell)
  if (spell.id === 'control-water') return controlWaterActivity(spell)
  if (spell.id === 'control-weather') return controlWeatherActivity(spell)
  if (spell.id === 'planar-binding') return planarBindingActivity(spell)
  if (spell.id === 'move-earth') return moveEarthActivity(spell)
  if (spell.id === 'minor-illusion') return minorIllusionActivity(spell)
  if (spell.id === 'antipathy-sympathy') return antipathySympathyActivity(spell)
  if (spell.id === 'true-polymorph') return truePolymorphActivity(spell)
  if (spell.id === 'shapechange') {
    const activity = fullActivity(spell)
    return {
      ...activity,
      outcomes: [...(activity.outcomes ?? []), {
        id: 'shapechange-equipment-fit-boundary',
        when: { kind: 'choice', choiceId: 'equipment', optionId: 'wear' },
        operations: [{
          id: 'shapechange-equipment-fit-adjudication',
          kind: 'manual-adjudication',
          prompt: '逐件确认所选新形态的形状和体型能否实际穿戴施法者选择保留的装备；不合适的装备必须改为掉落或融入新形态。',
          reason: '装备尺寸、形状与新身体结构的适配需要 DM 根据场景裁定。',
          requiresDmApproval: true,
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('partial', [
        'Host 自动结算合法形态、属性、生命值、专注与再次变形；只有“由新形态穿戴”的逐件适配由 DM 明示裁定。',
      ]),
    }
  }
  const source = spell as Dnd5ePluginSpellDefinition
  const activity = dnd5eActivityFromSpellDefinition(source, 'headless-action')
  const target: Dnd5eActivityDefinitionV1['target'] = spell.id === 'illusory-script' ||
    spell.id === 'mirage-arcane' || spell.id === 'guards-and-wards'
    // The spell enchants the writing material, not a map creature. The caster
    // is the authority carrier while the chosen text and permitted readers
    // remain inside the explicit DM-assisted boundary below. Mirage Arcane
    // likewise uses the caster as its long-lived world-state carrier; its
    // chosen terrain stays in table communication without blocking settlement.
    // Guards and Wards protects connected building geometry rather than a
    // creature; self is only its authoritative transaction anchor.
    ? { kind: 'self' }
    : spell.id === 'transport-via-plants'
    ? {
        // The spell opens a passage in a plant; it never targets a creature.
        // The mapped point is the entrance plant's Host-owned anchor while the
        // Large-or-larger/inanimate qualification and off-map destination stay
        // inside the explicit shared DM boundary below.
        kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
        placeRangeFeet: 10, lengthFeet: 5, widthFeet: 5, heightFeet: 5,
        rotatable: false, maximumTargets: 1,
        requiresLineOfSight: false, requiresLineOfEffect: true,
      }
    : spell.id === 'gate'
    ? {
        // Gate creates a freestanding circular portal at an unoccupied point;
        // choosing a creature here incorrectly bypassed its 5-20-foot diameter
        // and spatial placement rules. The mapped circle is the local mouth.
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 60, radiusFeet: 10, minimumRadiusFeet: 2.5,
        maximumTargets: 256, includeSelf: true,
        requiresLineOfSight: true, requiresLineOfEffect: true,
      }
    : spell.id === 'unseen-servant'
    ? {
        kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
        placeRangeFeet: 60, lengthFeet: 5, widthFeet: 5, heightFeet: 5,
        rotatable: false, maximumTargets: 1,
        requiresLineOfSight: false, requiresLineOfEffect: true,
      }
    : spell.id === 'major-image'
    ? {
        kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
        placeRangeFeet: 120, lengthFeet: 20, widthFeet: 20, heightFeet: 20,
        rotatable: false, maximumTargets: 256, includeSelf: true,
        requiresLineOfSight: true, requiresLineOfEffect: true,
      }
    : activity.target
  const castLevelTargetProfiles: Dnd5eActivityDefinitionV1['castLevelTargetProfiles'] =
    spell.id === 'etherealness'
      ? [{
          minimumCastLevel: 8,
          target: {
            kind: 'creature', relation: 'ally', rangeFeet: 10, count: 3,
            includeSelf: true, allowDuplicateTargets: false,
          },
        }, {
          minimumCastLevel: 9,
          target: {
            kind: 'creature', relation: 'ally', rangeFeet: 10, count: 6,
            includeSelf: true, allowDuplicateTargets: false,
          },
        }]
      : activity.castLevelTargetProfiles
  const decision = decisions[spell.id]!
  const concreteEffects = partialConcreteEffects(spell)
  const concreteEffect = concreteEffects[0]
  // Silent Image states its 15-foot cube only in the body text. It is still a
  // real map entity even though its chosen visual content and creature
  // interpretation remain DM-assisted. Cast-level profiles may remove concentration.
  const isPersistentArea = (
    decision.includes('persistent-area') || spell.id === 'silent-image' ||
    spell.id === 'major-image' || spell.id === 'unseen-servant' || spell.id === 'gate'
  ) && target.kind === 'area'
  const saveAbility = (decision.includes('saving-throw') || spell.id === 'imprisonment') && !isPersistentArea
    ? auditedSavingThrowAbility(spell)
    : undefined
  const hasSpellAttack = decision.includes('spell-attack') && !isPersistentArea
  const checks: Dnd5eActivityDefinitionV1['checks'] = spell.id === 'plane-shift'
    ? [{
        id: 'spell-attack', kind: 'attack-roll', rollId: 'spell-attack-d20',
        attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
        rollMode: 'host-derived', delivery: 'melee', scope: 'per-target',
        appliesWhenChoice: { choiceId: 'mode', optionIds: ['hostile-banishment'] },
      }, {
        id: 'spell-save', kind: 'saving-throw', rollId: 'spell-save-d20', ability: 'cha',
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
        rollMode: 'host-derived', scope: 'per-target',
        appliesWhenChoice: { choiceId: 'mode', optionIds: ['hostile-banishment'] },
        appliesWhenCheck: { checkId: 'spell-attack', result: 'success' },
      }]
    : saveAbility
    ? [{
        id: 'spell-save', kind: 'saving-throw', rollId: 'spell-save-d20', ability: saveAbility,
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
        rollMode: 'host-derived', scope: 'per-target',
        ...(concreteEffect?.conditions?.includes('charmed') ? {
          automaticSuccessIfConditionImmune: 'charmed' as const,
        } : {}),
      }]
    : hasSpellAttack
      ? [{
          id: 'spell-attack', kind: 'attack-roll', rollId: 'spell-attack-d20',
          attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
          rollMode: 'host-derived', scope: 'per-target',
        }]
      : undefined
  const persistentAreaOperation = isPersistentArea
    ? {
        id: 'partial-persistent-area', kind: 'create-persistent-area' as const,
        label: spell.name,
        durationRounds: Math.min(5_256_000, auditedDurationRounds(spell)),
        concentration: spell.duration.concentration,
        color: spell.id === 'silent-image' || spell.id === 'major-image'
          ? '#8b5cf6'
          : spell.id === 'unseen-servant'
            ? '#22d3ee'
            : '#6366f1',
        visual: spell.id === 'silent-image' || spell.id === 'major-image'
          ? {
              preset: spell.id === 'major-image' ? 'major-image' as const : 'silent-image' as const,
              intensity: 'strong' as const,
            }
          : spell.id === 'unseen-servant'
            ? { preset: 'unseen-servant' as const, intensity: 'strong' as const }
            : { preset: 'arcane' as const, intensity: 'subtle' as const },
        ...(spell.id === 'major-image' ? {
          // Major Image can be repositioned to any other point in the spell's
          // 120-foot range. Two legal endpoints may be 240 feet apart, so the
          // movement delta and the source-distance tether are separate limits.
          movement: {
            economy: 'action' as const,
            maximumFeet: 240,
            maximumDistanceFromSourceFeet: 120,
          },
          castLevelProfiles: [{
            minimumCastLevel: 6,
            durationRounds: 5_256_000,
            permanent: true as const,
            concentration: false,
          }],
        } : {}),
        ...(spell.id === 'unseen-servant' ? {
          anchorMode: 'fixed' as const,
          creationConstraints: { maximumCreatureCount: 0 },
          movement: {
            economy: 'bonus-action' as const,
            maximumFeet: 15,
            maximumDistanceFromSourceFeet: 60,
            endWhenExceedingSourceDistance: true,
          },
          entityProfile: {
            armorClass: 10,
            hitPoints: 1,
            strength: 2,
            cannotAttack: true,
            invisible: true,
          },
          effectToken: {
            label: spell.name,
            emoji: '◇',
            color: '#94a3b8',
            size: 1,
            hiddenBody: true,
          },
        } : {}),
        ...(spell.id === 'gate' ? {
          anchorMode: 'fixed' as const,
          creationConstraints: { maximumCreatureCount: 0 },
          effectToken: {
            label: spell.name,
            emoji: '◉',
            color: '#7c3aed',
            size: 1,
            hiddenBody: false,
          },
        } : {}),
        ...(spell.id === 'zone-of-truth' ? {
          triggers: [{
            id: 'zone-of-truth-enter', frequencyGroupId: 'zone-of-truth-save',
            label: `${spell.name}·首次进入`, timing: 'on-enter' as const,
            oncePerTurn: true,
            savingThrow: {
              ability: 'cha' as const, dc: 'source-save-dc' as const,
              onSuccess: 'none' as const, magical: true,
            },
          }, {
            id: 'zone-of-truth-turn-start', frequencyGroupId: 'zone-of-truth-save',
            label: `${spell.name}·区域内开始回合`, timing: 'turn-start' as const,
            oncePerTurn: true,
            savingThrow: {
              ability: 'cha' as const, dc: 'source-save-dc' as const,
              onSuccess: 'none' as const, magical: true,
            },
          }],
        } : {}),
        // Partial Activities still commit every deterministic, Host-owned part
        // of the spell before pausing at their explicit DM boundary. Keep the
        // same audited area mechanics as full Activities so effects such as
        // Antimagic Field suppression are not reduced to presentation-only
        // geometry merely because another clause remains DM-assisted.
        ...auditedPersistentAreaExtension(spell),
      }
    : undefined
  return {
    ...activity,
    target,
    castLevelTargetProfiles,
    requirements: spell.id === 'imprisonment'
      ? [
          ...(activity.requirements ?? []),
          { kind: 'active-effect', subject: 'target', effectId: 'imprisonment-immunity', present: false, source: 'self' },
        ]
      : activity.requirements,
    checks,
    choices: spell.id === 'imprisonment' || spell.id === 'plane-shift'
      ? auditedModeChoices(spell)
      : activity.choices,
    effects: concreteEffects.length > 0 ? concreteEffects : undefined,
    scaling: spell.id === 'delayed-blast-fireball'
      ? [
          ...(activity.scaling ?? []),
          {
            basis: 'slot-level', baseLevel: 7,
            adjustments: [{ operationId: 'partial-persistent-area', diceCountPerStep: 1 }],
          },
        ]
      : activity.scaling,
    outcomes: [
      ...(persistentAreaOperation ? [{
        id: 'persistent-area',
        when: { kind: 'always' as const },
        operations: [persistentAreaOperation],
      }] as Dnd5eActivityDefinitionV1['outcomes'] : []),
      ...((spell.id === 'plane-shift' ? [{
        id: 'hostile-banishment-on-failed-save',
        when: {
          kind: 'all' as const,
          conditions: [
            { kind: 'choice' as const, choiceId: 'mode', optionId: 'hostile-banishment' },
            { kind: 'check' as const, checkId: 'spell-attack', result: 'success' as const },
            { kind: 'check' as const, checkId: 'spell-save', result: 'failure' as const },
          ],
        },
        operations: [{
          id: 'apply-plane-shift-transferred', kind: 'apply-effect' as const,
          target: 'target' as const, effectId: 'plane-shift-transferred',
        }],
      }] : spell.id === 'imprisonment' ? [{
        id: 'imprisonment-immunity-on-success',
        when: { kind: 'check' as const, checkId: 'spell-save', result: 'success' as const },
        operations: [{
          id: 'apply-imprisonment-immunity', kind: 'apply-effect' as const,
          target: 'target' as const, effectId: 'imprisonment-immunity',
        }],
      }, ...(AUDITED_MODE_CHOICES.imprisonment ?? []).map((option) => ({
        id: `imprisonment-${option.id}-on-failed-save`,
        when: {
          kind: 'all' as const,
          conditions: [
            { kind: 'check' as const, checkId: 'spell-save', result: 'failure' as const },
            { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
          ],
        },
        operations: [{
          id: `apply-imprisonment-${option.id}`, kind: 'apply-effect' as const,
          target: 'target' as const, effectId: `imprisonment-${option.id}`,
        }],
      }))] : concreteEffect ? [{
        id: checks?.length ? 'deterministic-effect-on-failed-save' : 'deterministic-effect',
        when: spell.id === 'etherealness'
          ? {
              kind: 'predicate' as const,
              predicate: {
                kind: 'active-effect' as const,
                subject: 'actor' as const,
                effectId: 'etherealness',
                present: false,
                source: 'any' as const,
              },
            }
          : checks?.length
          ? { kind: 'check' as const, checkId: checks[0]!.id, result: 'failure' as const }
          : { kind: 'always' as const },
        operations: [{
          id: 'apply-deterministic-effect', kind: 'apply-effect' as const,
          // Transport via Plants targets an entrance point, so its short-lived
          // connection receipt belongs to the caster rather than to an
          // incidental creature standing inside that square.
          target: spell.id === 'etherealness'
            ? 'target' as const
            : spell.id === 'transport-via-plants' || target.kind === 'self'
            ? 'actor' as const
            : 'target' as const,
          effectId: concreteEffect.id,
        }],
      }] : []) as Dnd5eActivityDefinitionV1['outcomes']),
      ...(!['disguise-self', 'illusory-script', 'mirage-arcane', 'plane-shift', 'unseen-servant'].includes(spell.id) ? [{
        id: 'dm-boundary',
        when: spell.id === 'modify-memory' && checks?.[0]
          ? { kind: 'check' as const, checkId: checks[0].id, result: 'failure' as const }
          : { kind: 'always' as const },
        operations: [{
          id: 'dm-adjudication',
          kind: 'manual-adjudication' as const,
          prompt: spell.id === 'guards-and-wards'
            ? '确认施法者在 10 分钟内可步行进入全部相连结界区域，并记录至多 2,500 平方尺、20 尺高度、免疫个体、口令、门／楼梯／走廊效果及一个额外法术效果。建筑几何、门状态、幻象内容、方向误判与再生继续由 DM 跟踪。'
            : spell.id === 'transport-via-plants'
            ? '确认所选 10 尺内入口是一株大型或更大、不会活动的植物；确认玩家指定的出口是同一位面上其曾见过或触碰过的另一株植物。批准后，该连接持续 1 轮，任何生物可花费 5 尺移动力从入口植物走入并从出口植物走出。'
            : spell.id === 'gate'
            ? '确认玩家指定了另一存在位面上的精确位置、传送门正面朝向与 5 至 20 尺直径。只有从正面穿过才会传送；神祇或位面统治者可以阻止门在其面前或领域内开启。若玩家说出特定生物的真名，确认该生物位于另一位面后，将其拉到施法者一侧最近的未占据空间；假名、头衔或绰号无效，且法术不赋予控制。'
            : spell.id === 'tree-stride'
            ? '确认本次树跃使用两株活着、与施法者体型相同或更大的同类树木，且目标树在 500 尺内。进入起点树与从目标树走出各花费 5 尺移动力；移动力不足时施法者出现在起点树 5 尺内。专注期间每轮只能树跃一次，并且每个回合必须在树外结束。'
            : spell.id === 'etherealness'
            ? 'Host 已自动结算目标数量、10 尺距离、持续时间、以太位面移动和跨位面效果隔离。请确认施法者不处于其他非相邻位面；效果结束时若当前位置被实体占据，由 DM 确认最近空位、穿透距离与每尺 2 点力场伤害。'
            : checks?.length
            ? `Host 已完成${spell.name}的权威检定；确认场景语义或开放式规则结果后继续。`
            : `确认${spell.name}的场景语义或开放式规则结果后继续。`,
          reason: spell.id === 'etherealness'
            ? '返回重叠位移与非相邻位面状态仍需 DM 场景裁定。'
            : `只能半自动：${decision.slice(1).join('、')}`,
          requiresDmApproval: true as const,
        }],
      }] : []),
    ],
    automation: automationCapabilityFromLegacyStatus(
      spell.id === 'disguise-self' || spell.id === 'illusory-script' ||
        spell.id === 'mirage-arcane' || spell.id === 'plane-shift' ||
        spell.id === 'unseen-servant'
        ? 'full'
        : 'partial', [
      spell.id === 'guards-and-wards'
        ? 'Host 自动校验 V/S/M、保留价值至少 10 gp 的小银棒、推进 10 分钟施法时间并消费所选法术位；建筑区域与其中全部开放式结界效果由共享 DM 边界裁定。'
        : spell.id === 'transport-via-plants'
        ? 'Host 自动校验 V/S、10 尺入口落点、施法动作与法术位，并追踪 1 轮的植物连接；入口植物资格、同位面且熟悉的出口和每名穿越者 5 尺移动消耗由共享 DM 边界裁定。'
        : spell.id === 'gate'
        ? 'Host 自动校验 V/S/M、5,000 gp 非消耗钻石、60 尺可见未占据落点、5–20 尺直径、施法动作、9 环法术位和 10 轮专注传送门；远端位面位置、正面朝向、位面统治者否决与真名召唤由共享 DM 边界裁定。'
        : spell.id === 'tree-stride'
        ? 'Host 自动校验 V/S、施法动作与法术位，并追踪至多 10 轮的施法者专注状态；同类活树、体型、500 尺目的地、每轮一次、5 尺进入与 5 尺离开及回合在树外结束由共享 DM 边界裁定。'
        : `确定性消耗、目标与持续状态由 Host 管理；${decision.slice(1).join('、')}需要 DM 裁定。`,
      ],
    ),
  }
}

function detectThoughtsControllerEffect(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eEffectDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'detect-thoughts-controller',
    name: `${spell.name}·持续读心`,
    duration: { kind: 'concentration', maximumRounds: 10 },
    grants: [
      'spell:detect-thoughts:surface',
      'spell:detect-thoughts:probe',
      'spell:detect-thoughts:search',
    ],
    concentration: true,
    stacking: 'replace',
  }
}

function detectThoughtsFocusEffect(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eEffectDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'detect-thoughts-focus',
    name: `${spell.name}·当前思想目标`,
    duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-end' },
    tags: ['detect-thoughts-focus'],
    sourceLink: { sourceRequiresEffect: 'detect-thoughts-controller' },
    stacking: 'unique-by-source',
  }
}

function detectThoughtsActivity(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1 {
  const base = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const controller = detectThoughtsControllerEffect(spell)
  const focus = detectThoughtsFocusEffect(spell)
  return {
    ...base,
    target: {
      kind: 'creature', relation: 'any', rangeFeet: 30, count: 1,
      includeSelf: false, requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    requirements: [
      ...(base.requirements ?? []),
      { kind: 'ability-score', subject: 'target', ability: 'int', comparison: 'above', value: 3 },
    ],
    // Reading surface thoughts never calls for a saving throw. The Wisdom
    // save belongs only to the later "probe deeper" action.
    checks: undefined,
    effects: [controller, focus],
    outcomes: [{
      id: 'read-surface-thoughts-on-cast', when: { kind: 'always' }, operations: [{
        id: 'begin-detect-thoughts-concentration', kind: 'apply-effect',
        target: 'actor', effectId: controller.id,
      }, {
        id: 'clear-previous-detect-thoughts-focus', kind: 'remove-effects-by-tag',
        target: 'all-combatants', tags: ['detect-thoughts-focus'], match: 'any', source: 'self',
      }, {
        id: 'focus-detect-thoughts-target', kind: 'apply-effect',
        target: 'target', effectId: focus.id,
      }, {
        id: 'adjudicate-surface-thoughts', kind: 'manual-adjudication',
        prompt: '确认目标会说至少一种语言，并向施法者描述目标此刻最占据意识的表层思想。目标不会察觉这次表层读取。',
        reason: '目标掌握的语言与自然语言思想内容不属于可伪造的客户端字段，需要共享 DM 回应。',
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 自动校验 30 尺、可见性、智力高于 3、V/S/M、动作、法术位和 10 轮专注；DM 只确认目标会说语言并回答表层思想。',
      '初始表层读取不会错误触发感知豁免；深入探查的感知豁免、目标察觉与智力对抗由专注期间的独立 Activity 结算。',
      '看不见思想的搜索与障碍材质厚度保留在专注期间的共享 DM 边界。',
    ]),
  }
}

function contactOtherPlaneActivity(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  return {
    ...activity,
    target: { kind: 'self' },
    checks: [{
      id: 'contact-other-plane-save',
      kind: 'saving-throw',
      rollId: 'contact-other-plane-save-d20',
      ability: 'int',
      dc: { kind: 'constant', value: 15 },
      rollMode: 'host-derived',
      // The spell targets the caster, so the self save is still a concrete
      // creature-target check.  The live Headless compiler routes d20 rolls
      // through per-target Host recipes; marking this as shared left the
      // definition valid in isolation but made real map casting fail closed.
      scope: 'per-target',
    }],
    effects: [{
      schemaVersion: 1,
      id: 'contact-other-plane-madness',
      name: `${spell.name}·疯狂`,
      disposition: 'debuff',
      tags: ['contact-other-plane-madness', 'mental-impairment'],
      duration: { kind: 'permanent' },
      breakOn: ['long-rest-complete'],
      extensionCondition: 'contact-other-plane-madness',
      modifiers: [{
        kind: 'prevent-actions',
      }, {
        kind: 'action-restriction',
        prohibited: ['attack', 'spellcasting', 'object-interaction', 'speech'],
      }, {
        kind: 'language-restriction',
        understandLanguages: false,
        intelligibleCommunication: false,
      }],
      stacking: 'replace',
    }, {
      // The five spoken questions and answers are table conversation, not a
      // second VTT approval workflow.  Keep the printed one-minute window as
      // a visible, Host-owned effect so a successful contact has a concrete
      // lifecycle without turning the DM into a form-filler.
      schemaVersion: 1,
      id: 'contact-other-plane-question-window',
      name: `${spell.name}·异界问答`,
      disposition: 'buff',
      tags: ['contact-other-plane-question-window', 'voice-narrative'],
      duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-end' },
      stacking: 'replace',
    }],
    outcomes: [{
      id: 'failed-save',
      when: {
        kind: 'check', checkId: 'contact-other-plane-save', result: 'failure',
      },
      operations: [{
        id: 'contact-other-plane-psychic-damage',
        kind: 'damage',
        target: 'actor',
        amount: {
          kind: 'dice', rollId: 'contact-other-plane-psychic-damage', count: 6, sides: 6,
        },
        damageType: 'psychic',
        critical: 'normal',
        magical: true,
      }, {
        id: 'apply-contact-other-plane-madness',
        kind: 'apply-effect',
        target: 'actor',
        effectId: 'contact-other-plane-madness',
      }],
    }, {
      id: 'successful-contact',
      when: {
        kind: 'check', checkId: 'contact-other-plane-save', result: 'success',
      },
      operations: [{
        id: 'open-contact-other-plane-question-window',
        kind: 'apply-effect',
        target: 'actor',
        effectId: 'contact-other-plane-question-window',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

function truePolymorphActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  const activity = dnd5eActivityFromSpellDefinition(
    spell as Dnd5ePluginSpellDefinition,
    'headless-action',
  )
  const creatureTarget = {
    kind: 'creature' as const, relation: 'any' as const, rangeFeet: 30, count: 1,
    includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
  }
  return {
    ...activity,
    target: creatureTarget,
    checks: [{
      id: 'spell-save', kind: 'saving-throw', rollId: 'spell-save-d20', ability: 'wis',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      rollMode: 'host-derived', scope: 'per-target', automaticFailureIfAllied: true,
    }],
    choices: [{
      id: 'creature-form', label: '生物形态', options: AUDITED_TRUE_POLYMORPH_FORM_CHOICES,
      defaultOptionId: 'srd-5.1:brown-bear',
    }],
    outcomes: [{
      id: 'creature-to-creature-on-failed-save',
      when: { kind: 'check', checkId: 'spell-save', result: 'failure' },
      operations: [{
        id: 'true-polymorph-creature-form', kind: 'transform-creature', target: 'target',
        formChoiceId: 'creature-form', profile: 'true-polymorph', durationRounds: 600,
        permanentAfterConcentrationCompletes: true, concentration: true,
        maximumChallengeRating: 'target-level-or-challenge-rating',
      }],
    }, {
      id: 'dm-boundary', when: { kind: 'always' }, operations: [{
        id: 'true-polymorph-adjudication', kind: 'manual-adjudication',
        prompt: '确认目标可见且在 30 尺内；不愿意的生物采用 Host 的感知豁免。确认所选新生物 CR 不高于原目标 CR（无 CR 时不高于等级）；维持完整 1 小时专注后变化成为永久效果。对象相关的两种变化模式不由 VTT 自动执行，玩家通过语音描述。',
        reason: '开放式生物目录需要 DM 明示确认；地图或生物与物体之间的变化不进入自动化。',
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 只自动结算生物变生物：30 尺目标、感知豁免、形态数据与生命池、0 HP 超额伤害、装备不可用、专注及满 1 小时永久化；对象相关模式只通过语音叙事。',
    ]),
  }
}

function partialConcreteEffects(
  spell: RegisteredDnd5ePluginSpell,
): readonly Dnd5eEffectDefinitionV1[] {
  const auditedRounds = auditedDurationRounds(spell)
  const rounds = Math.min(14_400, auditedRounds)
  const duration: Dnd5eEffectDefinitionV1['duration'] = spell.duration.concentration
    ? { kind: 'concentration', maximumRounds: rounds }
    : { kind: 'rounds', rounds, expiresAt: 'target-turn-end' }
  if (spell.id === 'etherealness') return [concreteAuditedEffect(spell)!]
  // Truth-detection semantics keep Glibness partial, but the one-hour
  // Charisma-check floor is deterministic. Keep it in the safe subset so a
  // live ability check can actually replace a raw d20 below 15.
  if (spell.id === 'glibness') return [concreteAuditedEffect(spell)!]
  if (spell.id === 'transport-via-plants') return [{
    schemaVersion: 1,
    id: 'transport-via-plants-connection',
    name: `${spell.name}·植物连接`,
    tags: ['portal', 'plant', 'world-state'],
    disposition: 'buff',
    // The exact plant pair and traversal stay in the approved DM receipt, but
    // the Host owns the one-round lifetime so the connection cannot silently
    // remain active after its printed duration.
    duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' },
    stacking: 'replace',
  }]
  if (spell.id === 'tree-stride') return [{
    schemaVersion: 1,
    id: 'tree-stride-teleport',
    name: `${spell.name}·树跃能力`,
    tags: ['teleport', 'plant', 'movement'],
    disposition: 'buff',
    // Tree identity stays DM-assisted because map objects do not yet carry a
    // living/species taxonomy. The granted Activity owns the actual teleport,
    // movement cost and once-per-turn use while this concentration effect lasts.
    duration: { kind: 'concentration', maximumRounds: 10 },
    concentration: true,
    grants: ['spell:tree-stride:teleport'],
    stacking: 'replace',
  }]
  if (spell.id === 'illusory-script') return [{
    schemaVersion: 1,
    id: 'illusory-script-document',
    name: spell.name,
    tags: ['illusion', 'written-object'],
    // The caster is the closed authority carrier because the current map and
    // inventory schemas have no writable-document entity. Each casting keeps
    // its own ten-day lifetime while the exact text and permitted readers are
    // retained in the approved DM-boundary receipt.
    duration: { kind: 'rounds', rounds: auditedRounds, expiresAt: 'target-turn-end' },
    stacking: 'stack',
  }]
  if (spell.id === 'mirage-arcane') return [{
    schemaVersion: 1,
    id: 'mirage-arcane-terrain-illusion',
    name: `${spell.name}·地形幻象`,
    tags: ['illusion', 'terrain', 'world-state', 'multisensory'],
    // Ten campaign days are 14,400 minutes, or 144,000 six-second rounds.
    // Keep the long-lived authority carrier on the caster while the exact
    // chosen terrain remains table communication and never gates settlement.
    duration: { kind: 'rounds', rounds: auditedRounds, expiresAt: 'target-turn-end' },
    stacking: 'replace',
  }]
  if (spell.id === 'imprisonment') {
    const common = {
      schemaVersion: 1 as const,
      duration: { kind: 'permanent' as const },
      tags: ['imprisonment', 'planar-state', 'no-aging', 'no-sustenance'],
      modifiers: [{ kind: 'spell-targeting-immunity' as const, schools: ['divination' as const] }],
      stacking: 'replace' as const,
    }
    return [
      {
        ...common, id: 'imprisonment-immunity', name: `${spell.name}·对本施法者免疫`,
        tags: ['imprisonment-immunity'], modifiers: undefined,
      },
      { ...common, id: 'imprisonment-burial', name: `${spell.name}：埋葬`, extensionCondition: 'imprisonment-burial' },
      {
        ...common, id: 'imprisonment-chaining', name: `${spell.name}：锁链`,
        conditions: ['restrained'], extensionCondition: 'imprisonment-chaining',
      },
      { ...common, id: 'imprisonment-hedged-prison', name: `${spell.name}：封闭监牢`, extensionCondition: 'imprisonment-hedged-prison' },
      { ...common, id: 'imprisonment-minimus-containment', name: `${spell.name}：微缩收容`, extensionCondition: 'imprisonment-minimus-containment' },
      {
        ...common, id: 'imprisonment-slumber', name: `${spell.name}：沉眠`,
        conditions: ['unconscious'], extensionCondition: 'imprisonment-slumber',
      },
    ]
  }
  if (['dominate-beast', 'dominate-monster', 'dominate-person'].includes(spell.id)) return [{
    schemaVersion: 1,
    id: `${spell.id}-dominated`,
    name: spell.name,
    tags: ['charm', 'control'],
    duration,
    conditions: ['charmed'],
    repeatSaveOnDamage: {
      ability: 'wis',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      // The base retry is always required. Advantage when the damage came from
      // the caster or an ally remains a truthful assisted limitation until the
      // pending-save queue carries damage-source provenance.
      mode: 'normal',
      sourceFilter: 'any',
      advantageIfSourceOrAllies: true,
    },
    stacking: 'replace',
  }]
  if (spell.id === 'geas') return [{
    schemaVersion: 1,
    id: 'geas-charmed',
    name: spell.name,
    tags: ['charm', 'command'],
    duration,
    conditions: ['charmed'],
    stacking: 'replace',
  }]
  if (spell.id === 'modify-memory') return [{
    schemaVersion: 1,
    id: 'modify-memory-trance',
    name: spell.name,
    tags: ['charm'],
    duration,
    conditions: ['charmed', 'incapacitated'],
    breakOn: ['takes-damage', 'targeted-by-spell'],
    stacking: 'replace',
  }]
  if (spell.id === 'plane-shift') return [{
    schemaVersion: 1,
    id: 'plane-shift-transferred',
    name: `${spell.name}：已被传送`,
    tags: ['teleport', 'planar-state'],
    disposition: 'debuff',
    // The destination is intentionally left to table narration. This permanent
    // authority marker records the closed result of the failed Charisma save
    // until a DM removes it after the creature returns or leaves the scene.
    duration: { kind: 'permanent' },
    extensionCondition: 'plane-shifted',
    stacking: 'replace',
  }]
  if (spell.id === 'disguise-self') return [{
    schemaVersion: 1,
    id: 'disguise-self-appearance',
    name: spell.name,
    tags: ['illusion', 'disguise', 'appearance', 'externally-usable-activity'],
    grants: ['spell:disguise-self:dismiss', 'spell:disguise-self:inspect'],
    duration,
    stacking: 'replace',
  }]
  return []
}

function auditedDurationRounds(spell: RegisteredDnd5ePluginSpell): number {
  const value = Math.max(1, Math.floor(spell.duration.value ?? 1))
  if (spell.duration.type !== 'timed') return 1
  if (spell.duration.unit === 'round') return value
  if (spell.duration.unit === 'minute') return value * 10
  if (spell.duration.unit === 'hour') return value * 600
  return value * 14_400
}

function auditedSavingThrowAbility(spell: RegisteredDnd5ePluginSpell): AbilityKey | undefined {
  const text = spell.description
  if (/力量豁免|Strength saving throw/i.test(text)) return 'str'
  if (/敏捷豁免|Dexterity saving throw/i.test(text)) return 'dex'
  if (/体质豁免|Constitution saving throw/i.test(text)) return 'con'
  if (/智力豁免|Intelligence saving throw/i.test(text)) return 'int'
  if (/感知豁免|Wisdom saving throw/i.test(text)) return 'wis'
  if (/魅力豁免|Charisma saving throw/i.test(text)) return 'cha'
  return undefined
}

const STRUCTURAL_DECISION_CODES = new Set([
  'saving-throw', 'spell-attack', 'duration', 'concentration', 'slot-scaling',
  'multi-target', 'typed-target', 'mode-choice', 'count-choice', 'action-economy',
])

const AUDITED_RULE_STATE_CODE_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
  aid: [],
  // A Host-owned invisible map entity supplies movement, lifecycle, ordinary
  // sight and 30 ft darkvision through the shared persistent-area primitive.
  'arcane-eye': [],
  // The hand is an independent map entity with Host-owned HP/AC presentation,
  // relocation and granted commands. Push/grapple use the generic opposed
  // ability-check recipe rather than a client-computed contest total.
  'arcane-hand': [],
  // The sword is a Host-owned map entity. Its granted bonus-action Activity
  // atomically relocates the entity up to 20 ft, rolls the spell attack and
  // applies force damage without recreating or trusting a client payload.
  'arcane-sword': [],
  // Host entry events and both alert deliveries are concrete. Choosing an
  // arbitrary designated-creature allow-list or presenting a password during
  // movement still needs a bounded cast/movement input protocol.
  alarm: [],
  // The mapped door/object lock and +10 Host interaction DC are concrete.
  // Password/designated access and Dispel Magic removal remain separate inputs.
  'arcane-lock': [],
  'animal-friendship': [],
  'animal-shapes': [],
  'time-stop': [],
  'antilife-shell': [],
  // Source anchoring, spellcasting suppression and magical ActiveEffect
  // suspension are map-owned. Instantaneous effects crossing the boundary and
  // magic-item activation still need the remaining suppression consumers.
  'antimagic-field': [],
  'beacon-of-hope': [],
  blink: [],
  'branding-smite': [],
  'comprehend-languages': [],
  confusion: [],
  // The casting creates a durable campaign-clock record. Once mature, the
  // ordinary instant-death transaction consumes it and restores the closed
  // body snapshot before death is finalized.
  clone: [],
  // Six disease modes, the cumulative save track and Mindfire's confused
  // turn table are consumed by the shared ActiveEffect turn behavior.
  contagion: [],
  'create-food-and-water': [],
  'detect-evil-and-good': [],
  'detect-magic': [],
  'detect-poison-and-disease': [],
  'divine-word': [],
  // A Host area owns the bead, increments its snapshotted damage declaration
  // at every source turn end, and exposes one entitlement-bound detonation
  // Activity. The client never submits either the accumulated dice or area id.
  'delayed-blast-fireball': [],
  compulsion: [],
  // Protection, source-typed removal and dismissal are concrete. The Host
  // distinguishes extraplanar creature types from local natives when choosing
  // indefinite home-plane return versus the one-minute demiplane interval.
  'dispel-evil-and-good': [],
  // Source-relative Perception, source maintenance and silence/deafness-aware
  // hearing eligibility are all Host-owned generic primitives.
  enthrall: [],
  // A planar-phase ActiveEffect is shared by targeting and map authority:
  // Material/Ethereal creatures cannot interact, material collision is
  // ignored, and vertical movement is unrestricted until the duration ends.
  etherealness: [],
  'faithful-hound': [],
  fear: [],
  // Damage, ability reductions, language/action restrictions, linked recovery
  // and the recurring 30-day Intelligence save are all Host-authoritative.
  feeblemind: [],
  'feather-fall': [],
  // Closed SRD forms, durable placement and the familiar's no-attack rule are
  // concrete. Remote shared-sense rendering remains a map-owned consumer.
  'find-familiar': [],
  'fire-shield': [],
  'fire-storm': [],
  // The selected inventory instance is bound to a durable Host record. Its
  // recall Activity can only transition that exact record, never an arbitrary
  // client-supplied object id.
  'instant-summons': [],
  // The Host owns the body snapshot, possession save, control delegation and
  // return transition. The controlled token never receives executable JSON.
  'magic-jar': [],
  // A terrain planar phase removes cross-boundary interaction and movement;
  // explicit exit/ejection Activities settle the two closed damage outcomes.
  'meld-into-stone': [],
  // The chest/replica link and Material/Ethereal state survive refresh in the
  // same durable authority ledger used by other long-lived spells.
  'secret-chest': [],
  // The duplicate receives an immutable Host body/resource snapshot and is
  // emitted as a persistent companion rather than a prose-only rule marker.
  simulacrum: [],
  // The disk is an independent Host map entity. Reconciliation keeps it still
  // inside 20 ft, follows through a legal path outside that radius, rejects a
  // 10-ft elevation step and removes it beyond 100 ft; its load limit is data.
  'floating-disk': [],
  'flesh-to-stone': [],
  forbiddance: [],
  forcecage: [],
  foresight: [],
  'freedom-of-movement': [],
  // Mist traversal through a mapped crack still needs an explicit geometry
  // opening; all combat and ordinary movement rules are concrete below.
  'gaseous-form': [],
  glibness: [],
  goodberry: [],
  // The corpse receives a timed, tagged Host Effect. Resurrection age omits
  // every round protected by that Effect and undead-animation consumers can
  // query the same closed tag.
  'gentle-repose': [],
  // The map snapshot records the exact globe area containing each creature;
  // spell transactions block base-level 0-5 effects only when they cross its boundary.
  'globe-of-invulnerability': [],
  'guardian-of-faith': [],
  'greater-restoration': [],
  'gust-of-wind': [],
  haste: [],
  levitate: [],
  light: [],
  'heroes-feast': [],
  'holy-aura': [],
  identify: [],
  'incendiary-cloud': [],
  'irresistible-dance': [],
  knock: [],
  eyebite: [],
  'magic-circle': [],
  maze: [],
  // The ordinary creature targeter owns the 120 ft range and line-of-effect.
  // The Host then verifies that the recipient has at least one language and
  // emits a source/target-scoped whisper channel with a single immediate reply.
  message: [],
  // Every attack against the caster receives an independent Host redirection
  // d20. A redirected hit checks AC 10 + DEX, consumes exactly one image, and
  // ordinary sight / blindsight / tremorsense / truesight eligibility is
  // derived from the authoritative combat snapshot.
  'mirror-image': [],
  // The illusion is a Host map entity. Its granted controls own movement and
  // the source/projection sense switch; the actor's invisibility is a separate
  // break-on-attack/cast Effect so the duplicate survives that break.
  mislead: [],
  'mind-blank': [],
  nondetection: [],
  'pass-without-trace': [],
  // A fixed 5 x 20 x 8 ft map volume suppresses mapped wall, door and
  // obstacle barriers for movement, sight and line of effect until expiry.
  passwall: [],
  polymorph: [],
  'private-sanctum': [],
  // The same bounded purifier clears contamination markers from a selected
  // inventory instance or every mapped food/drink object in the validated sphere.
  'purify-food-and-drink': [],
  // The projected image is a movable Host map entity and a selectable remote
  // sight/hearing origin. Speaking/interacting through it uses that same
  // authoritative source token rather than a client-authored spell origin.
  'project-image': [],
  // New condition attempts and incoming attacks are typed Active Effects.
  // Saves against a qualifying condition that predates the spell still need
  // the source-linked repeat-save advantage consumer.
  'protection-from-evil-and-good': [],
  'raise-dead': [],
  'ray-of-enfeeblement': [],
  regenerate: [],
  'resilient-sphere': [],
  // Creature-bound curses are concrete tagged ActiveEffect removal. A curse
  // bound to an equipped item still needs inventory/equipment authority.
  'remove-curse': [],
  // Host summons the SRD riding-horse profile with a 100 ft walk override and
  // starts a ten-round dismissal timer on the first positive damage event.
  'phantom-steed': [],
  resurrection: [],
  revivify: [],
  // Failed initial saves move to the exact top of the validated 100-ft volume.
  // The area supports its airborne occupants until concentration ends; the
  // ordinary Host unsupported-airborne pipeline then owns the fall.
  'reverse-gravity': [],
  stoneskin: [],
  'spider-climb': [],
  // Cast-time thunder and all nine later source-turn stages are represented
  // by lifecycle-bounded area triggers. The round-5 environmental stage also
  // changes movement, vision, ranged-weapon and concentration authority.
  'storm-of-vengeance': [],
  // The Host snapshots every Token occupying the dome at cast time, rejects
  // too many/oversized creatures, enforces one-way vision and spell/movement
  // boundaries, and removes the fixed dome when its source leaves.
  'tiny-hut': [],
  'true-strike': ['target-linked-effect'],
  'true-seeing': [],
  'true-resurrection': [],
  tongues: [],
  'continual-flame': [],
  // Every target receives the same source-linked Host network marker. The
  // communication authority compares source/rules identity, ignores language,
  // and keeps current-map (same-plane) membership bounded by effect duration.
  'telepathic-bond': [],
  'water-breathing': [],
  // Surface traversal is concrete; the separate 60 ft/round rise of an
  // already-submerged target still needs a map vertical-movement handoff.
  'water-walk': [],
  // The one-minute casting time owns the initial transformation. While active,
  // movement, action restrictions and nonmagical weapon resistance are ordinary
  // Effect modifiers; voluntarily dismissing the form creates the ten-round
  // incapacitated transition through the generic after-effect lifecycle.
  'wind-walk': [],
  weird: [],
}

const ALL_ABILITIES: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const DISPEL_EVIL_AND_GOOD_CREATURE_TYPES = [
  'celestial', 'elemental', 'fey', 'fiend', 'undead',
] as const

const AUDITED_BEAST_FORM_CHOICES = DND5E_SRD_MONSTERS
  .filter((monster) => monster.creatureType === '野兽' || monster.creatureType.toLowerCase() === 'beast')
  .sort((left, right) =>
    dnd5eChallengeRatingValue(left.challenge.rating) - dnd5eChallengeRatingValue(right.challenge.rating) ||
    left.name.localeCompare(right.name, 'zh-CN'))
  .map((monster): Dnd5eActivityChoiceOptionV1 => ({
    id: monster.id,
    label: `${monster.name}（CR ${monster.challenge.rating}）`,
    description: `${monster.size}野兽 · AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`,
  }))

const AUDITED_ANIMAL_SHAPES_FORM_CHOICES = AUDITED_BEAST_FORM_CHOICES.filter((choice) => {
  const monster = DND5E_SRD_MONSTERS.find((candidate) => candidate.id === choice.id)
  return !!monster && dnd5eChallengeRatingValue(monster.challenge.rating) <= 4 &&
    !['超大型', '巨型'].includes(monster.size)
})

const AUDITED_SHAPECHANGE_FORM_CHOICES = DND5E_SRD_MONSTERS
  .filter((monster) => {
    const creatureType = monster.creatureType.normalize('NFKC').trim().toLowerCase()
    return dnd5eChallengeRatingValue(monster.challenge.rating) <= 20 &&
      creatureType !== 'construct' && creatureType !== '构装体' && creatureType !== '构装生物' &&
      creatureType !== 'undead' && creatureType !== '亡灵'
  })
  .sort((left, right) =>
    dnd5eChallengeRatingValue(left.challenge.rating) - dnd5eChallengeRatingValue(right.challenge.rating) ||
    left.name.localeCompare(right.name, 'zh-CN'))
  .map((monster): Dnd5eActivityChoiceOptionV1 => ({
    id: monster.id,
    label: `${monster.name}（CR ${monster.challenge.rating}）`,
    description: `${monster.size}${monster.creatureType} · AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`,
  }))

const AUDITED_TRUE_POLYMORPH_FORM_CHOICES = [...DND5E_SRD_MONSTERS]
  .sort((left, right) =>
    dnd5eChallengeRatingValue(left.challenge.rating) - dnd5eChallengeRatingValue(right.challenge.rating) ||
    left.name.localeCompare(right.name, 'zh-CN'))
  .map((monster): Dnd5eActivityChoiceOptionV1 => ({
    id: monster.id,
    label: `${monster.name}（CR ${monster.challenge.rating}）`,
    description: `${monster.size}${monster.creatureType} · AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`,
  }))

const AUDITED_FIND_FAMILIAR_CHOICES: readonly Dnd5eActivityChoiceOptionV1[] = [
  ['srd-5.1:bat', '蝙蝠'], ['srd-5.1:cat', '猫'], ['srd-5.1:crab', '蟹'],
  ['srd-5.1:frog', '青蛙'], ['srd-5.1:hawk', '鹰'], ['srd-5.1:lizard', '蜥蜴'],
  ['srd-5.1:octopus', '章鱼'], ['srd-5.1:owl', '猫头鹰'],
  ['srd-5.1:poisonous-snake', '毒蛇'], ['srd-5.1:quipper', '食人鱼'],
  ['srd-5.1:rat', '老鼠'], ['srd-5.1:raven', '渡鸦'],
  ['srd-5.1:sea-horse', '海马'], ['srd-5.1:spider', '蜘蛛'],
  ['srd-5.1:weasel', '鼬'],
].map(([id, label]) => ({ id, label }))

const AUDITED_CONJURE_CELESTIAL_CHOICES: readonly Dnd5eActivityChoiceOptionV1[] =
  DND5E_SRD_MONSTERS
    .filter((monster) => {
      const creatureType = monster.creatureType.normalize('NFKC').trim().toLowerCase()
      return (creatureType === 'celestial' || creatureType === '天界生物') &&
        dnd5eChallengeRatingValue(monster.challenge.rating) <= 5
    })
    .sort((left, right) =>
      dnd5eChallengeRatingValue(left.challenge.rating) - dnd5eChallengeRatingValue(right.challenge.rating) ||
      left.name.localeCompare(right.name, 'zh-CN'))
    .map((monster): Dnd5eActivityChoiceOptionV1 => ({
      id: monster.id,
      label: `${monster.name}（CR ${monster.challenge.rating}）`,
      description: `${monster.size}${monster.creatureType} · AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`,
    }))

const AUDITED_CONJURE_ELEMENTAL_CHOICES: readonly Dnd5eActivityChoiceOptionV1[] =
  DND5E_SRD_MONSTERS
    .filter((monster) => {
      const creatureType = monster.creatureType.normalize('NFKC').trim().toLowerCase()
      return (creatureType === 'elemental' || creatureType === '元素生物') &&
        dnd5eChallengeRatingValue(monster.challenge.rating) <= 9
    })
    .sort((left, right) =>
      dnd5eChallengeRatingValue(left.challenge.rating) - dnd5eChallengeRatingValue(right.challenge.rating) ||
      left.name.localeCompare(right.name, 'zh-CN'))
    .map((monster): Dnd5eActivityChoiceOptionV1 => ({
      id: monster.id,
      label: `${monster.name}（CR ${monster.challenge.rating}）`,
      description: `${monster.size}${monster.creatureType} · AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`,
    }))

const AUDITED_CONJURE_FEY_CHOICES: readonly Dnd5eActivityChoiceOptionV1[] =
  DND5E_SRD_MONSTERS
    .filter((monster) => {
      const creatureType = monster.creatureType.normalize('NFKC').trim().toLowerCase()
      return (
        creatureType === 'fey' || creatureType === '精类' ||
        creatureType === 'beast' || creatureType === '野兽'
      ) && dnd5eChallengeRatingValue(monster.challenge.rating) <= 9
    })
    .sort((left, right) =>
      dnd5eChallengeRatingValue(left.challenge.rating) - dnd5eChallengeRatingValue(right.challenge.rating) ||
      left.name.localeCompare(right.name, 'zh-CN'))
    .map((monster): Dnd5eActivityChoiceOptionV1 => ({
      id: monster.id,
      label: `${monster.name}（CR ${monster.challenge.rating}）`,
      description: monster.creatureType.normalize('NFKC').trim().toLowerCase() === 'beast' ||
        monster.creatureType.normalize('NFKC').trim() === '野兽'
        ? `精类灵体（${monster.size}野兽形态）· AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`
        : `${monster.size}${monster.creatureType} · AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`,
    }))

const AUDITED_CONJURE_MINOR_ELEMENTAL_CHOICES: readonly Dnd5eActivityChoiceOptionV1[] =
  DND5E_SRD_MONSTERS
    .filter((monster) => {
      const creatureType = monster.creatureType.normalize('NFKC').trim().toLowerCase()
      return (creatureType === 'elemental' || creatureType === '元素生物') &&
        dnd5eChallengeRatingValue(monster.challenge.rating) <= 2
    })
    .sort((left, right) =>
      dnd5eChallengeRatingValue(left.challenge.rating) - dnd5eChallengeRatingValue(right.challenge.rating) ||
      left.name.localeCompare(right.name, 'zh-CN'))
    .map((monster): Dnd5eActivityChoiceOptionV1 => ({
      id: monster.id,
      label: `${monster.name}（CR ${monster.challenge.rating}）`,
      description: `${monster.size}${monster.creatureType} · AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`,
    }))

const AUDITED_CONJURE_WOODLAND_BEING_CHOICES: readonly Dnd5eActivityChoiceOptionV1[] =
  DND5E_SRD_MONSTERS
    .filter((monster) => {
      const creatureType = monster.creatureType.normalize('NFKC').trim().toLowerCase()
      return (creatureType === 'fey' || creatureType === '精类') &&
        dnd5eChallengeRatingValue(monster.challenge.rating) <= 2
    })
    .sort((left, right) =>
      dnd5eChallengeRatingValue(left.challenge.rating) - dnd5eChallengeRatingValue(right.challenge.rating) ||
      left.name.localeCompare(right.name, 'zh-CN'))
    .map((monster): Dnd5eActivityChoiceOptionV1 => ({
      id: monster.id,
      label: `${monster.name}（CR ${monster.challenge.rating}）`,
      description: `${monster.size}${monster.creatureType} · AC ${monster.armorClass.value} · HP ${monster.hitPoints.average}`,
    }))

/**
 * The creature stat block is a Host choice. A seventh-level cast is capped at
 * CR 4; only the printed ninth-level upcast unlocks CR 5. Keeping this helper
 * shared by the DM prompt and Host preparation prevents a client from forging
 * the unicorn choice into a lower-level request.
 */
export function dnd5eConjureCelestialChoicesAtSlotV1(
  slotLevel: number,
): readonly Dnd5eActivityChoiceOptionV1[] {
  const maximumChallengeRating = slotLevel >= 9 ? 5 : 4
  return AUDITED_CONJURE_CELESTIAL_CHOICES.filter((choice) => {
    const monster = DND5E_SRD_MONSTERS.find((candidate) => candidate.id === choice.id)
    return !!monster && dnd5eChallengeRatingValue(monster.challenge.rating) <= maximumChallengeRating
  })
}

/**
 * Conjure Elemental raises its maximum challenge rating by one for every slot
 * above fifth. The Host filters the bounded SRD catalogue using that printed
 * cap, so a client cannot submit the CR 6 invisible stalker to a fifth-level
 * cast.
 */
export function dnd5eConjureElementalChoicesAtSlotV1(
  slotLevel: number,
): readonly Dnd5eActivityChoiceOptionV1[] {
  const maximumChallengeRating = Math.max(5, Math.min(9, Math.floor(slotLevel)))
  return AUDITED_CONJURE_ELEMENTAL_CHOICES.filter((choice) => {
    const monster = DND5E_SRD_MONSTERS.find((candidate) => candidate.id === choice.id)
    return !!monster && dnd5eChallengeRatingValue(monster.challenge.rating) <= maximumChallengeRating
  })
}

/** Conjure Fey raises the selected Fey/Beast-form spirit CR cap with each slot. */
export function dnd5eConjureFeyChoicesAtSlotV1(
  slotLevel: number,
): readonly Dnd5eActivityChoiceOptionV1[] {
  const maximumChallengeRating = Math.max(6, Math.min(9, Math.floor(slotLevel)))
  return AUDITED_CONJURE_FEY_CHOICES.filter((choice) => {
    const monster = DND5E_SRD_MONSTERS.find((candidate) => candidate.id === choice.id)
    return !!monster && dnd5eChallengeRatingValue(monster.challenge.rating) <= maximumChallengeRating
  })
}

/** Host-owned elemental catalogue filtered by the caster's printed formation. */
export function dnd5eConjureMinorElementalChoicesForFormationV1(
  formationId: string,
): readonly Dnd5eActivityChoiceOptionV1[] {
  const formation = CONJURE_MINOR_ELEMENTALS_FORMATIONS.find((candidate) =>
    candidate.id === formationId as ConjureMinorElementalsFormationId)
  if (!formation) return []
  return AUDITED_CONJURE_MINOR_ELEMENTAL_CHOICES.filter((choice) => {
    const monster = DND5E_SRD_MONSTERS.find((candidate) => candidate.id === choice.id)
    return !!monster &&
      dnd5eChallengeRatingValue(monster.challenge.rating) <= formation.maximumChallengeRating
  })
}

/** Host-owned Fey catalogue filtered by the caster's printed formation. */
export function dnd5eConjureWoodlandBeingChoicesForFormationV1(
  formationId: string,
): readonly Dnd5eActivityChoiceOptionV1[] {
  const formation = CONJURE_MINOR_ELEMENTALS_FORMATIONS.find((candidate) =>
    candidate.id === formationId as ConjureMinorElementalsFormationId)
  if (!formation) return []
  return AUDITED_CONJURE_WOODLAND_BEING_CHOICES.filter((choice) => {
    const monster = DND5E_SRD_MONSTERS.find((candidate) => candidate.id === choice.id)
    return !!monster &&
      dnd5eChallengeRatingValue(monster.challenge.rating) <= formation.maximumChallengeRating
  })
}

const AUDITED_MODE_CHOICES: Readonly<Record<string, readonly Dnd5eActivityChoiceOptionV1[]>> = {
  'animal-shapes': AUDITED_ANIMAL_SHAPES_FORM_CHOICES,
  shapechange: AUDITED_SHAPECHANGE_FORM_CHOICES,
  'find-familiar': AUDITED_FIND_FAMILIAR_CHOICES,
  'conjure-celestial': AUDITED_CONJURE_CELESTIAL_CHOICES,
  'conjure-elemental': AUDITED_CONJURE_ELEMENTAL_CHOICES,
  'conjure-fey': AUDITED_CONJURE_FEY_CHOICES,
  'conjure-minor-elementals': AUDITED_CONJURE_MINOR_ELEMENTAL_CHOICES,
  'conjure-woodland-beings': AUDITED_CONJURE_WOODLAND_BEING_CHOICES,
  levitate: [
    { id: 'up-5', label: '上升 5 尺' },
    { id: 'up-10', label: '上升 10 尺' },
    { id: 'up-15', label: '上升 15 尺' },
    { id: 'up-20', label: '上升 20 尺' },
    { id: 'down-5', label: '下降 5 尺' },
    { id: 'down-10', label: '下降 10 尺' },
    { id: 'down-15', label: '下降 15 尺' },
    { id: 'down-20', label: '下降 20 尺' },
  ],
  alarm: [
    { id: 'mental', label: '心灵警报（通知施法者）' },
    { id: 'audible', label: '声音警报（60 尺内可听）' },
  ],
  nondetection: [
    {
      id: 'willing-creature', label: '人物',
      description: '选择地图上的一名自愿生物，并添加回避侦测状态。',
      targetOverride: {
        kind: 'creature', relation: 'any', rangeFeet: 5, count: 1,
        includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
    },
    {
      id: 'place-or-mapped-object', label: '物件',
      description: '仅结算动作和 3 环法术位，不在地图上生成状态。',
      targetOverride: { kind: 'self' },
    },
  ],
  'plane-shift': [
    {
      id: 'willing-travel', label: '友方传送',
      targetOverride: { kind: 'self' },
    },
    {
      id: 'hostile-banishment', label: '敌方传送',
      targetOverride: {
        kind: 'creature', relation: 'enemy', rangeFeet: 5, count: 1,
        includeSelf: false, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
    },
  ],
  light: [
    {
      id: 'carried-object', label: '由生物携带／穿戴的物件',
      targetOverride: {
        kind: 'creature', relation: 'any', rangeFeet: 5, count: 1,
        includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
    },
    {
      id: 'mapped-object', label: '地图上的门、障碍物或容器',
      targetOverride: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 5, radiusFeet: 5, maximumTargets: 1,
      },
    },
  ],
  'purify-food-and-drink': [
    {
      id: 'carried-consumable', label: '库存中的食物或饮品',
      targetOverride: { kind: 'self' },
    },
    {
      id: 'mapped-consumables', label: '地图范围内的食物与饮品',
      targetOverride: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'sphere',
        placeRangeFeet: 10, radiusFeet: 5, maximumTargets: 64,
        includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
    },
  ],
  contagion: [
    { id: 'blinding-sickness', label: '致盲病' },
    { id: 'filth-fever', label: '污秽热' },
    { id: 'flesh-rot', label: '腐肉症' },
    { id: 'mindfire', label: '心火症' },
    { id: 'seizure', label: '痉挛症' },
    { id: 'slimy-doom', label: '黏液厄运' },
  ],
  eyebite: [
    { id: 'asleep', label: '沉睡' },
    { id: 'panicked', label: '惊慌' },
    { id: 'sickened', label: '患病' },
  ],
  imprisonment: [
    { id: 'burial', label: '埋葬' },
    { id: 'chaining', label: '锁链' },
    { id: 'hedged-prison', label: '封闭监牢' },
    { id: 'minimus-containment', label: '微缩收容' },
    { id: 'slumber', label: '沉眠' },
  ],
  'magic-circle': [
    { id: 'celestial-enter', label: '天界生物·禁止进入' }, { id: 'celestial-exit', label: '天界生物·反向禁止离开' },
    { id: 'elemental-enter', label: '元素生物·禁止进入' }, { id: 'elemental-exit', label: '元素生物·反向禁止离开' },
    { id: 'fey-enter', label: '精类·禁止进入' }, { id: 'fey-exit', label: '精类·反向禁止离开' },
    { id: 'fiend-enter', label: '邪魔·禁止进入' }, { id: 'fiend-exit', label: '邪魔·反向禁止离开' },
    { id: 'undead-enter', label: '亡灵·禁止进入' }, { id: 'undead-exit', label: '亡灵·反向禁止离开' },
  ],
  'fire-shield': [
    { id: 'warm', label: '暖盾（抵抗寒冷，反射火焰）' },
    { id: 'chill', label: '寒盾（抵抗火焰，反射寒冷）' },
  ],
  'fire-storm': [
    {
      id: 'affect-plants',
      label: '影响植物',
      description: '区域内的植物生物照常进行敏捷豁免并承受火焰伤害。',
    },
    {
      id: 'spare-plants',
      label: '保护植物',
      description: '区域内的植物生物不进行敏捷豁免，也不受本次火焰风暴影响。',
    },
  ],
  forcecage: [
    {
      id: 'cage',
      label: '20 尺栅笼',
      description: '阻止生物穿越边界；攻击、视线与法术效应仍可穿过栅栏。',
      targetOverride: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
        placeRangeFeet: 100, lengthFeet: 20, widthFeet: 20, heightFeet: 20,
        maximumTargets: 256, includeSelf: true,
      },
    },
    {
      id: 'box',
      label: '10 尺实体箱',
      description: '实体屏障阻止移动和法术作用线穿越边界。',
      targetOverride: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
        placeRangeFeet: 100, lengthFeet: 10, widthFeet: 10, heightFeet: 10,
        maximumTargets: 256, includeSelf: true,
      },
    },
  ],
  'greater-restoration': [
    { id: 'exhaustion', label: '降低一层力竭' },
    { id: 'charmed', label: '结束魅惑' },
    { id: 'petrified', label: '结束石化' },
    { id: 'curse', label: '结束一个诅咒' },
    { id: 'contact-other-plane-madness', label: '结束异界探知造成的疯狂' },
    { id: 'ability-str', label: '恢复力量减值' },
    { id: 'ability-dex', label: '恢复敏捷减值' },
    { id: 'ability-con', label: '恢复体质减值' },
    { id: 'ability-int', label: '恢复智力减值' },
    { id: 'ability-wis', label: '恢复感知减值' },
    { id: 'ability-cha', label: '恢复魅力减值' },
    { id: 'maximum-hit-points', label: '恢复最大生命值减值' },
  ],
  polymorph: AUDITED_BEAST_FORM_CHOICES,
}

function auditedChoiceOperations(
  spell: RegisteredDnd5ePluginSpell,
  optionId: string,
): readonly Dnd5eActivityOperationV1[] {
  if (spell.id === 'levitate') {
    const match = optionId.match(/^(up|down)-(5|10|15|20)$/)
    if (match) return [{
      id: `levitate-${optionId}`, kind: 'move', target: 'target',
      mode: match[1] === 'up' ? 'ascend' : 'descend',
      distanceFeet: { kind: 'constant', value: Number(match[2]) },
      ignoresOpportunityAttacks: true,
    }]
  }
  if (spell.id === 'light' && optionId === 'carried-object') return [{
    id: `${spell.id}-carried-object-light`, kind: 'apply-effect',
    target: 'all-targets', effectId: spell.id,
  }]
  if (spell.id === 'nondetection' && optionId === 'willing-creature') return [{
    id: 'nondetection-willing-creature', kind: 'apply-effect',
    target: 'all-targets', effectId: 'nondetection',
  }]
  if (spell.id === 'nondetection' && optionId === 'place-or-mapped-object') return [{
    id: 'nondetection-object-resource-only', kind: 'mechanic',
    target: 'actor', handlerId: 'core.resolve-only', parameters: {},
  }]
  if (spell.id === 'light' && optionId === 'mapped-object') return [{
    id: `${spell.id}-mapped-object-light`, kind: 'enchant-map-object-light',
    brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fef3c7',
    durationMinutes: 60,
  }]
  if (spell.id === 'purify-food-and-drink' && optionId === 'carried-consumable') return [{
    id: 'purify-selected-consumable', kind: 'purify-inventory-item', target: 'actor',
  }]
  if (spell.id === 'purify-food-and-drink' && optionId === 'mapped-consumables') return [{
    id: 'purify-mapped-consumables', kind: 'purify-map-consumables',
    contaminants: ['poison', 'disease'],
  }]
  if (spell.id === 'find-familiar' && AUDITED_FIND_FAMILIAR_CHOICES.some((choice) => choice.id === optionId)) {
    return [{
      id: `find-familiar-${optionId.replace(/^srd-5\.1:/, '')}`,
      kind: 'summon', monsterId: optionId,
      count: { kind: 'constant', value: 1 }, timing: 'immediate',
      durationRounds: 10_000, concentration: false, side: 'ally',
      persistent: true, cannotAttack: true,
    }]
  }
  if (spell.id === 'magic-circle') {
    const typeAliases: Readonly<Record<string, readonly string[]>> = {
      celestial: ['celestial', '天界生物'], elemental: ['elemental', '元素生物'],
      fey: ['fey', '精类'], fiend: ['fiend', '邪魔'], undead: ['undead', '亡灵'],
    }
    const [typeId, direction] = optionId.split('-')
    const includedCreatureTypes = typeAliases[typeId]
    if (includedCreatureTypes) return [{
      id: `magic-circle-${optionId}`, kind: 'create-persistent-area', label: spell.name,
      durationRounds: auditedDurationRounds(spell), concentration: false,
      visual: { preset: 'arcane', intensity: 'normal' },
      blocking: { movement: true, movementMode: direction === 'exit' ? 'exit' : 'enter', includedCreatureTypes },
      occupantModifiers: {
        attacksAgainstOccupantDisadvantageCreatureTypes: [typeId],
        conditionImmunitiesBySourceCreatureType: [{
          conditions: ['charmed', 'frightened', 'possessed'], sourceCreatureTypes: [typeId],
        }],
        savingThrowAdvantagesBySourceCreatureType: [{
          conditions: ['any'], sourceCreatureTypes: [typeId],
        }],
      },
      anchorMode: 'fixed',
    }]
  }
  if ((spell.id === 'polymorph' || spell.id === 'animal-shapes' || spell.id === 'shapechange') &&
    (spell.id === 'polymorph'
      ? AUDITED_BEAST_FORM_CHOICES
      : spell.id === 'animal-shapes'
        ? AUDITED_ANIMAL_SHAPES_FORM_CHOICES
        : AUDITED_SHAPECHANGE_FORM_CHOICES)
      .some((option) => option.id === optionId)) return [{
    id: `${spell.id}-transform-${optionId}`,
    kind: 'transform-creature',
    target: spell.id === 'animal-shapes' ? 'all-targets' : spell.id === 'shapechange' ? 'actor' : 'target',
    formChoiceId: 'mode',
    profile: spell.id,
    durationRounds: auditedDurationRounds(spell),
    concentration: true,
    maximumChallengeRating: spell.id === 'animal-shapes' ? 4 : 'target-level-or-challenge-rating',
    maximumSizeRank: spell.id === 'animal-shapes' ? 3 : undefined,
    equipmentChoiceId: spell.id === 'shapechange' ? 'equipment' : undefined,
    seenConfirmationChoiceId: spell.id === 'shapechange' ? 'seen' : undefined,
  }]
  if (spell.id === 'alarm' && (optionId === 'mental' || optionId === 'audible')) return [{
    id: `alarm-area-${optionId}`,
    kind: 'create-persistent-area',
    label: spell.name,
    durationRounds: Math.min(14_400, auditedDurationRounds(spell)),
    concentration: false,
    color: '#f59e0b',
    visual: { preset: 'arcane', intensity: 'subtle' },
    triggers: [{
      id: `alarm-enter-${optionId}`,
      label: optionId === 'mental' ? `${spell.name}·心灵警报` : `${spell.name}·声音警报`,
      timing: 'on-enter',
      oncePerRound: false,
      notification: optionId === 'mental'
        ? { delivery: 'mental-to-source' }
        : { delivery: 'audible', audibleRadiusFeet: 60 },
    }],
    triggerExemptions: 'selected-creatures',
  }]
  if (spell.id === 'forcecage' && (optionId === 'cage' || optionId === 'box')) return [{
    id: `forcecage-area-${optionId}`,
    kind: 'create-persistent-area',
    label: optionId === 'cage' ? `${spell.name}·栅笼` : `${spell.name}·实体箱`,
    durationRounds: Math.min(14_400, auditedDurationRounds(spell)),
    concentration: false,
    color: '#7c3aed',
    visual: { preset: 'arcane', intensity: 'strong' },
    blocking: optionId === 'box'
      ? {
          movement: true,
          movementMode: 'boundary',
          lineOfEffect: true,
          lineOfEffectMode: 'boundary',
        }
      : { movement: true, movementMode: 'boundary' },
    teleportationExitSavingThrow: { ability: 'cha', dc: 'source-save-dc' },
    anchorMode: 'fixed',
  }]
  if (spell.id !== 'greater-restoration') return []
  const target = 'all-targets' as const
  if (optionId === 'exhaustion') return [{
    id: 'greater-restoration-exhaustion', kind: 'adjust-exhaustion', target,
    amount: { kind: 'constant', value: -1 },
  }]
  if (optionId === 'charmed' || optionId === 'petrified') return [{
    id: `greater-restoration-${optionId}`, kind: 'remove-standard-condition', target,
    condition: optionId,
  }]
  if (optionId.startsWith('ability-')) return [{
    id: `greater-restoration-${optionId}`, kind: 'recover-ability-score', target,
    ability: optionId.slice('ability-'.length) as AbilityKey, maximumCount: 1,
  }]
  if (optionId === 'maximum-hit-points') return [{
    id: 'greater-restoration-maximum-hit-points', kind: 'recover-hit-point-maximum',
    target, maximumCount: 1,
  }]
  const tag = optionId === 'curse'
    ? 'curse'
    : optionId === 'contact-other-plane-madness'
      ? 'contact-other-plane-madness'
      : undefined
  return tag ? [{
    id: `greater-restoration-${optionId}`, kind: 'remove-effects-by-tag', target,
    tags: [tag], match: 'any', source: 'any', maximumCount: 1,
  }] : []
}

function auditedModeChoices(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1['choices'] {
  const options = AUDITED_MODE_CHOICES[spell.id]
  if (!options?.length) return undefined
  const modeChoice = {
    id: 'mode',
    label: spell.id === 'shapechange' ? '新形态' : `${spell.name}效果`,
    options,
    defaultOptionId: options[0]!.id,
  }
  return spell.id === 'shapechange'
    ? [modeChoice, {
        id: 'equipment', label: '装备处理',
        options: [
          { id: 'merge', label: '融入新形态', description: '融入的装备在该状态下不产生效应。' },
          { id: 'wear', label: '由新形态穿戴', description: 'DM 仍需按形状和体型确认每件装备是否可穿戴。' },
          { id: 'drop', label: '掉落在地', description: '装备留在施法位置。' },
        ],
        defaultOptionId: 'merge',
      }, {
        id: 'seen', label: '形态熟悉度',
        options: [
          { id: 'confirmed', label: '我至少见过该种生物一次' },
          { id: 'not-confirmed', label: '我没有见过该种生物（不能采用此形态）' },
        ],
        defaultOptionId: 'confirmed',
      }]
    : [modeChoice]
}

function concreteAuditedEffect(spell: RegisteredDnd5ePluginSpell): Dnd5eEffectDefinitionV1 | undefined {
  const rounds = auditedDurationRounds(spell)
  const ordinaryDuration: Dnd5eEffectDefinitionV1['duration'] = spell.duration.concentration
    ? { kind: 'concentration', maximumRounds: rounds }
    : spell.duration.type === 'until-dispelled'
      ? { kind: 'permanent' }
      : { kind: 'rounds', rounds, expiresAt: 'target-turn-end' }
  if (spell.id === 'shapechange') return {
    schemaVersion: 1, id: 'shapechange-controller', name: `${spell.name}·形态控制`,
    disposition: 'buff', duration: ordinaryDuration,
    grants: ['spell:shapechange:change-form'],
    concentration: true, stacking: 'replace',
  }
  if (spell.id === 'aid') return {
    schemaVersion: 1, id: 'aid', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'hit-point-maximum', mode: 'add', increaseCurrentHitPoints: true,
      value: {
        kind: 'multiply', values: [
          { kind: 'constant', value: 5 },
          {
            kind: 'add', values: [
              { kind: 'constant', value: 1 },
              { kind: 'reference', reference: { kind: 'slot-delta', baseLevel: 2 } },
            ],
          },
        ],
      },
    }],
    stacking: 'replace',
  }
  if (spell.id === 'animal-friendship') return {
    schemaVersion: 1, id: 'animal-friendship', name: spell.name,
    duration: ordinaryDuration, conditions: ['charmed'],
    sourceLink: { targetHarmedBySourceAlly: true }, stacking: 'replace',
  }
  if (spell.id === 'beacon-of-hope') return {
    schemaVersion: 1, id: 'beacon-of-hope', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      { kind: 'saving-throw', ability: 'wis', mode: 'advantage' },
      { kind: 'death-saving-throw', mode: 'advantage' },
      { kind: 'maximize-healing-dice' },
    ],
    stacking: 'replace',
  }
  if (spell.id === 'comprehend-languages') return {
    schemaVersion: 1, id: 'comprehend-languages', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'language-capability',
      understandSpoken: 'all',
      understandWritten: 'literal-written',
      writtenRequiresTouch: true,
      writtenMinutesPerPage: 1,
    }],
    stacking: 'replace',
  }
  if (spell.id === 'confusion') return {
    schemaVersion: 1, id: 'confusion', name: spell.name,
    duration: {
      kind: 'save-ends', maximumRounds: auditedDurationRounds(spell),
      timing: 'target-turn-end', ability: 'wis',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
    },
    extensionCondition: 'confused-behavior',
    modifiers: [{ kind: 'prohibit-reaction' }],
    concentration: true,
    stacking: 'replace',
  }
  if (spell.id === 'fear') return {
    schemaVersion: 1, id: 'fear', name: spell.name,
    duration: ordinaryDuration, conditions: ['frightened'],
    modifiers: [{ kind: 'forced-flee-from-source' }], stacking: 'replace',
  }
  if (spell.id === 'feeblemind') return {
    schemaVersion: 1, id: 'feeblemind', name: spell.name,
    tags: ['feeblemind', 'mental-impairment', 'ability-recovery-group:spell.feeblemind'],
    duration: { kind: 'permanent' },
    modifiers: [{
      kind: 'action-restriction',
      prohibited: ['spellcasting', 'object-interaction', 'speech'],
    }, {
      kind: 'language-restriction',
      understandLanguages: false,
      intelligibleCommunication: false,
    }],
    calendarRepeatSave: {
      intervalMinutes: 30 * 24 * 60,
      ability: 'int',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      onSuccess: 'remove',
    },
    stacking: 'replace',
  }
  if (spell.id === 'gentle-repose') return {
    schemaVersion: 1, id: 'gentle-repose', name: spell.name,
    tags: ['corpse-preservation', 'prevents-undead-animation'],
    duration: ordinaryDuration,
    stacking: 'replace',
  }
  if (spell.id === 'mirror-image') return {
    schemaVersion: 1, id: 'mirror-image', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'attack-decoys',
      count: 3,
      redirectMinimumD20: [11, 8, 6],
      armorClassBase: 10,
      armorClassAbility: 'dex',
      requiresOrdinarySight: true,
    }],
    removalAction: {
      label: '解除镜影术',
      economy: 'action',
      maxDistanceFeet: 0,
    },
    stacking: 'replace',
  }
  if (spell.id === 'dispel-evil-and-good') return {
    schemaVersion: 1, id: 'dispel-evil-and-good', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'attacks-against-target-by-creature-type', mode: 'disadvantage',
      sourceCreatureTypes: DISPEL_EVIL_AND_GOOD_CREATURE_TYPES,
    }],
    grants: [
      'spell:dispel-evil-and-good:break-enchantment',
      'spell:dispel-evil-and-good:dismissal',
    ],
    concentration: true,
    stacking: 'replace',
  }
  if (spell.id === 'enthrall') return {
    schemaVersion: 1, id: 'enthrall', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'perception-target-lock',
      disadvantageAgainstOthersThanSource: true,
    }],
    sourceLink: { sourceMustBeConsciousAndAbleToSpeak: true },
    stacking: 'replace',
  }
  if (spell.id === 'etherealness') return {
    schemaVersion: 1, id: 'etherealness', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'planar-phase',
      plane: 'ethereal',
      ignoresMaterialCollision: true,
      suppressCrossPlaneEffects: true,
      unrestrictedVerticalMovement: true,
    }],
    removalAction: {
      label: '解除以太化',
      economy: 'action',
      maxDistanceFeet: 0,
    },
    stacking: 'replace',
  }
  if (spell.id === 'flesh-to-stone') return {
    schemaVersion: 1, id: 'flesh-to-stone', name: spell.name,
    duration: {
      kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end', ability: 'con',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      successesRequired: 3, failuresRequired: 3, initialFailures: 1,
      onFailureThreshold: {
        replaceWithCondition: 'petrified',
        duration: 'source-concentration-then-permanent',
      },
    },
    conditions: ['restrained'], concentration: true, stacking: 'replace',
  }
  if (spell.id === 'foresight') return {
    schemaVersion: 1, id: 'foresight', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      { kind: 'attack-roll', mode: 'advantage' },
      { kind: 'attacks-against-target', mode: 'disadvantage' },
      { kind: 'cannot-be-surprised-while-conscious' },
      ...ALL_ABILITIES.map((ability) => ({ kind: 'saving-throw' as const, ability, mode: 'advantage' as const })),
      ...ALL_ABILITIES.map((ability) => ({ kind: 'ability-check' as const, ability, mode: 'advantage' as const })),
    ],
    stacking: 'replace',
  }
  if (spell.id === 'feather-fall') return {
    schemaVersion: 1, id: 'feather-fall', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      { kind: 'safe-fall', maximumFeet: 600 },
      { kind: 'controlled-descent', maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true },
    ],
    stacking: 'replace',
  }
  if (spell.id === 'branding-smite') return {
    schemaVersion: 1, id: 'branding-smite', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'on-hit-bonus-damage',
      amount: { kind: 'dice', rollId: 'branding-smite-damage', count: 2, sides: 6 },
      damageType: 'radiant',
      appliesTo: 'all-weapon-attacks',
      doubleDiceOnCritical: true,
      onHitTargetEffect: {
        revealInvisible: true,
        preventInvisibility: true,
        emittedLight: { brightRadiusFeet: 0, dimRadiusFeet: 5, color: '#fef3c7' },
      },
    }],
    concentration: true,
    stacking: 'replace',
  }
  if (spell.id === 'freedom-of-movement') return {
    schemaVersion: 1, id: 'freedom-of-movement', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      {
        kind: 'condition-immunity-by-source-magic',
        conditions: ['paralyzed', 'restrained'], sourceMagical: true, suppressExisting: true,
      },
      {
        kind: 'environmental-capability',
        ignoreDifficultTerrain: true,
        ignoreUnderwaterMovementPenalty: true,
        ignoreUnderwaterAttackPenalty: true,
      },
      {
        kind: 'automatic-escape', conditions: ['grappled', 'restrained'],
        movementCostFeet: 5, sourceMagical: false,
      },
      { kind: 'ignore-magical-speed-reductions' },
    ],
    stacking: 'replace',
  }
  if (spell.id === 'gaseous-form') return {
    schemaVersion: 1, id: 'gaseous-form', name: spell.name,
    duration: ordinaryDuration,
    breakOn: ['reduced-to-zero'],
    modifiers: [
      { kind: 'speed', mode: 'override', value: { kind: 'constant', value: 10 } },
      { kind: 'flight-speed', speedFeet: 10, hover: true },
      {
        kind: 'conditional-damage-resistance',
        damageTypes: [...DND5E_DAMAGE_TYPES], sourceMagical: false,
      },
      ...(['str', 'dex', 'con'] as const).map((ability) => ({
        kind: 'saving-throw' as const, ability, mode: 'advantage' as const,
      })),
      {
        kind: 'action-restriction',
        prohibited: ['attack', 'spellcasting', 'object-interaction', 'speech'],
      },
      {
        kind: 'environmental-capability',
        treatLiquidSurfacesAsSolidGround: true,
        occupyCreatureSpaces: true,
        minimumPassageGapInches: 1,
      },
    ],
    stacking: 'replace',
  }
  if (spell.id === 'haste') return {
    schemaVersion: 1, id: 'haste', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      { kind: 'armor-class', mode: 'add', value: { kind: 'constant', value: 2 } },
      { kind: 'speed', mode: 'multiply', value: { kind: 'constant', value: 2 } },
      { kind: 'saving-throw', ability: 'dex', mode: 'advantage' },
      {
        kind: 'restricted-extra-action',
        allowedActions: ['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'],
        maximumWeaponAttacks: 1,
      },
    ],
    afterEffectEnds: {
      duration: 'until-target-next-turn-end',
      preventActions: true,
      preventMovement: true,
    },
    stacking: 'replace',
  }
  if (spell.id === 'glibness') return {
    schemaVersion: 1, id: 'glibness', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{ kind: 'minimum-ability-check-d20', ability: 'cha', minimum: 15 }],
    stacking: 'replace',
  }
  if (spell.id === 'heroes-feast') return {
    schemaVersion: 1, id: 'heroes-feast', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      {
        kind: 'hit-point-maximum', mode: 'add', increaseCurrentHitPoints: true,
        value: { kind: 'dice', rollId: 'heroes-feast-hit-points', count: 2, sides: 10 },
      },
      { kind: 'saving-throw', ability: 'wis', mode: 'advantage' },
      { kind: 'condition-immunity', condition: 'frightened' },
      { kind: 'condition-immunity', condition: 'poisoned' },
      { kind: 'damage-immunity', damageType: 'poison' },
    ],
    stacking: 'replace',
  }
  if (spell.id === 'irresistible-dance') return {
    schemaVersion: 1, id: 'irresistible-dance', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      { kind: 'speed', mode: 'override', value: { kind: 'constant', value: 0 } },
      { kind: 'attack-roll', mode: 'disadvantage' },
      { kind: 'saving-throw', ability: 'dex', mode: 'disadvantage' },
      { kind: 'attacks-against-target', mode: 'advantage' },
    ],
    escapeSavingThrow: {
      ability: 'wis',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      economy: 'action',
    },
    stacking: 'replace',
  }
  if (spell.id === 'levitate') return {
    schemaVersion: 1, id: 'levitate-target', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{ kind: 'magically-held-aloft' }],
    concentration: true,
    stacking: 'replace',
  }
  if (spell.id === 'holy-aura') return {
    schemaVersion: 1, id: 'holy-aura', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      ...ALL_ABILITIES.map((ability) => ({
        kind: 'saving-throw' as const, ability, mode: 'advantage' as const,
      })),
      { kind: 'attacks-against-target' as const, mode: 'disadvantage' as const },
      { kind: 'emitted-light' as const, brightRadiusFeet: 0, dimRadiusFeet: 5, color: '#fff7d6' },
    ],
    stacking: 'replace',
  }
  if (spell.id === 'mind-blank') return {
    schemaVersion: 1, id: 'mind-blank', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      { kind: 'damage-immunity', damageType: 'psychic' },
      { kind: 'condition-immunity', condition: 'charmed' },
      { kind: 'spell-targeting-immunity', schools: ['divination'] },
    ],
    stacking: 'replace',
  }
  if (spell.id === 'maze') return {
    schemaVersion: 1, id: 'maze', name: spell.name,
    duration: { kind: 'concentration', maximumRounds: auditedDurationRounds(spell) },
    extensionCondition: 'banished',
    escapeCheck: {
      ability: 'int', dc: { kind: 'constant', value: 20 }, economy: 'action',
      automaticSuccessStatBlockIds: ['srd-5.1:minotaur', 'srd-5.1:goristro'],
    },
    concentration: true,
    stacking: 'replace',
  }
  if (spell.id === 'light') return {
    schemaVersion: 1, id: spell.id, name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'emitted-light', brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fef3c7',
    }],
    // Light explicitly permits a saving throw only when the object is held or
    // worn by a hostile creature. It is also limited to one live casting per
    // source, even when the next casting chooses a different creature.
    stacking: 'unique-by-source',
  }
  if (spell.id === 'nondetection') return {
    schemaVersion: 1, id: 'nondetection', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{ kind: 'spell-targeting-immunity', schools: ['divination'] }],
    stacking: 'replace',
  }
  if (spell.id === 'protection-from-evil-and-good') return {
    schemaVersion: 1, id: 'protection-from-evil-and-good', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [
      {
        kind: 'attacks-against-target-by-creature-type', mode: 'disadvantage',
        sourceCreatureTypes: ['aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead'],
      },
      {
        kind: 'condition-immunity-by-source-creature-type',
        conditions: ['charmed', 'frightened', 'possessed'],
        sourceCreatureTypes: ['aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead'],
      },
      {
        kind: 'saving-throw-advantage-by-source-creature-type',
        conditions: ['charmed', 'frightened', 'possessed'],
        sourceCreatureTypes: ['aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead'],
      },
    ],
    stacking: 'replace',
  }
  if (spell.id === 'pass-without-trace') return {
    schemaVersion: 1, id: 'pass-without-trace', name: spell.name,
    disposition: 'buff',
    duration: ordinaryDuration,
    modifiers: [
      {
        kind: 'skill-check-bonus-aura', skill: 'stealth', bonus: 10,
        radiusFeet: 30, relation: 'ally-and-self',
        mundaneTracking: 'impossible', leavesTracks: false,
      },
    ],
    stacking: 'replace',
  }
  if (spell.id === 'regenerate') return {
    schemaVersion: 1, id: 'regenerate', name: spell.name,
    duration: ordinaryDuration,
    periodicHealing: {
      timing: 'target-turn-start',
      amount: { kind: 'constant', value: 1 },
    },
    bodyRestoration: { afterRounds: 20 },
    stacking: 'replace',
  }
  if (spell.id === 'ray-of-enfeeblement') return {
    schemaVersion: 1, id: 'ray-of-enfeeblement', name: spell.name,
    duration: {
      kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end', ability: 'con',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
    },
    modifiers: [{ kind: 'weapon-damage-multiplier', multiplier: 0.5, ability: 'str' }],
    concentration: true,
    stacking: 'replace',
  }
  if (spell.id === 'spider-climb') return {
    schemaVersion: 1, id: 'spider-climb', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{ kind: 'climb-speed', mode: 'walking-speed' }],
    stacking: 'replace',
  }
  if (spell.id === 'stoneskin') return {
    schemaVersion: 1, id: 'stoneskin', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'conditional-damage-resistance',
      damageTypes: ['bludgeoning', 'piercing', 'slashing'],
      sourceMagical: false,
    }],
    stacking: 'replace',
  }
  if (spell.id === 'true-seeing') return {
    schemaVersion: 1, id: 'true-seeing', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{ kind: 'truesight', rangeFeet: 120 }],
    stacking: 'replace',
  }
  if (spell.id === 'tongues') return {
    schemaVersion: 1, id: 'tongues', name: spell.name,
    disposition: 'buff',
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'language-capability',
      understandSpoken: 'all',
      speechUnderstoodBy: 'any-creature-knowing-a-language',
    }],
    stacking: 'replace',
  }
  if (spell.id === 'telepathic-bond') return {
    schemaVersion: 1, id: 'telepathic-bond', name: spell.name,
    duration: ordinaryDuration,
    extensionCondition: 'telepathic-bond',
    // Each linked creature owns one marker per caster. `unique-by-source`
    // intentionally removes the caster's matching effect from every other
    // combatant (Light needs that global exclusivity), which would dismantle a
    // multi-creature telepathic network as its targets are applied. The normal
    // replace key already includes the source actor, so recasts refresh each
    // target without preventing another caster from linking the same creature.
    stacking: 'replace',
  }
  if (spell.id === 'water-breathing') return {
    schemaVersion: 1, id: 'water-breathing', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{ kind: 'environmental-capability', breatheIn: ['water'] }],
    stacking: 'replace',
  }
  if (spell.id === 'water-walk') return {
    schemaVersion: 1, id: 'water-walk', name: spell.name,
    duration: ordinaryDuration,
    modifiers: [{
      kind: 'environmental-capability',
      treatLiquidSurfacesAsSolidGround: true,
      riseTowardLiquidSurfaceFeetPerRound: 60,
    }],
    stacking: 'replace',
  }
  if (spell.id === 'wind-walk') return {
    schemaVersion: 1, id: 'wind-walk-controller', name: `${spell.name}·形态控制`,
    duration: ordinaryDuration,
    grants: ['spell:wind-walk:begin-cloud-form'],
    stacking: 'replace',
  }
  if (spell.id === 'weird') return {
    schemaVersion: 1, id: 'weird', name: spell.name,
    duration: {
      kind: 'save-ends', maximumRounds: rounds, timing: 'target-turn-end', ability: 'wis',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      damageOnFailure: { count: 4, sides: 10, type: 'psychic' },
    },
    conditions: ['frightened'], concentration: true, stacking: 'replace',
  }
  if (spell.id === 'meld-into-stone') return {
    schemaVersion: 1, id: 'meld-into-stone', name: spell.name,
    duration: { kind: 'rounds', rounds: 4_800, expiresAt: 'target-turn-end' },
    modifiers: [{
      kind: 'planar-phase', plane: 'terrain',
      ignoresMaterialCollision: false,
      suppressCrossPlaneEffects: true,
      unrestrictedVerticalMovement: false,
    }, {
      kind: 'ability-check', ability: 'wis', skill: 'perception', mode: 'disadvantage',
    }],
    grants: [
      'spell:meld-into-stone:exit',
      'spell:meld-into-stone:eject-minor',
      'spell:meld-into-stone:eject-major',
    ],
    stacking: 'replace',
  }
  return undefined
}

function auditedWindWalkFormEffects(spell: RegisteredDnd5ePluginSpell): readonly Dnd5eEffectDefinitionV1[] {
  const duration = {
    kind: 'rounds' as const,
    rounds: auditedDurationRounds(spell),
    expiresAt: 'target-turn-end' as const,
  }
  const transitionDuration = {
    kind: 'rounds' as const,
    rounds: 10,
    expiresAt: 'target-turn-end' as const,
  }
  return [{
    schemaVersion: 1,
    id: 'wind-walk-cloud-form',
    name: `${spell.name}·云雾形态`,
    duration,
    modifiers: [
      { kind: 'flight-speed', speedFeet: 300 },
      {
        kind: 'conditional-damage-resistance',
        damageTypes: ['bludgeoning', 'piercing', 'slashing'],
        sourceMagical: false,
        deliveries: ['weapon-attack'],
      },
      {
        kind: 'action-restriction',
        prohibited: ['attack', 'spellcasting', 'object-interaction'],
        allowedBasicActions: ['dash'],
        allowedActivityIds: ['spell:wind-walk:begin-normal-form'],
      },
    ],
    grants: ['spell:wind-walk:begin-normal-form'],
    sourceLink: { sourceRequiresEffect: 'wind-walk-controller' },
    suspendWhileEffectId: 'wind-walk-transition-to-cloud',
    afterEffectEnds: {
      duration: 'rounds', rounds: 10, trigger: 'non-manual-removal',
      requiresAirborne: true,
      preventActions: false, preventMovement: false,
      controlledDescent: {
        maximumFeetPerRound: 60,
        safeLanding: true,
        endsOnLanding: true,
      },
    },
    stacking: 'replace',
  }, {
    schemaVersion: 1,
    id: 'wind-walk-transition-to-normal',
    name: `${spell.name}·恢复正常形态中`,
    duration: transitionDuration,
    conditions: ['incapacitated'],
    modifiers: [{ kind: 'speed', mode: 'override', value: { kind: 'constant', value: 0 } }],
    stacking: 'replace',
  }, {
    schemaVersion: 1,
    id: 'wind-walk-transition-to-cloud',
    name: `${spell.name}·转化云雾形态中`,
    duration: transitionDuration,
    conditions: ['incapacitated'],
    modifiers: [{ kind: 'speed', mode: 'override', value: { kind: 'constant', value: 0 } }],
    stacking: 'replace',
  }]
}

function auditedChoiceEffects(spell: RegisteredDnd5ePluginSpell): readonly Dnd5eEffectDefinitionV1[] {
  if (spell.id === 'wind-walk') return auditedWindWalkFormEffects(spell)
  if (spell.id === 'instant-summons') return [{
    schemaVersion: 1, id: 'instant-summons-controller', name: `${spell.name}·物品连结`,
    duration: { kind: 'permanent' },
    grants: ['spell:instant-summons:recall'],
    stacking: 'replace',
  }]
  if (spell.id === 'secret-chest') return [{
    schemaVersion: 1, id: 'secret-chest-controller', name: `${spell.name}·秘箱连结`,
    duration: { kind: 'permanent' },
    grants: ['spell:secret-chest:recall', 'spell:secret-chest:send'],
    stacking: 'replace',
  }]
  if (spell.id === 'magic-jar') return [{
    schemaVersion: 1, id: 'magic-jar-controller', name: `${spell.name}·灵魂容器`,
    duration: { kind: 'permanent' },
    grants: ['spell:magic-jar:possess', 'spell:magic-jar:return', 'spell:magic-jar:return-body'],
    stacking: 'replace',
  }]
  if (spell.id === 'compulsion') return [{
    schemaVersion: 1, id: 'compulsion-controller', name: `${spell.name}·方向控制`,
    duration: { kind: 'concentration', maximumRounds: auditedDurationRounds(spell) },
    grants: ['spell:compulsion:set-direction'], concentration: true, stacking: 'replace',
  }, {
    schemaVersion: 1, id: 'compulsion-target', name: `${spell.name}·受强迫`,
    duration: {
      kind: 'rounds', rounds: auditedDurationRounds(spell), expiresAt: 'target-turn-end',
    },
    extensionCondition: 'directional-compulsion:compulsion',
    sourceLink: { sourceRequiresEffect: 'compulsion-controller' },
    repeatSaveAfterMovement: {
      ability: 'wis', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
    },
    stacking: 'unique-by-source',
  }]
  if (spell.id === 'find-familiar') return [{
    schemaVersion: 1, id: 'find-familiar-controller', name: `${spell.name}·魔宠连结`,
    duration: { kind: 'permanent' },
    grants: ['spell:find-familiar:share-senses'],
    stacking: 'replace',
  }]
  if (spell.id === 'levitate') return [{
    schemaVersion: 1, id: 'levitate-controller', name: `${spell.name}·高度控制`,
    duration: { kind: 'concentration', maximumRounds: auditedDurationRounds(spell) },
    grants: ['spell:levitate:move-other', 'spell:levitate:move-self'],
    concentration: true, stacking: 'replace',
  }, {
    schemaVersion: 1, id: 'levitate-safe-descent', name: `${spell.name}·缓慢飘落`,
    duration: { kind: 'permanent' },
    modifiers: [{
      kind: 'controlled-descent', maximumFeetPerRound: 60,
      safeLanding: true, endsOnLanding: true,
    }],
    stacking: 'replace',
  }]
  if (spell.id === 'mislead' || spell.id === 'project-image') {
    const duration: Dnd5eEffectDefinitionV1['duration'] = {
      kind: 'concentration', maximumRounds: auditedDurationRounds(spell),
    }
    return [{
      schemaVersion: 1, id: `${spell.id}-controller`, name: `${spell.name}·投影控制`,
      duration, concentration: true, stacking: 'replace',
    }, ...(spell.id === 'mislead' ? [{
      schemaVersion: 1 as const, id: 'mislead-invisible', name: `${spell.name}·隐形本体`,
      duration: { kind: 'rounds' as const, rounds: auditedDurationRounds(spell), expiresAt: 'source-turn-end' as const },
      conditions: ['invisible' as const], breakOn: ['makes-attack' as const, 'casts-spell' as const],
      sourceLink: { sourceRequiresEffect: 'mislead-controller' }, stacking: 'replace' as const,
    }] : []), {
      schemaVersion: 1, id: `${spell.id}-projection-senses`, name: `${spell.name}·使用投影视听`,
      // Switching to the projection is part of the same concentration spell.
      // Giving it the controller's concentration duration guarantees that
      // ending the spell restores the caster's normal sight and hearing.
      duration,
      conditions: ['blinded', 'deafened'],
      sourceLink: { sourceRequiresEffect: `${spell.id}-controller` }, stacking: 'replace',
    }]
  }
  if (spell.id === 'eyebite') {
    const sourceLink = { sourceRequiresEffect: 'eyebite-caster' as const }
    return [{
      schemaVersion: 1, id: 'eyebite-caster', name: `${spell.name}·持续凝视`,
      duration: { kind: 'concentration', maximumRounds: auditedDurationRounds(spell) },
      grants: ['spell:eyebite:use-gaze'],
      concentration: true, stacking: 'replace',
    }, {
      schemaVersion: 1, id: 'eyebite-immunity', name: `${spell.name}·本次施法已检定`,
      duration: { kind: 'rounds', rounds: auditedDurationRounds(spell), expiresAt: 'source-turn-end' },
      sourceLink, stacking: 'unique-by-source',
    }, {
      schemaVersion: 1, id: 'eyebite-asleep', name: `${spell.name}·沉睡`,
      duration: { kind: 'rounds', rounds: auditedDurationRounds(spell), expiresAt: 'target-turn-end' },
      conditions: ['unconscious'], breakOn: ['takes-damage', 'awakened'], sourceLink,
      stacking: 'replace',
    }, {
      schemaVersion: 1, id: 'eyebite-panicked', name: `${spell.name}·惊慌`,
      duration: {
        kind: 'save-ends', maximumRounds: auditedDurationRounds(spell),
        timing: 'target-turn-end', ability: 'wis',
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
        requiresSourceNotVisible: true,
      },
      conditions: ['frightened'], modifiers: [{ kind: 'forced-flee-from-source' }],
      sourceLink, stacking: 'replace',
    }, {
      schemaVersion: 1, id: 'eyebite-sickened', name: `${spell.name}·患病`,
      duration: {
        kind: 'save-ends', maximumRounds: auditedDurationRounds(spell),
        timing: 'target-turn-end', ability: 'wis',
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      },
      modifiers: [
        { kind: 'attack-roll', mode: 'disadvantage' },
        { kind: 'ability-check', mode: 'disadvantage' },
      ],
      sourceLink, stacking: 'replace',
    }]
  }
  if (spell.id === 'contagion') {
    const duration: Dnd5eEffectDefinitionV1['duration'] = {
      kind: 'save-ends', maximumRounds: auditedDurationRounds(spell), timing: 'target-turn-end', ability: 'con',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      successesRequired: 3, failuresRequired: 3,
      onFailureThreshold: { outcome: 'retain-effect' },
    }
    const modes: readonly {
      id: string
      label: string
      conditions?: Dnd5eEffectDefinitionV1['conditions']
      extensionCondition?: string
      onDamageCondition?: Dnd5eEffectDefinitionV1['onDamageCondition']
      modifiers: NonNullable<Dnd5eEffectDefinitionV1['modifiers']>
    }[] = [{
      id: 'blinding-sickness', label: '致盲病', conditions: ['blinded'],
      modifiers: [
        { kind: 'ability-check', ability: 'wis', mode: 'disadvantage' },
        { kind: 'saving-throw', ability: 'wis', mode: 'disadvantage' },
      ],
    }, {
      id: 'filth-fever', label: '污秽热', modifiers: [
        { kind: 'ability-check', ability: 'str', mode: 'disadvantage' },
        { kind: 'saving-throw', ability: 'str', mode: 'disadvantage' },
        { kind: 'attack-roll', ability: 'str', mode: 'disadvantage' },
      ],
    }, {
      id: 'flesh-rot', label: '腐肉症', modifiers: [
        { kind: 'ability-check', ability: 'cha', mode: 'disadvantage' },
        { kind: 'damage-vulnerability', damageType: 'all' },
      ],
    }, {
      id: 'mindfire', label: '心火症', extensionCondition: 'confused-behavior', modifiers: [
        { kind: 'ability-check', ability: 'int', mode: 'disadvantage' },
        { kind: 'saving-throw', ability: 'int', mode: 'disadvantage' },
      ],
    }, {
      id: 'seizure', label: '痉挛症', modifiers: [
        { kind: 'ability-check', ability: 'dex', mode: 'disadvantage' },
        { kind: 'saving-throw', ability: 'dex', mode: 'disadvantage' },
        { kind: 'attack-roll', ability: 'dex', mode: 'disadvantage' },
      ],
    }, {
      id: 'slimy-doom', label: '黏液厄运', onDamageCondition: {
        condition: 'stunned', duration: 'until-target-next-turn-end',
      }, modifiers: [
        { kind: 'ability-check', ability: 'con', mode: 'disadvantage' },
        { kind: 'saving-throw', ability: 'con', mode: 'disadvantage' },
      ],
    }]
    return modes.map((mode) => ({
      schemaVersion: 1, id: `contagion-${mode.id}`, name: `${spell.name}·${mode.label}`,
      tags: ['disease'], duration, conditions: mode.conditions, extensionCondition: mode.extensionCondition,
      onDamageCondition: mode.onDamageCondition,
      modifiers: mode.modifiers, stacking: 'replace', exclusiveGroup: 'contagion-disease',
    }))
  }
  if (spell.id !== 'fire-shield') return []
  const duration: Dnd5eEffectDefinitionV1['duration'] = {
    kind: 'rounds', rounds: auditedDurationRounds(spell), expiresAt: 'target-turn-end',
  }
  return [{
    schemaVersion: 1,
    id: 'fire-shield-warm',
    name: `${spell.name}·暖盾`,
    duration,
    modifiers: [
      { kind: 'damage-resistance', damageType: 'cold' },
      { kind: 'emitted-light', brightRadiusFeet: 10, dimRadiusFeet: 10, color: '#fb923c' },
    ],
    removalAction: {
      label: '解除火焰护盾',
      economy: 'action',
      maxDistanceFeet: 0,
    },
    stacking: 'replace',
    exclusiveGroup: 'fire-shield-mode',
  }, {
    schemaVersion: 1,
    id: 'fire-shield-chill',
    name: `${spell.name}·寒盾`,
    duration,
    modifiers: [
      { kind: 'damage-resistance', damageType: 'fire' },
      { kind: 'emitted-light', brightRadiusFeet: 10, dimRadiusFeet: 10, color: '#a5f3fc' },
    ],
    removalAction: {
      label: '解除火焰护盾',
      economy: 'action',
      maxDistanceFeet: 0,
    },
    stacking: 'replace',
    exclusiveGroup: 'fire-shield-mode',
  }]
}

function auditedTriggeredActivities(spell: RegisteredDnd5ePluginSpell): readonly Dnd5eActivityDefinitionV1[] {
  if (spell.id === 'geas') return [{
    schemaVersion: 1,
    id: 'spell:geas:violate-command',
    name: `${spell.name}·违令伤害`,
    description: '确认受术者在指使术仍有效时直接违背命令；Host 结算 5d10 心灵伤害，并锁定此伤害 24 小时。',
    activation: { kind: 'free', cost: 0 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    target: { kind: 'self' },
    requirements: [{
      kind: 'active-effect', subject: 'actor', effectId: 'geas-charmed',
      present: true, source: 'any',
    }, {
      kind: 'active-effect', subject: 'actor', effectId: 'geas-daily-damage-lock',
      present: false, source: 'any',
    }],
    effects: [{
      schemaVersion: 1,
      id: 'geas-daily-damage-lock',
      name: `${spell.name}·每日伤害已触发`,
      tags: ['geas', 'geas-daily-damage-lock'],
      duration: { kind: 'rounds', rounds: 14_400, expiresAt: 'target-turn-end' },
      stacking: 'replace',
    }],
    outcomes: [{
      id: 'violate-command', when: { kind: 'always' }, operations: [{
        id: 'geas-violation-adjudication', kind: 'manual-adjudication',
        prompt: '确认该生物刚刚采取了直接违背当前指使术命令的行为，且这不是误解、被迫行为或尚未发生的意图。Host 已确认其过去 24 小时没有承受过本法术的违令伤害；批准后结算 5d10 心灵伤害。',
        reason: '开放式命令与具体行为之间是否构成“直接违背”取决于现场语义。',
        requiresDmApproval: true,
      }, {
        id: 'geas-violation-damage', kind: 'damage', target: 'actor',
        amount: { kind: 'dice', rollId: 'geas-violation-damage', count: 5, sides: 10 },
        damageType: 'psychic', critical: 'normal', magical: true,
      }, {
        id: 'apply-geas-daily-damage-lock', kind: 'apply-effect', target: 'actor',
        effectId: 'geas-daily-damage-lock',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 自动结算 5d10 心灵伤害、伤害抗性/免疫与 24 小时一次限制；具体行为是否直接违令由 DM 批准。',
    ]),
    legacySource: { kind: 'spell', id: 'geas' },
  }, {
    schemaVersion: 1,
    id: 'spell:geas:dismiss',
    name: `${spell.name}·解除指使`,
    description: '施法者使用一个动作，结束自己施加在所选生物身上的指使术。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{
      kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm',
    }],
    target: {
      kind: 'creature', relation: 'any', count: 1, includeSelf: true,
      requiresLineOfSight: false, requiresLineOfEffect: false,
    },
    requirements: [{
      kind: 'active-effect', subject: 'target', effectId: 'geas-charmed',
      present: true, source: 'self',
    }],
    outcomes: [{
      id: 'dismiss', when: { kind: 'always' }, operations: [{
        id: 'dismiss-geas', kind: 'remove-effect', target: 'target',
        effectId: 'geas-charmed', source: 'self',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'geas' },
  }]
  if (spell.id === 'disguise-self') return [{
    schemaVersion: 1,
    id: 'spell:disguise-self:dismiss',
    name: `${spell.name}·解除伪装`,
    description: '使用一个动作提前解除自己身上的易容术外观。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    target: { kind: 'self' },
    requirements: [{
      kind: 'active-effect', subject: 'actor', effectId: 'disguise-self-appearance',
      present: true, source: 'self',
    }],
    outcomes: [{ id: 'dismiss', when: { kind: 'always' }, operations: [{
      id: 'dismiss-disguise-self', kind: 'remove-effect', target: 'actor',
      effectId: 'disguise-self-appearance', source: 'self',
    }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'disguise-self' },
  }, {
    schemaVersion: 1,
    id: 'spell:disguise-self:inspect',
    name: `${spell.name}·调查识破`,
    description: '使用一个动作仔细调查一名可见的易容术目标，以智力（调查）检定对抗该法术的施法豁免 DC。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    target: {
      kind: 'creature', relation: 'any', count: 1, includeSelf: false,
      requiresLineOfSight: true, requiresLineOfEffect: false,
    },
    requirements: [{
      kind: 'active-effect', subject: 'target', effectId: 'disguise-self-appearance',
      present: true, source: 'any',
    }],
    checks: [{
      id: 'disguise-self-investigation', kind: 'skill-check',
      rollId: 'disguise-self-investigation-d20', ability: 'int', skill: 'investigation',
      dc: {
        kind: 'reference',
        reference: {
          kind: 'target-active-effect-source-spell-save-dc',
          effectId: 'disguise-self-appearance',
        },
      },
      rollMode: 'host-derived', scope: 'per-target',
    }],
    outcomes: [{
      id: 'discerned',
      when: { kind: 'check', checkId: 'disguise-self-investigation', result: 'success' },
      operations: [{
        id: 'record-disguise-self-discerned', kind: 'mechanic', target: 'actor',
        handlerId: 'core.resolve-only', parameters: {},
      }],
    }, {
      id: 'not-discerned',
      when: { kind: 'check', checkId: 'disguise-self-investigation', result: 'failure' },
      operations: [{
        id: 'record-disguise-self-not-discerned', kind: 'mechanic', target: 'actor',
        handlerId: 'core.resolve-only', parameters: {},
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'disguise-self' },
  }]
  if (spell.id === 'contingency') return contingencyStoredSpellsV1().flatMap(({ spell: storedSpell, activity }) =>
    (['takes-damage', 'manual'] as const).map((triggerMode) => {
      const controllerEffectId = contingencyControllerEffectId(storedSpell.id, triggerMode)
      return {
        ...structuredClone(activity),
        id: contingencyTriggerActivityId(storedSpell.id, triggerMode),
        name: `${spell.name}·触发${storedSpell.name}`,
        description: triggerMode === 'takes-damage'
          ? `第一次实际受到伤害后，立即让预先储存的${storedSpell.name}只影响施法者。`
          : `声明的自定义条件首次满足时，立即让预先储存的${storedSpell.name}只影响施法者。`,
        activation: { kind: 'free' as const, cost: 0 },
        invocation: triggerMode === 'takes-damage'
          ? { kind: 'triggered' as const, event: 'after-damage' as const, confirmation: 'automatic' as const }
          : { kind: 'active' as const, confirmation: 'actor-choice' as const },
        target: { kind: 'self' as const },
        consumption: [],
        requirements: [{
          kind: 'active-effect' as const,
          subject: 'actor' as const,
          effectId: controllerEffectId,
          present: true,
          // `any` prevents the outer Contingency slot level from being
          // inherited as the stored spell's cast level. These closed replay
          // candidates have no slot scaling; their base-level result is exact.
          source: 'any' as const,
        }],
        outcomes: [...activity.outcomes, {
          id: 'consume-contingency',
          when: { kind: 'always' as const },
          operations: [{
            id: 'remove-contingency-controller',
            kind: 'remove-effect' as const,
            target: 'actor' as const,
            effectId: controllerEffectId,
            source: 'any' as const,
          }],
        }],
        automation: automationCapabilityFromLegacyStatus('full'),
        // Entitlement proves that the caster really knows/can cast the stored
        // spell; the controller requirement proves that its slot was prepaid.
        legacySource: { kind: 'spell' as const, id: storedSpell.id },
      }
    }))
  if (spell.id === 'blink') return [{
    schemaVersion: 1,
    id: 'spell:blink:return',
    name: `${spell.name}·返回原位面`,
    description: '在回合开始时返回原位面，并选择离开位置 10 尺内一处可见且未被占据的空间。',
    activation: { kind: 'free', cost: 0 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 10, lengthFeet: 5, widthFeet: 5, heightFeet: 5,
      rotatable: false, maximumTargets: 1, includeSelf: true,
      requiresLineOfSight: true, requiresLineOfEffect: false,
    },
    requirements: [{
      kind: 'active-effect', subject: 'actor', effectId: 'blink-return-pending',
      present: true, source: 'self',
    }],
    outcomes: [{
      id: 'return', when: { kind: 'always' }, operations: [{
        id: 'blink-return-teleport', kind: 'move', target: 'actor', mode: 'teleport',
        distanceFeet: { kind: 'constant', value: 10 },
        ignoresOpportunityAttacks: true,
      }, {
        id: 'complete-blink-return', kind: 'remove-effect', target: 'actor',
        effectId: 'blink-return-pending', source: 'self',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'blink' },
  }]
  if (spell.id === 'wind-walk') {
    const effects = auditedWindWalkFormEffects(spell)
    const effect = (id: string) => effects.find((candidate) => candidate.id === id)!
    const inactiveTransitions = [
      'wind-walk-transition-to-normal',
      'wind-walk-transition-to-cloud',
    ].map((effectId) => ({
      kind: 'active-effect' as const,
      subject: 'actor' as const,
      effectId,
      present: false,
      source: 'any' as const,
    }))
    return [{
      schemaVersion: 1,
      id: 'spell:wind-walk:begin-normal-form',
      name: `${spell.name}·开始恢复正常形态`,
      description: '使用动作开始为期 1 分钟的恢复过程；期间陷入失能且不能移动，完成后恢复正常形态。',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
      target: { kind: 'self' },
      requirements: [{
        kind: 'active-effect', subject: 'actor', effectId: 'wind-walk-cloud-form',
        present: true, source: 'any',
      }, ...inactiveTransitions],
      effects: [effect('wind-walk-transition-to-normal')],
      outcomes: [{
        id: 'begin-normal-form', when: { kind: 'always' }, operations: [{
          id: 'apply-wind-walk-transition-to-normal', kind: 'apply-effect', target: 'actor',
          effectId: 'wind-walk-transition-to-normal',
        }, {
          id: 'remove-wind-walk-cloud-form', kind: 'remove-effect', target: 'actor',
          effectId: 'wind-walk-cloud-form', source: 'any',
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell', id: 'wind-walk' },
    }, {
      schemaVersion: 1,
      id: 'spell:wind-walk:begin-cloud-form',
      name: `${spell.name}·开始转化云雾形态`,
      description: '使用动作开始为期 1 分钟的转化；期间陷入失能且不能移动，完成后重新获得云雾形态。',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
      target: { kind: 'self' },
      requirements: [{
        kind: 'active-effect', subject: 'actor', effectId: 'wind-walk-controller',
        present: true, source: 'any',
      }, {
        kind: 'active-effect', subject: 'actor', effectId: 'wind-walk-cloud-form',
        present: false, source: 'any',
      }, ...inactiveTransitions],
      effects: [
        effect('wind-walk-transition-to-cloud'),
        effect('wind-walk-cloud-form'),
      ],
      outcomes: [{
        id: 'begin-cloud-form', when: { kind: 'always' }, operations: [{
          id: 'apply-wind-walk-transition-to-cloud', kind: 'apply-effect', target: 'actor',
          effectId: 'wind-walk-transition-to-cloud',
        }, {
          id: 'apply-suspended-wind-walk-cloud-form', kind: 'apply-effect', target: 'actor',
          effectId: 'wind-walk-cloud-form',
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell', id: 'wind-walk' },
    }]
  }
  if (spell.id === 'tree-stride') return [{
    schemaVersion: 1,
    id: 'spell:tree-stride:teleport',
    name: `${spell.name}·树跃`,
    description: '专注期间，在自己的回合花费 10 尺移动力，经由同类活树传送到 500 尺内另一株合格树木旁；每回合一次。',
    activation: { kind: 'movement', cost: 0 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{
      kind: 'movement', amount: { kind: 'constant', value: 10 }, consumeOn: 'resolve',
    }],
    target: { kind: 'self' },
    requirements: [
      {
        kind: 'active-effect', subject: 'actor', effectId: 'tree-stride-teleport',
        present: true, source: 'self',
      },
      { kind: 'once-per-turn', key: 'tree-stride-teleport' },
    ],
    outcomes: [{
      id: 'tree-stride', when: { kind: 'always' }, operations: [{
        id: 'tree-stride-tree-eligibility', kind: 'manual-adjudication',
        prompt: '确认施法者从一株活着、与其体型相同或更大的树进入，并选择 500 尺内另一株同类且同样合格的活树作为出口；施法者必须在树外结束回合。',
        reason: '地图物件尚无可由 Host 校验的树种与生命状态字段。',
        requiresDmApproval: true,
      }, {
        id: 'tree-stride-teleport', kind: 'move', target: 'actor', mode: 'teleport',
        distanceFeet: { kind: 'constant', value: 500 }, ignoresOpportunityAttacks: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('partial', [
      'Host 自动消耗 10 尺移动力、限制每回合一次并提交 500 尺内传送落点；树木存活、体型与同类资格由共享 DM 边界裁定。',
    ]),
    legacySource: { kind: 'spell', id: 'tree-stride' },
  }]
  if (spell.id === 'detect-magic') return [{
    schemaVersion: 1,
    id: 'spell:detect-magic:reveal-auras',
    name: `${spell.name}·显化灵光`,
    description: '使用动作，看见 30 尺内可见且承载魔法的生物或物件周围的微弱灵光，并得知可辨识的魔法学派。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    target: { kind: 'self' },
    requirements: [{
      kind: 'active-effect', subject: 'actor',
      effectId: 'persistent-detection:detect-magic-persistent-detection',
      present: true, source: 'self',
    }],
    outcomes: [{
      id: 'reveal-auras', when: { kind: 'always' }, operations: [{
        id: 'reveal-detect-magic-auras', kind: 'mechanic', target: 'actor',
        handlerId: 'core.reveal-persistent-detection', parameters: {},
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'detect-magic' },
  }]
  if (spell.id === 'detect-thoughts') {
    const focus = detectThoughtsFocusEffect(spell)
    const controllerRequirement = {
      kind: 'active-effect' as const,
      subject: 'actor' as const,
      effectId: 'detect-thoughts-controller',
      present: true,
      source: 'self' as const,
    }
    const thinkingTargetRequirements = [{
      kind: 'ability-score' as const,
      subject: 'target' as const,
      ability: 'int' as const,
      comparison: 'above' as const,
      value: 3,
    }]
    const actionConsumption = [{
      kind: 'action-economy' as const,
      economy: 'action' as const,
      amount: 1 as const,
      consumeOn: 'confirm' as const,
    }]
    const visibleThoughtTarget = {
      kind: 'creature' as const, relation: 'any' as const, rangeFeet: 30, count: 1,
      includeSelf: false, requiresLineOfSight: true, requiresLineOfEffect: true,
    }
    const clearFocus = {
      id: 'clear-previous-detect-thoughts-focus', kind: 'remove-effects-by-tag' as const,
      target: 'all-combatants' as const, tags: ['detect-thoughts-focus'],
      match: 'any' as const, source: 'self' as const,
    }
    const probed: Dnd5eEffectDefinitionV1 = {
      schemaVersion: 1,
      id: 'detect-thoughts-probed',
      name: `${spell.name}·察觉深入探查`,
      duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-end' },
      tags: ['detect-thoughts-probed'],
      grants: ['spell:detect-thoughts:contest'],
      sourceLink: { sourceRequiresEffect: 'detect-thoughts-controller' },
      stacking: 'unique-by-source',
    }
    const aware: Dnd5eEffectDefinitionV1 = {
      schemaVersion: 1,
      id: 'detect-thoughts-aware',
      name: `${spell.name}·已察觉探查`,
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' },
      tags: ['detect-thoughts-aware'],
      stacking: 'unique-by-source',
    }
    return [{
      schemaVersion: 1,
      id: 'spell:detect-thoughts:surface',
      name: `${spell.name}·转移表层读取`,
      description: '使用动作，将注意力转向 30 尺内另一名可见且有语言的生物，并读取其表层思想；这不会触发豁免，也不会令目标察觉。',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: actionConsumption,
      target: visibleThoughtTarget,
      requirements: [controllerRequirement, ...thinkingTargetRequirements],
      effects: [focus],
      outcomes: [{ id: 'surface', when: { kind: 'always' }, operations: [clearFocus, {
        id: 'focus-new-detect-thoughts-target', kind: 'apply-effect',
        target: 'target', effectId: focus.id,
      }, {
        id: 'adjudicate-new-surface-thoughts', kind: 'manual-adjudication',
        prompt: '确认目标会说至少一种语言，并向施法者描述目标此刻最占据意识的表层思想；目标不会察觉。',
        reason: '自然语言思想内容需要共享 DM 回应。',
        requiresDmApproval: true,
      }] }],
      automation: automationCapabilityFromLegacyStatus('partial', [
        'Host 自动消费动作、校验 30 尺/视线/智力并更换当前思想目标；语言资格与表层思想内容由 DM 回应。',
      ]),
      legacySource: { kind: 'spell', id: 'detect-thoughts' },
    }, {
      schemaVersion: 1,
      id: 'spell:detect-thoughts:probe',
      name: `${spell.name}·深入探查`,
      description: '使用动作深入探查当前思想目标。Host 结算感知豁免；无论结果如何目标都会察觉。成功则法术结束，失败则 DM 回答推理、情绪与重要心事。',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: actionConsumption,
      target: visibleThoughtTarget,
      requirements: [controllerRequirement, ...thinkingTargetRequirements, {
        kind: 'active-effect', subject: 'target', effectId: focus.id,
        present: true, source: 'self',
      }],
      checks: [{
        id: 'detect-thoughts-probe-save', kind: 'saving-throw',
        rollId: 'detect-thoughts-probe-save-d20', ability: 'wis',
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
        rollMode: 'host-derived', scope: 'per-target',
      }],
      effects: [probed, aware],
      outcomes: [{
        id: 'target-aware', when: { kind: 'always' }, operations: [{
          id: 'mark-detect-thoughts-target-aware', kind: 'apply-effect',
          target: 'target', effectId: aware.id,
        }],
      }, {
        id: 'probe-resisted',
        when: { kind: 'check', checkId: 'detect-thoughts-probe-save', result: 'success' },
        operations: [{
          id: 'end-detect-thoughts-after-resisted-probe', kind: 'remove-effect',
          target: 'actor', effectId: 'detect-thoughts-controller', source: 'self',
        }, clearFocus],
      }, {
        id: 'probe-succeeded',
        when: { kind: 'check', checkId: 'detect-thoughts-probe-save', result: 'failure' },
        operations: [{
          id: 'grant-detect-thoughts-contest', kind: 'apply-effect',
          target: 'target', effectId: probed.id,
        }, {
          id: 'adjudicate-deep-thoughts', kind: 'manual-adjudication',
          prompt: '感知豁免失败。向施法者描述目标的思考过程、情绪状态，以及其心中一件重要的事物。目标已察觉这次深入探查。',
          reason: '自然语言心智内容需要共享 DM 回应；Host 已结算豁免与目标察觉。',
          requiresDmApproval: true,
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('partial', [
        'Host 自动消费动作、校验当前目标、结算感知豁免、公开目标察觉并在成功豁免时结束专注；失败后的具体心智内容由 DM 回应。',
      ]),
      legacySource: { kind: 'spell', id: 'detect-thoughts' },
    }, {
      schemaVersion: 1,
      id: 'spell:detect-thoughts:search',
      name: `${spell.name}·搜索思想`,
      description: '使用动作搜索 30 尺内看不见但有思想且会语言的生物；岩石、金属与铅的阻挡厚度由 DM 按场景确认。',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: actionConsumption,
      target: { kind: 'self' },
      requirements: [controllerRequirement],
      outcomes: [{ id: 'search', when: { kind: 'always' }, operations: [{
        id: 'adjudicate-unseen-thought-search', kind: 'manual-adjudication',
        prompt: '确认施法者 30 尺内是否存在智力高于 3 且会至少一种语言的未见生物；2 尺岩石、2 寸非铅金属或薄铅片会阻挡。若侦测到，请告知其位置。',
        reason: '未见生物与障碍物材质厚度属于 DM 场景信息。',
        requiresDmApproval: true,
      }] }],
      automation: automationCapabilityFromLegacyStatus('partial', [
        'Host 自动消费动作并校验持续中的专注；未见生物与障碍材质厚度由 DM 回应。',
      ]),
      legacySource: { kind: 'spell', id: 'detect-thoughts' },
    }, {
      schemaVersion: 1,
      id: 'spell:detect-thoughts:contest',
      name: `${spell.name}·反制探查`,
      description: '被深入探查且已察觉的目标使用动作，与施法者进行智力检定对抗；目标胜出时法术结束。平局由施法者守住专注。',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: actionConsumption,
      target: {
        kind: 'creature', relation: 'any', rangeFeet: 30, count: 1,
        includeSelf: false, requiresLineOfSight: false, requiresLineOfEffect: false,
      },
      requirements: [{
        kind: 'active-effect', subject: 'actor', effectId: probed.id,
        present: true, source: 'any',
      }, {
        kind: 'active-effect', subject: 'target', effectId: 'detect-thoughts-controller',
        present: true, source: 'any',
      }],
      checks: [{
        id: 'detect-thoughts-intelligence-contest', kind: 'opposed-ability-check',
        rollId: 'detect-thoughts-target-int-d20',
        opposedRollId: 'detect-thoughts-caster-int-d20',
        sourceAbility: 'int',
        sourceModifier: { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: 'int' } },
        sourceRollMode: 'host-derived',
        targetOptions: [{ ability: 'int' }],
        targetRollMode: 'host-derived', scope: 'per-target',
      }],
      outcomes: [{
        id: 'contest-won',
        when: { kind: 'check', checkId: 'detect-thoughts-intelligence-contest', result: 'success' },
        operations: [{
          id: 'end-detect-thoughts-after-contest', kind: 'remove-effect',
          target: 'target', effectId: 'detect-thoughts-controller', source: 'any',
        }, {
          id: 'clear-detect-thoughts-focus-after-contest', kind: 'remove-effect',
          target: 'actor', effectId: focus.id, source: 'any',
        }, {
          id: 'clear-detect-thoughts-probed-after-contest', kind: 'remove-effect',
          target: 'actor', effectId: probed.id, source: 'any',
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell', id: 'detect-thoughts' },
    }]
  }
  if (spell.id === 'delayed-blast-fireball') return [{
    schemaVersion: 1,
    id: 'spell:delayed-blast-fireball:detonate',
    name: `${spell.name}·引爆`,
    description: '结束延迟并引爆授予本 Activity 的火球区域。Host 使用区域当前累计的伤害骰，对区域内全部目标结算敏捷豁免和火焰伤害，然后移除区域。',
    activation: { kind: 'free', cost: 0 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    target: { kind: 'self' },
    outcomes: [{
      id: 'detonate', when: { kind: 'always' }, operations: [{
        id: 'detonate-delayed-blast-fireball', kind: 'detonate-granting-area', target: 'actor',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'delayed-blast-fireball' },
  }]
  if (spell.id === 'instant-summons') return [{
    schemaVersion: 1, id: 'spell:instant-summons:recall', name: `${spell.name}·捏碎蓝宝石`,
    description: '使用动作触发 Host 保存的物品连结。物品可召回时转移到施法者处；无法召回时只返回持有者与大致位置的权威结果。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    target: { kind: 'self' },
    requirements: [{
      kind: 'active-effect', subject: 'actor', effectId: 'instant-summons-controller',
      present: true, source: 'self',
    }],
    outcomes: [{ id: 'recall', when: { kind: 'always' }, operations: [{
      id: 'recall-instant-summons-object', kind: 'transition-spell-authority', target: 'actor',
      recordKind: 'linked-planar-object', linkedObjectProfile: 'instant-summons',
      transition: 'recall-to-source',
    }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'instant-summons' },
  }]
  if (spell.id === 'secret-chest') {
    const common = {
      schemaVersion: 1 as const,
      activation: { kind: 'action' as const, cost: 1 },
      invocation: { kind: 'active' as const, confirmation: 'actor-choice' as const },
      consumption: [{ kind: 'action-economy' as const, economy: 'action' as const, amount: 1 as const, consumeOn: 'confirm' as const }],
      target: { kind: 'self' as const },
      requirements: [{ kind: 'active-effect' as const, subject: 'actor' as const, effectId: 'secret-chest-controller', present: true, source: 'self' as const }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell' as const, id: 'secret-chest' },
    }
    return [{
      ...common, id: 'spell:secret-chest:recall', name: `${spell.name}·召回秘箱`,
      description: '触碰微型复制品，把 Host 连结的秘箱从以太位面召回施法者附近。',
      outcomes: [{ id: 'recall', when: { kind: 'always' }, operations: [{
        id: 'recall-secret-chest', kind: 'transition-spell-authority', target: 'actor',
        recordKind: 'linked-planar-object', linkedObjectProfile: 'secret-chest', transition: 'recall-to-source',
      }] }],
    }, {
      ...common, id: 'spell:secret-chest:send', name: `${spell.name}·送回以太`,
      description: '同时触碰秘箱与复制品，把 Host 连结的秘箱送回以太位面。',
      outcomes: [{ id: 'send', when: { kind: 'always' }, operations: [{
        id: 'send-secret-chest', kind: 'transition-spell-authority', target: 'actor',
        recordKind: 'linked-planar-object', linkedObjectProfile: 'secret-chest', transition: 'send-to-ethereal',
      }] }],
    }]
  }
  if (spell.id === 'magic-jar') {
    const immunity: Dnd5eEffectDefinitionV1 = {
      schemaVersion: 1, id: 'magic-jar-possession-immunity', name: `${spell.name}·抵抗占据`,
      duration: { kind: 'rounds', rounds: 14_400, expiresAt: 'target-turn-end' },
      stacking: 'unique-by-source',
    }
    return [{
      schemaVersion: 1, id: 'spell:magic-jar:possess', name: `${spell.name}·尝试占据`,
      description: '选择 100 尺内可见类人生物。Host 结算魅力豁免；失败时建立控制委托，成功时记录 24 小时免疫。',
      activation: { kind: 'action', cost: 1 }, invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
      target: { kind: 'creature', relation: 'any', rangeFeet: 100, count: 1, includeSelf: false, requiresLineOfSight: true, requiresLineOfEffect: true },
      requirements: [
        { kind: 'active-effect', subject: 'actor', effectId: 'magic-jar-controller', present: true, source: 'self' },
        { kind: 'active-effect', subject: 'target', effectId: 'magic-jar-possession-immunity', present: false, source: 'self' },
        { kind: 'creature-type', subject: 'target', types: ['humanoid', '类人生物'] },
      ],
      checks: [{
        id: 'possession-save', kind: 'saving-throw', rollId: 'magic-jar-possession-save', ability: 'cha',
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } }, rollMode: 'host-derived', scope: 'per-target',
      }],
      effects: [immunity],
      outcomes: [{ id: 'possessed', when: { kind: 'check', checkId: 'possession-save', result: 'failure' }, operations: [{
        id: 'possess-magic-jar-target', kind: 'transition-spell-authority', target: 'target',
        recordKind: 'soul-vessel', transition: 'possess-target',
      }] }, {
        id: 'resisted', when: { kind: 'check', checkId: 'possession-save', result: 'success' }, operations: [{
          id: 'apply-magic-jar-immunity', kind: 'apply-effect', target: 'target', effectId: 'magic-jar-possession-immunity',
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'spell', id: 'magic-jar' },
    }, {
      schemaVersion: 1, id: 'spell:magic-jar:return', name: `${spell.name}·返回容器`,
      description: '使用动作结束当前控制委托，使宿主灵魂返回身体，施法者灵魂返回 Host 记录的容器。',
      activation: { kind: 'action', cost: 1 }, invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
      target: { kind: 'self' },
      requirements: [{ kind: 'active-effect', subject: 'actor', effectId: 'magic-jar-controller', present: true, source: 'self' }],
      outcomes: [{ id: 'return', when: { kind: 'always' }, operations: [{
        id: 'return-to-magic-jar', kind: 'transition-spell-authority', target: 'actor',
        recordKind: 'soul-vessel', transition: 'return-to-vessel',
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'spell', id: 'magic-jar' },
    }, {
      schemaVersion: 1, id: 'spell:magic-jar:return-body', name: `${spell.name}·回到本体并结束`,
      description: '使用动作释放当前宿主（如有），使施法者灵魂回到自己的身体，并结束魔魂壶。',
      activation: { kind: 'action', cost: 1 }, invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
      target: { kind: 'self' },
      requirements: [{ kind: 'active-effect', subject: 'actor', effectId: 'magic-jar-controller', present: true, source: 'self' }],
      outcomes: [{ id: 'return-body', when: { kind: 'always' }, operations: [{
        id: 'return-to-magic-jar-body', kind: 'transition-spell-authority', target: 'actor',
        recordKind: 'soul-vessel', transition: 'return-to-body',
      }, {
        id: 'end-magic-jar-controller', kind: 'remove-effect', target: 'actor',
        effectId: 'magic-jar-controller', source: 'self',
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'spell', id: 'magic-jar' },
    }]
  }
  if (spell.id === 'meld-into-stone') {
    const exitOperations: Dnd5eActivityDefinitionV1['outcomes'][number]['operations'] = [{
      id: 'exit-merged-terrain', kind: 'transition-spell-authority', target: 'actor',
      recordKind: 'terrain-merge', transition: 'exit-merged-terrain',
    }, {
      id: 'remove-meld-into-stone', kind: 'remove-effect', target: 'actor',
      effectId: 'meld-into-stone', source: 'self',
    }]
    const common = {
      schemaVersion: 1 as const, target: { kind: 'self' as const },
      invocation: { kind: 'active' as const, confirmation: 'actor-choice' as const },
      requirements: [{ kind: 'active-effect' as const, subject: 'actor' as const, effectId: 'meld-into-stone', present: true, source: 'self' as const }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell' as const, id: 'meld-into-stone' },
    }
    return [{
      ...common, id: 'spell:meld-into-stone:exit', name: `${spell.name}·离开石体`,
      description: '花费移动从原进入点离开，移除地形位面状态并结束法术。',
      activation: { kind: 'movement', cost: 0 },
      outcomes: [{ id: 'exit', when: { kind: 'always' }, operations: exitOperations }],
    }, {
      ...common, id: 'spell:meld-into-stone:eject-minor', name: `${spell.name}·石体受损排出`,
      description: '石体部分损毁或变形时由 Host 结算 6d6 钝击伤害、倒地并排出。',
      activation: { kind: 'free', cost: 0 },
      outcomes: [{ id: 'eject', when: { kind: 'always' }, operations: [{
        id: 'meld-minor-damage', kind: 'damage', target: 'actor',
        amount: { kind: 'dice', rollId: 'meld-minor-damage', count: 6, sides: 6 },
        damageType: 'bludgeoning', critical: 'normal', magical: false,
      }, {
        id: 'meld-minor-prone', kind: 'apply-standard-condition', target: 'actor', condition: 'prone',
        duration: { kind: 'permanent' },
      }, ...exitOperations] }],
    }, {
      ...common, id: 'spell:meld-into-stone:eject-major', name: `${spell.name}·石体摧毁排出`,
      description: '石体完全摧毁或变质时由 Host 结算固定 50 点钝击伤害、倒地并排出。',
      activation: { kind: 'free', cost: 0 },
      outcomes: [{ id: 'eject', when: { kind: 'always' }, operations: [{
        id: 'meld-major-damage', kind: 'damage', target: 'actor',
        amount: { kind: 'constant', value: 50 }, damageType: 'bludgeoning', critical: 'normal', magical: false,
      }, {
        id: 'meld-major-prone', kind: 'apply-standard-condition', target: 'actor', condition: 'prone',
        duration: { kind: 'permanent' },
      }, ...exitOperations] }],
    }]
  }
  if (spell.id === 'compulsion') return [{
    schemaVersion: 1,
    id: 'spell:compulsion:set-direction',
    name: `${spell.name}·指定方向`,
    description: '以附赠动作在地图上指定受影响目标下一回合必须尽可能移动的水平方向。',
    activation: { kind: 'bonus-action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'confirm' }],
    target: {
      kind: 'area', relation: 'any', origin: 'self', shape: 'line',
      placeRangeFeet: 30, lengthFeet: 30, widthFeet: 5, maximumTargets: 256,
      includeSelf: true, rotatable: true,
      requiresLineOfSight: false, requiresLineOfEffect: false,
    },
    requirements: [{
      kind: 'active-effect', subject: 'actor', effectId: 'compulsion-controller',
      present: true, source: 'self',
    }],
    outcomes: [{
      id: 'set-direction', when: { kind: 'always' }, operations: [{
        id: 'set-compulsion-direction', kind: 'set-directional-command',
        target: 'actor', commandKey: 'compulsion',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'compulsion' },
  }]
  if (spell.id === 'remove-curse') {
    const base = dnd5eActivityFromSpellDefinition(
      spell as Dnd5ePluginSpellDefinition,
      'headless-action',
    )
    return [{
      ...base,
      id: 'spell:remove-curse:cursed-item',
      name: `${spell.name}·解除诅咒物品同调`,
      description: '触碰一件由目标持有的诅咒魔法物品，解除目标与它的同调；物品自身的诅咒不会被删除。',
      target: {
        kind: 'creature', relation: 'ally', rangeFeet: 5, count: 1,
        includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
      outcomes: [{
        id: 'break-cursed-attunement', when: { kind: 'always' }, operations: [{
          id: 'break-cursed-item-attunement', kind: 'break-inventory-item-attunement',
          target: 'all-targets', requireCursedMagicItem: true,
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell', id: 'remove-curse' },
    }]
  }
  if (spell.id === 'find-familiar') return [{
    schemaVersion: 1,
    id: 'spell:find-familiar:share-senses',
    name: `${spell.name}·共享感官`,
    description: '使用动作通过 100 尺内魔宠的眼睛和耳朵感知，直到你的下一回合开始；期间你对自己的感官盲目且耳聋。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    target: {
      kind: 'creature', relation: 'ally', rangeFeet: 100, count: 1,
      includeSelf: false, requiresLineOfSight: false, requiresLineOfEffect: false,
    },
    requirements: [
      { kind: 'active-effect', subject: 'actor', effectId: 'find-familiar-controller', present: true, source: 'self' },
      { kind: 'owned-companion', subject: 'target' },
    ],
    outcomes: [{
      id: 'share-senses', when: { kind: 'always' }, operations: [{
        id: 'share-familiar-senses', kind: 'mechanic', target: 'actor',
        handlerId: 'core.shared-senses', parameters: {},
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'find-familiar' },
  }]
  if (spell.id === 'mislead' || spell.id === 'project-image') {
    const sourceId = spell.id
    const maximumFeet = {
      kind: 'multiply' as const,
      values: [
        { kind: 'constant' as const, value: 2 },
        { kind: 'reference' as const, reference: { kind: 'actor-speed' as const } },
      ],
    }
    const common = {
      schemaVersion: 1 as const,
      invocation: { kind: 'active' as const, confirmation: 'actor-choice' as const },
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell' as const, id: sourceId },
    }
    return [{
      ...common,
      id: `spell:${sourceId}:move-projection`, name: `${spell.name}·移动投影`,
      description: '使用动作把投影移动到最多等于施法者速度两倍的合法地图位置。',
      activation: { kind: 'action', cost: 1 },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
        placeRangeFeet: 100_000, radiusFeet: 5, maximumTargets: 1,
        requiresLineOfSight: false, requiresLineOfEffect: false,
      },
      outcomes: [{
        id: 'move-projection', when: { kind: 'always' }, operations: [{
          id: `${sourceId}-move-projection`, kind: 'reshape-granting-area', target: 'actor', maximumFeet,
        }],
      }],
    }, {
      ...common,
      id: `spell:${sourceId}:switch-senses`, name: `${spell.name}·切换视听`,
      description: '以附赠动作在本体与投影的视听之间切换；使用投影视听时本体视为目盲且耳聋。',
      activation: { kind: 'bonus-action', cost: 1 },
      consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'confirm' }],
      target: { kind: 'self' },
      choices: [{
        id: 'sense-origin', label: '视听来源', defaultOptionId: 'projection', options: [
          { id: 'projection', label: '投影' }, { id: 'source', label: '本体' },
        ],
      }],
      effects: auditedChoiceEffects(spell).filter((effect) => effect.id === `${sourceId}-projection-senses`),
      outcomes: [{
        id: 'use-projection', when: { kind: 'choice', choiceId: 'sense-origin', optionId: 'projection' },
        operations: [{
          id: `${sourceId}-projection-vision`, kind: 'set-granting-area-senses', target: 'actor', mode: 'projection',
        }, {
          id: `${sourceId}-projection-blind-deaf`, kind: 'apply-effect', target: 'actor',
          effectId: `${sourceId}-projection-senses`,
        }],
      }, {
        id: 'use-source', when: { kind: 'choice', choiceId: 'sense-origin', optionId: 'source' },
        operations: [{
          id: `${sourceId}-source-vision`, kind: 'set-granting-area-senses', target: 'actor', mode: 'source',
        }, {
          id: `${sourceId}-restore-source-senses`, kind: 'remove-effect', target: 'actor',
          effectId: `${sourceId}-projection-senses`, source: 'self',
        }],
      }],
    }]
  }
  if (spell.id === 'gust-of-wind') return [{
    schemaVersion: 1,
    id: 'spell:gust-of-wind:redirect',
    name: `${spell.name}·改变方向`,
    description: '以附赠动作重新选择强风线状区域的方向。',
    activation: { kind: 'bonus-action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'confirm' }],
    target: {
      kind: 'area', relation: 'any', origin: 'self', shape: 'line',
      lengthFeet: 60, widthFeet: 10, placeRangeFeet: 60,
      maximumTargets: 256, includeSelf: false, rotatable: true,
    },
    outcomes: [{
      id: 'redirect', when: { kind: 'always' }, operations: [{
        id: 'reshape-gust-of-wind', kind: 'reshape-granting-area', target: 'actor',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'gust-of-wind' },
  }]
  if (spell.id === 'levitate') {
    const options = AUDITED_MODE_CHOICES.levitate ?? []
    const outcomes = (usesActorMovement: boolean): Dnd5eActivityDefinitionV1['outcomes'] =>
      options.map((option) => {
        const match = option.id.match(/^(up|down)-(5|10|15|20)$/)!
        return {
          id: option.id,
          when: { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
          operations: [{
            id: `levitate-${usesActorMovement ? 'self' : 'other'}-${option.id}`,
            kind: 'move' as const,
            target: 'target' as const,
            mode: match[1] === 'up' ? 'ascend' as const : 'descend' as const,
            distanceFeet: { kind: 'constant' as const, value: Number(match[2]) },
            ignoresOpportunityAttacks: true,
            usesActorMovement: usesActorMovement || undefined,
          }],
        }
      })
    const common = {
      schemaVersion: 1 as const,
      invocation: { kind: 'active' as const, confirmation: 'actor-choice' as const },
      target: {
        kind: 'creature' as const, relation: 'any' as const, rangeFeet: 60, count: 1,
        includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
      choices: [{ id: 'mode', label: '调整高度', options, defaultOptionId: 'up-5' }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell' as const, id: 'levitate' },
    }
    return [{
      ...common,
      id: 'spell:levitate:move-other', name: `${spell.name}·移动其他目标`,
      description: '使用动作将受你浮空术影响的其他目标上升或下降至多 20 尺。',
      activation: { kind: 'action', cost: 1 },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
      requirements: [
        { kind: 'active-effect', subject: 'actor', effectId: 'levitate-controller', present: true, source: 'self' },
        { kind: 'active-effect', subject: 'target', effectId: 'levitate-target', present: true, source: 'self' },
        { kind: 'target-identity', identity: 'other' },
      ],
      outcomes: outcomes(false),
    }, {
      ...common,
      id: 'spell:levitate:move-self', name: `${spell.name}·移动自己`,
      description: '将受你浮空术影响的自己上升或下降；实际高度计入本回合移动。',
      activation: { kind: 'movement', cost: 0 },
      requirements: [
        { kind: 'active-effect', subject: 'actor', effectId: 'levitate-controller', present: true, source: 'self' },
        { kind: 'active-effect', subject: 'target', effectId: 'levitate-target', present: true, source: 'self' },
        { kind: 'target-identity', identity: 'self' },
      ],
      outcomes: outcomes(true),
    }]
  }
  if (spell.id === 'arcane-hand') {
    const common = {
      schemaVersion: 1 as const,
      activation: { kind: 'bonus-action' as const, cost: 1 },
      invocation: { kind: 'active' as const, confirmation: 'actor-choice' as const },
      consumption: [{
        kind: 'action-economy' as const, economy: 'bonus-action' as const,
        amount: 1 as const, consumeOn: 'confirm' as const,
      }],
      target: {
        kind: 'creature' as const, relation: 'enemy' as const, rangeFeet: 120,
        count: 1, requiresLineOfSight: true, requiresLineOfEffect: true,
      },
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell' as const, id: 'arcane-hand' },
    }
    const relocate = {
      id: 'relocate-arcane-hand', kind: 'relocate-granting-area' as const,
      target: 'target' as const, maximumFeet: { kind: 'constant' as const, value: 60 },
      interposition: { kind: 'clear' as const },
    }
    const interposeRelocate = {
      ...relocate,
      interposition: {
        kind: 'by-target-strength' as const,
        maximumStrengthToBlock: 26,
      },
    }
    const clearPreviousCommand = {
      id: 'clear-previous-arcane-hand-command', kind: 'remove-effects-by-tag' as const,
      target: 'all-combatants' as const, tags: ['arcane-hand-command'],
      match: 'any' as const, source: 'self' as const,
    }
    const opposed = {
      id: 'arcane-hand-contest', kind: 'opposed-ability-check' as const,
      rollId: 'arcane-hand-strength-d20', opposedRollId: 'arcane-hand-target-d20',
      sourceAbility: 'str' as const, sourceModifier: { kind: 'constant' as const, value: 8 },
      sourceRollMode: 'normal' as const,
      sourceRollModeByTargetSizeRank: { maximum: 2, mode: 'advantage' as const },
      targetOptions: [
        { ability: 'str' as const, skill: 'athletics' },
        { ability: 'dex' as const, skill: 'acrobatics' },
      ],
      targetRollMode: 'host-derived' as const, scope: 'per-target' as const,
    }
    return [{
      ...common,
      id: 'spell:arcane-hand:clenched-fist', name: `${spell.name}·紧握之拳`,
      checks: [{
        id: 'spell-attack', kind: 'attack-roll', rollId: 'arcane-hand-fist-d20',
        attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
        rollMode: 'host-derived', delivery: 'melee', scope: 'per-target',
      }],
      outcomes: [{ id: 'command', when: { kind: 'always' }, operations: [clearPreviousCommand, relocate] }, {
        id: 'hit', when: { kind: 'check', checkId: 'spell-attack', result: 'success' },
        operations: [{
          id: 'arcane-hand-fist-damage', kind: 'damage', target: 'target',
          amount: { kind: 'dice', rollId: 'arcane-hand-fist-damage', count: 4, sides: 8 },
          damageType: 'force', critical: 'double-dice', magical: true,
        }],
      }],
      scaling: [{
        basis: 'slot-level', baseLevel: 5,
        adjustments: [{ operationId: 'arcane-hand-fist-damage', diceCountPerStep: 2 }],
      }],
    }, {
      ...common,
      id: 'spell:arcane-hand:forceful-hand', name: `${spell.name}·推击之掌`,
      checks: [opposed],
      outcomes: [{ id: 'command', when: { kind: 'always' }, operations: [clearPreviousCommand, relocate] }, {
        id: 'push', when: { kind: 'check', checkId: opposed.id, result: 'success' },
        operations: [{
          id: 'arcane-hand-push', kind: 'move', target: 'target', mode: 'push',
          distanceFeet: {
            kind: 'add', values: [
              { kind: 'constant', value: 5 },
              { kind: 'multiply', values: [
                { kind: 'constant', value: 5 },
                { kind: 'reference', reference: { kind: 'actor-spellcasting-ability-modifier' } },
              ] },
            ],
          },
          ignoresOpportunityAttacks: true,
        }],
      }],
    }, {
      ...common,
      id: 'spell:arcane-hand:grasping-hand', name: `${spell.name}·擒握之手`,
      requirements: [{ kind: 'size-rank' as const, subject: 'target' as const, maximum: 4 }],
      checks: [opposed],
      effects: [{
        schemaVersion: 1, id: 'arcane-hand-grappled', name: `${spell.name}·擒抱`,
        duration: { kind: 'concentration', maximumRounds: 10 },
        // The caster commands the force hand, but is not the grappler standing
        // within 5 feet of the target.  A generic caster-to-target source link
        // therefore tears the grapple down immediately whenever the caster is
        // farther away.  The concentration duration already ties this rider to
        // the Arcane Hand spell and removes it when that spell ends.
        conditions: ['grappled'],
        tags: ['arcane-hand-command'],
        escapeCheck: {
          ability: 'str', skill: 'athletics', alternativeAbility: 'dex',
          alternativeSkill: 'acrobatics',
          dc: { kind: 'constant', value: 18 }, economy: 'action',
        },
        stacking: 'replace',
      }],
      outcomes: [{ id: 'command', when: { kind: 'always' }, operations: [clearPreviousCommand, relocate] }, {
        id: 'grapple', when: { kind: 'check', checkId: opposed.id, result: 'success' },
        operations: [{
          id: 'apply-arcane-hand-grapple', kind: 'apply-effect', target: 'target',
          effectId: 'arcane-hand-grappled',
        }],
      }],
    }, {
      ...common,
      id: 'spell:arcane-hand:squeeze', name: `${spell.name}·挤压`,
      requirements: [{
        kind: 'active-effect' as const, subject: 'target' as const,
        effectId: 'arcane-hand-grappled', present: true, source: 'self' as const,
      }],
      outcomes: [{
        id: 'squeeze', when: { kind: 'always' }, operations: [{
          id: 'arcane-hand-squeeze-damage', kind: 'damage', target: 'target',
          amount: {
            kind: 'add', values: [
              { kind: 'dice', rollId: 'arcane-hand-squeeze-damage', count: 2, sides: 6 },
              { kind: 'reference', reference: { kind: 'actor-spellcasting-ability-modifier' } },
            ],
          },
          damageType: 'bludgeoning', critical: 'normal', magical: true,
        }],
      }],
      scaling: [{
        basis: 'slot-level', baseLevel: 5,
        adjustments: [{ operationId: 'arcane-hand-squeeze-damage', diceCountPerStep: 2 }],
      }],
    }, {
      ...common,
      id: 'spell:arcane-hand:interposing-hand', name: `${spell.name}·护身之掌`,
      effects: [{
        schemaVersion: 1, id: 'arcane-hand-half-cover', name: `${spell.name}·半身掩护`,
        duration: { kind: 'concentration', maximumRounds: 10 },
        modifiers: [{
          kind: 'attacks-against-source-armor-class', bonus: 2,
        }],
        tags: ['arcane-hand-command'],
        stacking: 'replace',
      }],
      outcomes: [{ id: 'command', when: { kind: 'always' }, operations: [clearPreviousCommand, interposeRelocate] }, {
        id: 'interpose', when: { kind: 'always' }, operations: [{
          id: 'apply-arcane-hand-half-cover', kind: 'apply-effect', target: 'target',
          effectId: 'arcane-hand-half-cover',
        }],
      }],
    }]
  }
  if (spell.id === 'arcane-sword') return [{
    schemaVersion: 1,
    id: 'spell:arcane-sword:attack',
    name: `${spell.name}·移动并攻击`,
    description: '将奥术之剑移动至多 20 尺，并对抵达位置附近的一个目标进行近战法术攻击。',
    activation: { kind: 'bonus-action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'confirm' }],
    target: {
      kind: 'creature', relation: 'enemy', rangeFeet: 60, count: 1,
      requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    checks: [{
      id: 'spell-attack', kind: 'attack-roll', rollId: 'arcane-sword-attack-d20',
      attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
      rollMode: 'host-derived', scope: 'per-target',
    }],
    outcomes: [{
      id: 'move-sword', when: { kind: 'always' },
      operations: [{
        id: 'relocate-arcane-sword', kind: 'relocate-granting-area', target: 'target',
        maximumFeet: { kind: 'constant', value: 20 },
      }],
    }, {
      id: 'attack-hit',
      when: { kind: 'check', checkId: 'spell-attack', result: 'success' },
      operations: [{
        id: 'arcane-sword-repeat-damage', kind: 'damage', target: 'target',
        amount: { kind: 'dice', rollId: 'arcane-sword-repeat-damage', count: 3, sides: 10 },
        damageType: 'force', critical: 'double-dice', magical: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'arcane-sword' },
  }]
  if (spell.id === 'faithful-hound') return [{
    schemaVersion: 1,
    id: 'spell:faithful-hound:bite',
    name: `${spell.name}·撕咬`,
    description: '在施法者回合中，让忠犬攻击其位置 5 尺内的一个敌对生物；每回合一次。',
    activation: { kind: 'free', cost: 0 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    target: {
      kind: 'creature', relation: 'enemy', rangeFeet: 5, count: 1,
      requiresLineOfEffect: true,
    },
    requirements: [{ kind: 'once-per-turn', key: 'faithful-hound-bite' }],
    checks: [{
      id: 'hound-attack', kind: 'attack-roll', rollId: 'hound-attack-d20',
      attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
      rollMode: 'host-derived', scope: 'per-target',
    }],
    outcomes: [{
      id: 'bite-hit',
      when: { kind: 'check', checkId: 'hound-attack', result: 'success' },
      operations: [{
        id: 'hound-bite-damage', kind: 'damage', target: 'target',
        amount: { kind: 'dice', rollId: 'hound-bite-damage', count: 4, sides: 8 },
        damageType: 'piercing', critical: 'double-dice', magical: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'faithful-hound' },
  }]
  if (spell.id === 'shapechange') return [{
    schemaVersion: 1,
    id: 'spell:shapechange:change-form',
    name: `${spell.name}·改变形态`,
    description: '法术持续期间以一个动作变成另一个已见过的合法形态；如果新形态的生命值上限更高，当前生命值不会增加。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    target: { kind: 'self' },
    choices: auditedModeChoices(spell),
    outcomes: [
      ...AUDITED_SHAPECHANGE_FORM_CHOICES.map((option) => ({
        id: `change-form-${option.id}`,
        when: { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
        operations: [{
          id: `shapechange-change-${option.id}`, kind: 'transform-creature' as const, target: 'actor' as const,
          formChoiceId: 'mode', profile: 'shapechange' as const, durationRounds: auditedDurationRounds(spell),
          concentration: true, maximumChallengeRating: 'target-level-or-challenge-rating' as const,
          equipmentChoiceId: 'equipment', seenConfirmationChoiceId: 'seen',
          requiresExistingSourceActivityId: 'spell:shapechange',
        }],
      })),
      {
        id: 'change-form-equipment-fit-boundary',
        when: { kind: 'choice' as const, choiceId: 'equipment', optionId: 'wear' },
        operations: [{
          id: 'change-form-equipment-fit-adjudication',
          kind: 'manual-adjudication' as const,
          prompt: '逐件确认新形态的形状和体型能否实际穿戴施法者选择保留的装备；不合适的装备必须改为掉落或融入新形态。',
          reason: '装备尺寸、形状与新身体结构的适配需要 DM 根据场景裁定。',
          requiresDmApproval: true,
        }],
      },
    ],
    automation: automationCapabilityFromLegacyStatus('partial', [
      '再次变形由 Host 自动结算；只有“由新形态穿戴”的逐件装备适配需要 DM 明示裁定。',
    ]),
    legacySource: { kind: 'spell', id: 'shapechange' },
  }]
  if (spell.id === 'animal-shapes') return [{
    schemaVersion: 1,
    id: 'spell:animal-shapes:change-form',
    name: `${spell.name}·改变形态`,
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    target: { kind: 'creature', relation: 'ally', count: 64, includeSelf: true },
    choices: [{
      id: 'mode', label: '新野兽形态',
      options: AUDITED_ANIMAL_SHAPES_FORM_CHOICES,
    }],
    outcomes: AUDITED_ANIMAL_SHAPES_FORM_CHOICES.map((option) => ({
      id: `change-form-${option.id}`,
      when: { kind: 'choice', choiceId: 'mode', optionId: option.id },
      operations: [{
        id: `animal-shapes-change-${option.id}`, kind: 'transform-creature', target: 'all-targets',
        formChoiceId: 'mode', profile: 'animal-shapes', durationRounds: auditedDurationRounds(spell),
        concentration: true, maximumChallengeRating: 4, maximumSizeRank: 3,
        requiresExistingSourceActivityId: 'spell:animal-shapes',
      }],
    })),
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'animal-shapes' },
  }]
  if (spell.id === 'dispel-evil-and-good') return [{
    schemaVersion: 1,
    id: 'spell:dispel-evil-and-good:break-enchantment',
    name: `${spell.name}·破除附魔`,
    description: '结束一个由天界、元素、精类、邪魔或亡灵来源造成的魅惑、恐慌或附身效果，并结束本法术。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    target: {
      kind: 'creature', relation: 'ally', rangeFeet: 5, count: 1,
      includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    requirements: [{
      kind: 'active-effect', subject: 'actor', effectId: 'dispel-evil-and-good',
      present: true, source: 'self',
    }],
    outcomes: [{
      id: 'break-enchantment', when: { kind: 'always' },
      operations: [{
      id: 'remove-typed-charmed', kind: 'remove-standard-condition',
      target: 'target', condition: 'charmed',
        sourceCreatureTypes: DISPEL_EVIL_AND_GOOD_CREATURE_TYPES,
      }, {
        id: 'remove-typed-frightened', kind: 'remove-standard-condition',
        target: 'target', condition: 'frightened',
        sourceCreatureTypes: DISPEL_EVIL_AND_GOOD_CREATURE_TYPES,
      }, {
        id: 'remove-typed-possession', kind: 'remove-effects-by-tag',
        target: 'target', tags: ['possessed', 'possession'], match: 'any', source: 'any',
        sourceCreatureTypes: DISPEL_EVIL_AND_GOOD_CREATURE_TYPES,
      }, {
        id: 'end-dispel-evil-and-good-after-break', kind: 'remove-effect',
        target: 'actor', effectId: 'dispel-evil-and-good', source: 'self',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'dispel-evil-and-good' },
  }, {
    schemaVersion: 1,
    id: 'spell:dispel-evil-and-good:dismissal',
    name: `${spell.name}·遣返`,
    description: '以近战法术攻击尝试遣返异界生物；命中后由 Host 结算魅力豁免，并结束本法术。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
    target: {
      kind: 'creature', relation: 'enemy', rangeFeet: 5, count: 1,
      requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    requirements: [{
      kind: 'active-effect', subject: 'actor', effectId: 'dispel-evil-and-good',
      present: true, source: 'self',
    }, {
      kind: 'creature-type', subject: 'target', types: DISPEL_EVIL_AND_GOOD_CREATURE_TYPES,
    }],
    checks: [{
      id: 'dismissal-attack', kind: 'attack-roll', rollId: 'dismissal-attack-d20',
      attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
      rollMode: 'host-derived', scope: 'per-target',
    }, {
      id: 'dismissal-save', kind: 'saving-throw', rollId: 'dismissal-save-d20', ability: 'cha',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      rollMode: 'host-derived', scope: 'per-target',
    }],
    effects: [{
      schemaVersion: 1, id: 'dispel-evil-and-good-dismissal',
      name: `${spell.name}·遣返`,
      duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' },
      extensionCondition: 'banished',
      planarBanishment: {
        foreignCreatureTypes: ['celestial', 'elemental', 'fey', 'fiend', '天界生物', '元素生物', '精类', '邪魔'],
        foreignDuration: 'permanent',
        localDurationRounds: 10,
      },
      stacking: 'replace',
    }],
    outcomes: [{
      id: 'end-protection', when: { kind: 'always' }, operations: [{
        id: 'end-dispel-evil-and-good-after-dismissal', kind: 'remove-effect',
        target: 'actor', effectId: 'dispel-evil-and-good', source: 'self',
      }],
    }, {
      id: 'dismiss-on-failed-save',
      when: { kind: 'all', conditions: [
        { kind: 'check', checkId: 'dismissal-attack', result: 'success' },
        { kind: 'check', checkId: 'dismissal-save', result: 'failure' },
      ] },
      operations: [{
        id: 'apply-dismissal', kind: 'apply-effect', target: 'target',
        effectId: 'dispel-evil-and-good-dismissal',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'dispel-evil-and-good' },
  }]
  if (spell.id === 'eyebite') {
    const effects = auditedChoiceEffects(spell)
    return [{
      schemaVersion: 1,
      id: 'spell:eyebite:use-gaze',
      name: `${spell.name}·再次凝视`,
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }],
      target: {
        kind: 'creature', relation: 'enemy', rangeFeet: 60, count: 1,
        requiresLineOfSight: true, requiresLineOfEffect: true,
      },
      requirements: [
        { kind: 'active-effect', subject: 'actor', effectId: 'eyebite-caster', present: true, source: 'self' },
        { kind: 'active-effect', subject: 'target', effectId: 'eyebite-immunity', present: false, source: 'self' },
      ],
      checks: [{
        id: 'spell-save', kind: 'saving-throw', rollId: 'spell-save-d20', ability: 'wis',
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
        rollMode: 'host-derived', scope: 'per-target',
      }],
      choices: auditedModeChoices(spell),
      effects: effects.filter((effect) => effect.id !== 'eyebite-caster'),
      outcomes: [{
        id: 'remember-save', when: { kind: 'always' },
        operations: [{
          id: 'apply-eyebite-immunity', kind: 'apply-effect', target: 'target',
          effectId: 'eyebite-immunity',
        }],
      }, ...(AUDITED_MODE_CHOICES.eyebite ?? []).map((option) => ({
        id: `mode-${option.id}`,
        when: {
          kind: 'all' as const,
          conditions: [
            { kind: 'check' as const, checkId: 'spell-save', result: 'failure' as const },
            { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
          ],
        },
        operations: [{
          id: `apply-eyebite-${option.id}`, kind: 'apply-effect' as const,
          target: 'target' as const, effectId: `eyebite-${option.id}`,
        }],
      }))],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'spell', id: 'eyebite' },
    }]
  }
  if (spell.id === 'holy-aura') return [{
    schemaVersion: 1,
    id: 'holy-aura-retaliatory-blindness',
    name: `${spell.name}·邪魔亡灵反噬`,
    activation: { kind: 'free', cost: 0 },
    invocation: { kind: 'triggered', event: 'reaction-window', confirmation: 'automatic' },
    target: { kind: 'creature', relation: 'enemy', rangeFeet: 5, count: 1 },
    requirements: [
      { kind: 'event-source', source: 'attack' },
      { kind: 'attack-mode', mode: 'melee' },
      { kind: 'attack-result', result: 'hit' },
      { kind: 'creature-type', subject: 'target', types: ['fiend', 'undead', '邪魔', '亡灵', '不死生物'] },
      { kind: 'active-effect', subject: 'actor', effectId: 'holy-aura', present: true, source: 'any' },
    ],
    checks: [{
      id: 'holy-aura-retaliatory-save', kind: 'saving-throw',
      rollId: 'holy-aura-retaliatory-save-d20', ability: 'con',
      dc: {
        kind: 'reference',
        reference: { kind: 'actor-active-effect-source-spell-save-dc', effectId: 'holy-aura' },
      },
      rollMode: 'host-derived', scope: 'per-target',
    }],
    effects: [{
      schemaVersion: 1,
      id: 'holy-aura-retaliatory-blinded',
      name: `${spell.name}·致盲`,
      duration: { kind: 'rounds', rounds: auditedDurationRounds(spell), expiresAt: 'target-turn-end' },
      conditions: ['blinded'],
      sourceLink: { sourceRequiresEffect: 'holy-aura' },
      stacking: 'replace',
    }],
    outcomes: [{
      id: 'blind-on-failed-save',
      when: { kind: 'check', checkId: 'holy-aura-retaliatory-save', result: 'failure' },
      operations: [{
        id: 'apply-holy-aura-blindness', kind: 'apply-effect', target: 'target',
        effectId: 'holy-aura-retaliatory-blinded',
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'holy-aura' },
  }]
  if (spell.id !== 'fire-shield') return []
  return ([
    { mode: 'warm', damageType: 'fire' },
    { mode: 'chill', damageType: 'cold' },
  ] as const).map(({ mode, damageType }) => ({
    schemaVersion: 1,
    id: `fire-shield-${mode}-retaliation`,
    name: `${spell.name}·${mode === 'warm' ? '暖盾' : '寒盾'}反伤`,
    activation: { kind: 'free', cost: 0 },
    invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic' },
    target: { kind: 'creature', relation: 'enemy', rangeFeet: 5, count: 1 },
    requirements: [
      { kind: 'event-source', source: 'attack' },
      { kind: 'attack-mode', mode: 'melee' },
      { kind: 'active-effect', subject: 'actor', effectId: `fire-shield-${mode}`, present: true, source: 'self' },
    ],
    outcomes: [{
      id: 'retaliate',
      when: { kind: 'always' },
      operations: [{
        id: 'retaliation-damage', kind: 'damage', target: 'target',
        amount: { kind: 'dice', rollId: `fire-shield-${mode}-damage`, count: 2, sides: 8 },
        damageType,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'fire-shield' },
  }))
}

function divineWordEffects(spell: RegisteredDnd5ePluginSpell): readonly Dnd5eEffectDefinitionV1[] {
  if (spell.id !== 'divine-word') return []
  return [{
    schemaVersion: 1,
    id: 'divine-word-deafened',
    name: `${spell.name}·耳聋`,
    duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' },
    conditions: ['deafened'],
    stacking: 'replace',
  }, {
    schemaVersion: 1,
    id: 'divine-word-deafened-blinded',
    name: `${spell.name}·耳聋目盲`,
    duration: { kind: 'rounds', rounds: 100, expiresAt: 'target-turn-end' },
    conditions: ['deafened', 'blinded'],
    stacking: 'replace',
  }, {
    schemaVersion: 1,
    id: 'divine-word-deafened-blinded-stunned',
    name: `${spell.name}·耳聋目盲震慑`,
    duration: { kind: 'rounds', rounds: 600, expiresAt: 'target-turn-end' },
    conditions: ['deafened', 'blinded', 'stunned'],
    stacking: 'replace',
  }, {
    schemaVersion: 1,
    id: 'divine-word-planar-return',
    name: `${spell.name}·位面遣返`,
    duration: { kind: 'rounds', rounds: 14_400, expiresAt: 'target-turn-end' },
    extensionCondition: 'banished',
    stacking: 'replace',
  }]
}

function divineWordOutcomes(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1['outcomes'] {
  if (spell.id !== 'divine-word') return []
  const failedSave = { kind: 'check' as const, checkId: 'spell-save', result: 'failure' as const }
  const canHear = {
    kind: 'predicate' as const,
    predicate: { kind: 'condition' as const, subject: 'target' as const, condition: 'deafened' as const, present: false },
  }
  const hp = (comparison: 'above' | 'at-most', value: number) => ({
    kind: 'predicate' as const,
    predicate: { kind: 'hp-value' as const, subject: 'target' as const, comparison, value },
  })
  const threshold = (
    id: string,
    maximum: number,
    minimumExclusive: number | undefined,
    effectId: string,
  ): Dnd5eActivityDefinitionV1['outcomes'][number] => ({
    id,
    when: {
      kind: 'all',
      conditions: [failedSave, canHear, hp('at-most', maximum), ...(minimumExclusive == null ? [] : [hp('above', minimumExclusive)])],
    },
    operations: [{ id: `apply-${effectId}`, kind: 'apply-effect', target: 'target', effectId }],
  })
  return [
    threshold('hp-50-or-less', 50, 40, 'divine-word-deafened'),
    threshold('hp-40-or-less', 40, 30, 'divine-word-deafened-blinded'),
    threshold('hp-30-or-less', 30, 20, 'divine-word-deafened-blinded-stunned'),
    {
      id: 'hp-20-or-less',
      when: { kind: 'all', conditions: [failedSave, canHear, hp('at-most', 20)] },
      operations: [{ id: 'divine-word-instant-death', kind: 'instant-death', target: 'target' }],
    },
    {
      id: 'planar-return',
      when: {
        kind: 'all',
        conditions: [failedSave, canHear, {
          kind: 'predicate',
          predicate: {
            kind: 'creature-type', subject: 'target',
            types: ['celestial', 'elemental', 'fey', 'fiend', '天界生物', '元素生物', '精类', '邪魔'],
          },
        }],
      },
      operations: [{
        id: 'apply-divine-word-planar-return', kind: 'apply-effect', target: 'target',
        effectId: 'divine-word-planar-return',
      }],
    },
  ]
}

function directAuditedOperations(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1['outcomes'][number]['operations'] {
  const persistentDetectionMode = spell.id === 'detect-magic'
    ? 'magic'
    : spell.id === 'detect-evil-and-good'
      ? 'planar-creatures'
      : spell.id === 'detect-poison-and-disease'
        ? 'poison-disease'
        : undefined
  if (persistentDetectionMode) return [{
    id: `${spell.id}-persistent-detection`, kind: 'mechanic', target: 'actor',
    handlerId: 'core.persistent-detection',
    parameters: {
      mode: persistentDetectionMode,
      'range-feet': 30,
      'duration-rounds': auditedDurationRounds(spell),
    },
  }]
  if (spell.id === 'compulsion') return [{
    id: 'apply-compulsion-target', kind: 'apply-effect', target: 'all-targets',
    effectId: 'compulsion-target',
  }]
  if (spell.id === 'message') return [{
    id: 'message-resolved', kind: 'mechanic', target: 'actor',
    handlerId: 'core.resolve-only',
  }]
  if (spell.id === 'arcane-eye') return [{
    id: 'arcane-eye-sensor', kind: 'create-persistent-area', label: spell.name,
    durationRounds: auditedDurationRounds(spell), concentration: true,
    color: '#38bdf8', movement: { economy: 'action', maximumFeet: 30 },
    effectToken: {
      label: spell.name, emoji: '◉', color: '#38bdf8', size: 0.5,
      hiddenBody: true, shareVisionWithSource: true, darkvisionRangeFeet: 30,
    },
  }]
  if (spell.id === 'mislead' || spell.id === 'project-image') return [{
    id: `${spell.id}-controller-effect`, kind: 'apply-effect', target: 'actor',
    effectId: `${spell.id}-controller`,
  }, ...(spell.id === 'mislead' ? [{
    id: 'mislead-invisibility-effect', kind: 'apply-effect' as const, target: 'actor' as const,
    effectId: 'mislead-invisible',
  }] : []), {
    id: `${spell.id}-projection`, kind: 'create-persistent-area', label: spell.name,
    durationRounds: auditedDurationRounds(spell), concentration: true,
    color: spell.id === 'mislead' ? '#a78bfa' : '#60a5fa',
    anchorMode: 'fixed', visual: spell.id === 'mislead'
      ? { preset: 'mislead', intensity: 'strong' }
      : { preset: 'project-image', intensity: 'strong' },
    effectToken: {
      label: spell.name, emoji: '◈', color: spell.id === 'mislead' ? '#a78bfa' : '#60a5fa',
      size: 1, hiddenBody: spell.id === 'mislead', shareVisionWithSource: false,
    },
    // Project Image ends after taking any damage. The generic spell-entity
    // settlement UI clamps attacks and damage to at least 1, so AC 1 / HP 1
    // models that rule without inventing the caster's AC or creature stats.
    ...(spell.id === 'project-image' ? {
      entityProfile: {
        armorClass: 1,
        hitPoints: 1,
        strength: 1,
        cannotAttack: true,
        invisible: false,
      },
    } : {}),
    grantedActivities: [{
      activityId: `spell:${spell.id}:move-projection`, label: `${spell.name}·移动投影`,
    }, {
      activityId: `spell:${spell.id}:switch-senses`, label: `${spell.name}·切换视听`,
    }],
  }]
  if (spell.id === 'floating-disk') return [{
    id: 'floating-disk-entity', kind: 'create-persistent-area', label: spell.name,
    durationRounds: auditedDurationRounds(spell), concentration: false,
    color: '#cbd5e1', anchorMode: 'fixed', visual: { preset: 'arcane', intensity: 'subtle' },
    effectToken: {
      label: spell.name, emoji: '◯', color: '#cbd5e1', size: 0.6,
      hiddenBody: false,
    },
    sourceFollower: {
      stationaryWithinFeet: 20, maximumSeparationFeet: 100,
      maximumStepHeightFeet: 10, carryingCapacityPounds: 500,
    },
  }]
  if (spell.id === 'arcane-sword') return [{
    id: 'arcane-sword-initial-damage', kind: 'damage', target: 'target',
    amount: { kind: 'dice', rollId: 'arcane-sword-initial-damage', count: 3, sides: 10 },
    damageType: 'force', critical: 'double-dice', magical: true,
  }]
  if (spell.id === 'faithful-hound') return [{
    id: 'faithful-hound-entity', kind: 'create-persistent-area', label: spell.name,
    durationRounds: auditedDurationRounds(spell), concentration: false,
    color: '#94a3b8', anchorMode: 'fixed',
    visual: { preset: 'arcane', intensity: 'subtle' },
    effectToken: {
      label: spell.name, emoji: '🐕', color: '#94a3b8', size: 0.75,
      hiddenBody: false, visibleToSourceOnly: true,
    },
    grantedActivities: [{
      activityId: 'spell:faithful-hound:bite', label: `${spell.name}·撕咬`,
    }],
  }]
  if (spell.id === 'resilient-sphere') return [{
    id: 'resilient-sphere-boundary', kind: 'create-persistent-area', label: spell.name,
    durationRounds: auditedDurationRounds(spell), concentration: true,
    color: '#c4b5fd', anchorMode: 'target-token',
    blocking: {
      movement: true, movementMode: 'boundary',
      lineOfEffect: true, lineOfEffectMode: 'boundary',
    },
  }]
  if (spell.id === 'passwall') return [{
    id: 'passwall-opening', kind: 'create-persistent-area', label: spell.name,
    durationRounds: auditedDurationRounds(spell), concentration: false,
    color: '#a78bfa', anchorMode: 'fixed',
    visual: { preset: 'arcane', intensity: 'subtle' },
    blocking: { suppressesMappedBarriers: true },
  }]
  if (spell.id === 'arcane-lock') return [{
    id: 'arcane-lock-map-object', kind: 'modify-map-object-lock',
    mode: 'arcane-lock', targetKinds: ['door', 'obstacle'],
    accessPolicy: 'selected-creatures-and-password',
  }]
  if (spell.id === 'knock') return [{
    id: 'knock-map-object', kind: 'modify-map-object-lock',
    mode: 'knock', targetKinds: ['door', 'obstacle'], suppressionMinutes: 10,
  }, {
    id: 'knock-audible-event', kind: 'emit-sound', target: 'actor',
    label: spell.name, audibleRadiusFeet: 300,
  }]
  if (spell.id === 'blink') return [{
    id: 'blink-turn-end-phase', kind: 'mechanic', target: 'actor',
    handlerId: 'core.turn-end-random-condition',
    parameters: {
      'die-sides': 20, minimum: 11, condition: 'banished',
      'duration-rounds': auditedDurationRounds(spell),
      'dismiss-action-label': '用动作解除闪现术',
    },
  }]
  if (spell.id === 'time-stop') return [{
    id: 'time-stop-extra-turns', kind: 'grant-extra-turns', target: 'actor',
    turns: {
      kind: 'add',
      values: [
        { kind: 'dice', rollId: 'time-stop-extra-turns-d4', count: 1, sides: 4 },
        { kind: 'constant', value: 1 },
      ],
    },
    freezeOtherCreatures: true,
    endOnAffectOther: true,
    maximumDistanceFromOriginFeet: { kind: 'constant', value: 1_000 },
  }]
  if (spell.id === 'phantom-steed') return [{
    id: 'phantom-steed-summon', kind: 'summon', monsterId: 'srd-5.1:riding-horse',
    count: { kind: 'constant', value: 1 }, timing: 'immediate',
    durationRounds: auditedDurationRounds(spell), concentration: false, side: 'ally',
    walkingSpeedFeet: { kind: 'constant', value: 100 }, dismissAfterDamageRounds: 10,
  }]
  if (spell.id === 'find-familiar') return [{
    id: 'find-familiar-controller-link', kind: 'apply-effect', target: 'actor',
    effectId: 'find-familiar-controller',
  }]
  if (spell.id === 'heroes-feast') return [{
    id: 'heroes-feast-cure-poisoned', kind: 'remove-standard-condition',
    target: 'all-targets', condition: 'poisoned',
  }, {
    id: 'heroes-feast-cure-diseases', kind: 'remove-effects-by-tag',
    target: 'all-targets', tags: ['disease'], match: 'any', source: 'any',
  }]
  if (spell.id === 'feeblemind') return [{
    id: 'feeblemind-lower-intelligence', kind: 'lower-ability-score', target: 'target',
    ability: 'int', maximumScore: { kind: 'constant', value: 1 },
    recovery: 'restoration-magic', recoveryGroupId: 'spell.feeblemind',
  }, {
    id: 'feeblemind-lower-charisma', kind: 'lower-ability-score', target: 'target',
    ability: 'cha', maximumScore: { kind: 'constant', value: 1 },
    recovery: 'restoration-magic', recoveryGroupId: 'spell.feeblemind',
  }]
  if (spell.id === 'levitate') return [{
    id: 'apply-levitate-controller', kind: 'apply-effect', target: 'actor',
    effectId: 'levitate-controller',
  }, {
    id: 'apply-levitate-safe-descent', kind: 'apply-effect', target: 'target',
    effectId: 'levitate-safe-descent',
  }]
  if (spell.id === 'reverse-gravity') return [{
    // The save is scoped per target, so the failed-save outcome must move only
    // the target currently being resolved. `all-targets` would run once after
    // the first failure and incorrectly lift creatures whose Dexterity save
    // succeeded.
    id: 'reverse-gravity-rise', kind: 'move', target: 'target', mode: 'ascend',
    distanceFeet: { kind: 'constant', value: 100 }, verticalDestination: 'area-top',
    ignoresOpportunityAttacks: true,
  }]
  if (spell.id === 'remove-curse') return [{
    id: 'remove-curse-effect', kind: 'remove-effects-by-tag',
    target: 'all-targets', tags: ['curse'], match: 'any', source: 'any', maximumCount: 1,
  }]
  if (spell.id === 'identify') return [{
    id: 'identify-selected-item', kind: 'identify-inventory-item', target: 'actor',
  }]
  if (spell.id === 'instant-summons') return [{
    id: 'bind-instant-summons-object', kind: 'establish-spell-authority',
    target: 'actor', recordKind: 'linked-planar-object', linkedObjectProfile: 'instant-summons',
    requiresSelectedInventoryItem: true,
  }, {
    id: 'apply-instant-summons-controller', kind: 'apply-effect', target: 'actor',
    effectId: 'instant-summons-controller',
  }]
  if (spell.id === 'secret-chest') return [{
    id: 'bind-secret-chest', kind: 'establish-spell-authority',
    target: 'actor', recordKind: 'linked-planar-object', linkedObjectProfile: 'secret-chest',
    requiresSelectedInventoryItem: true,
  }, {
    id: 'apply-secret-chest-controller', kind: 'apply-effect', target: 'actor',
    effectId: 'secret-chest-controller',
  }]
  if (spell.id === 'magic-jar') return [{
    id: 'establish-magic-jar-vessel', kind: 'establish-spell-authority',
    target: 'actor', recordKind: 'soul-vessel',
  }, {
    id: 'apply-magic-jar-controller', kind: 'apply-effect', target: 'actor',
    effectId: 'magic-jar-controller',
  }]
  if (spell.id === 'meld-into-stone') return [{
    id: 'establish-terrain-merge', kind: 'establish-spell-authority',
    target: 'actor', recordKind: 'terrain-merge',
  }]
  if (spell.id === 'simulacrum') return [{
    id: 'capture-simulacrum-subject', kind: 'establish-spell-authority',
    target: 'all-targets', recordKind: 'simulacrum-companion',
  }, {
    id: 'create-simulacrum-companion', kind: 'duplicate-creature',
    target: 'all-targets', profile: 'simulacrum', persistent: true,
    maximumHitPointDivisor: 2, cannotIncreaseLevel: true, cannotRegainSpellSlots: true,
  }]
  if (spell.id === 'fire-storm') return [{
    id: 'fire-storm-damage', kind: 'damage', target: 'target',
    amount: { kind: 'dice', rollId: 'fire-storm-damage', count: 7, sides: 10 },
    damageType: 'fire', critical: 'normal', magical: true,
  }]
  if (spell.id === 'regenerate') return [{
    id: 'regenerate-initial-healing', kind: 'healing', target: 'target',
    amount: {
      kind: 'add', values: [
        { kind: 'dice', rollId: 'regenerate-initial-healing', count: 4, sides: 8 },
        { kind: 'constant', value: 15 },
      ],
    },
  }]
  if (spell.id === 'revivify') return [{
    id: 'revivify-target', kind: 'revive', target: 'target',
    hitPoints: { kind: 'constant', value: 1 }, maximumDeathAgeRounds: 10,
    excludedCreatureTypes: ['undead', '亡灵'], requiresBody: true,
  }]
  if (spell.id === 'raise-dead') return [{
    id: 'raise-dead-target', kind: 'revive', target: 'target',
    hitPoints: { kind: 'constant', value: 1 }, maximumDeathAgeRounds: 144_000,
    excludedCreatureTypes: ['undead', '亡灵'], requiresBody: true,
    removeConditions: ['poisoned'], removeDiseases: 'nonmagical',
    longRestPenalty: { initial: 4, recoveryPerLongRest: 1 },
  }]
  if (spell.id === 'resurrection') return [{
    id: 'resurrection-target', kind: 'revive', target: 'target',
    hitPoints: { kind: 'reference', reference: { kind: 'target-max-hp' } },
    maximumDeathAgeRounds: 525_600_000, excludedCreatureTypes: ['undead', '亡灵'],
    requiresBody: true, restoreBody: 'missing-parts', removeConditions: ['poisoned'],
    removeDiseases: 'nonmagical', longRestPenalty: { initial: 4, recoveryPerLongRest: 1 },
    casterLongRestStrainAfterDeathAgeRounds: 5_256_000,
  }]
  if (spell.id === 'true-resurrection') return [{
    id: 'true-resurrection-target', kind: 'revive', target: 'target',
    hitPoints: { kind: 'reference', reference: { kind: 'target-max-hp' } },
    maximumDeathAgeRounds: 1_051_200_000, excludedCreatureTypes: ['undead', '亡灵'],
    excludesDeathFromOldAge: true, requiresFreeWillingSoul: true,
    restoreBody: 'complete', removeConditions: ['poisoned'], removeDiseases: 'all',
    removeCurses: 'all', createsNewBodyIfMissing: true,
    requiresSpokenNameIfBodyMissing: true, newBodyPlacementRangeFeet: 10,
  }]
  return []
}

function unconditionalAuditedOperations(
  spell: RegisteredDnd5ePluginSpell,
): Dnd5eActivityDefinitionV1['outcomes'][number]['operations'] {
  if (spell.id === 'wind-walk') return [{
    id: 'apply-initial-wind-walk-cloud-form', kind: 'apply-effect',
    target: 'all-targets', effectId: 'wind-walk-cloud-form',
  }]
  if (spell.id === 'arcane-sword') return [{
    id: 'arcane-sword-entity', kind: 'create-persistent-area', label: spell.name,
    durationRounds: auditedDurationRounds(spell), concentration: true,
    color: '#818cf8', anchorMode: 'fixed',
    visual: { preset: 'arcane', intensity: 'normal' },
    effectToken: {
      label: spell.name, emoji: '⚔', color: '#818cf8', size: 0.5,
      hiddenBody: false,
    },
    grantedActivities: [{
      activityId: 'spell:arcane-sword:attack', label: `${spell.name}·移动并攻击`,
    }],
  }]
  if (spell.id === 'compulsion') return [{
    id: 'apply-compulsion-controller', kind: 'apply-effect', target: 'actor',
    effectId: 'compulsion-controller',
  }]
  if (spell.id === 'arcane-hand') return [{
    id: 'arcane-hand-entity', kind: 'create-persistent-area', label: spell.name,
    durationRounds: auditedDurationRounds(spell), concentration: true,
    color: '#60a5fa', anchorMode: 'fixed',
    visual: { preset: 'arcane', intensity: 'strong' },
    effectToken: {
      label: spell.name, emoji: '✋', color: '#60a5fa', size: 2,
      hiddenBody: false,
    },
    entityProfile: {
      armorClass: 20,
      hitPoints: 'actor-max-hit-points',
      strength: 26,
      dexterity: 10,
      cannotAttack: true,
      invisible: false,
    },
    grantedActivities: [
      { activityId: 'spell:arcane-hand:clenched-fist', label: `${spell.name}·紧握之拳` },
      { activityId: 'spell:arcane-hand:forceful-hand', label: `${spell.name}·推击之掌` },
      { activityId: 'spell:arcane-hand:grasping-hand', label: `${spell.name}·擒握之手` },
      { activityId: 'spell:arcane-hand:squeeze', label: `${spell.name}·挤压` },
      { activityId: 'spell:arcane-hand:interposing-hand', label: `${spell.name}·护身之掌` },
    ],
  }]
  if (spell.id === 'goodberry') return [{
    id: 'create-goodberries', kind: 'grant-inventory-item', target: 'actor',
    templateId: 'srd-5.1:item:goodberry', quantity: { kind: 'constant', value: 10 },
    identified: true, expiresAfterMinutes: 1_440,
  }]
  if (spell.id === 'create-food-and-water') return [{
    id: 'create-food-portions', kind: 'grant-inventory-item', target: 'actor',
    templateId: 'srd-5.1:item:conjured-food-portion', quantity: { kind: 'constant', value: 15 },
    identified: true, expiresAfterMinutes: 1_440,
  }, {
    id: 'create-water-gallons', kind: 'grant-inventory-item', target: 'actor',
    templateId: 'srd-5.1:item:conjured-water-gallon', quantity: { kind: 'constant', value: 30 },
    identified: true,
  }]
  if (spell.id === 'clone') return [{
    id: 'establish-clone-receptacle', kind: 'establish-spell-authority',
    target: 'actor', recordKind: 'clone-receptacle', maturesAfterMinutes: 172_800,
  }]
  if (spell.id === 'eyebite') return [{
    id: 'arm-eyebite-caster', kind: 'apply-effect', target: 'actor', effectId: 'eyebite-caster',
  }, {
    id: 'remember-eyebite-target-save', kind: 'apply-effect', target: 'all-targets',
    effectId: 'eyebite-immunity',
  }]
  if (spell.id === 'feeblemind') return [{
    id: 'feeblemind-damage', kind: 'damage', target: 'target',
    amount: { kind: 'dice', rollId: 'feeblemind-damage', count: 4, sides: 6 },
    damageType: 'psychic', critical: 'normal', magical: true,
  }]
  return []
}

function auditedPersistentAreaExtension(
  spell: RegisteredDnd5ePluginSpell,
): Partial<Extract<Dnd5eActivityOperationV1, { kind: 'create-persistent-area' }>> {
  if (spell.id === 'delayed-blast-fireball') return {
    visual: { preset: 'wall-of-fire', intensity: 'strong' },
    triggers: [{
      id: 'delayed-blast-fireball-detonation',
      label: `${spell.name}·爆炸`, timing: 'on-detonate',
      savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'half', magical: true },
      damage: { count: 12, sides: 6, type: 'fire' },
    }],
    lifecycle: {
      timing: 'source-turn-end', advanceOnCreationRound: true, maximumAdvances: 10,
      damageDiceCountDelta: 1,
      damageTriggerIds: ['delayed-blast-fireball-detonation'],
      minimumDamageDiceCount: 12,
    },
    grantedActivities: [{
      activityId: 'spell:delayed-blast-fireball:detonate',
      label: `${spell.name}·引爆`,
    }],
  }
  if (spell.id === 'incendiary-cloud') return {
    visual: { preset: 'toxic-cloud', intensity: 'strong' },
    obscuration: { kind: 'heavy' },
    // At the start of each caster turn the cloud moves 10 feet in a direction
    // chosen by that caster. Expose the choice as a no-economy persistent-area
    // move instead of silently translating it along a stale source vector.
    movement: { economy: 'none', maximumFeet: 10 },
    triggers: [{
      id: 'incendiary-cloud-create', label: `${spell.name}·生成`, timing: 'on-create',
      savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'half', magical: true },
      damage: { count: 10, sides: 8, type: 'fire' },
    }, {
      id: 'incendiary-cloud-enter', frequencyGroupId: 'incendiary-cloud-contact',
      label: `${spell.name}·进入`, timing: 'on-enter', oncePerTurn: true,
      savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'half', magical: true },
      damage: { count: 10, sides: 8, type: 'fire' },
    }, {
      id: 'incendiary-cloud-turn-end', frequencyGroupId: 'incendiary-cloud-contact',
      label: `${spell.name}·回合结束`, timing: 'turn-end', oncePerTurn: true,
      savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'half', magical: true },
      damage: { count: 10, sides: 8, type: 'fire' },
    }],
  }
  if (spell.id === 'gust-of-wind') return {
    visual: { preset: 'arcane', intensity: 'normal' },
    movementCostMultiplier: 2,
    anchorMode: 'source-token',
    grantedActivities: [{
      activityId: 'spell:gust-of-wind:redirect', label: `${spell.name}·改变方向`,
    }],
    triggers: [{
      id: 'gust-of-wind-turn-start', label: `${spell.name}·强风推动`,
      timing: 'turn-start', oncePerTurn: true,
      savingThrow: { ability: 'str', dc: 'source-save-dc', onSuccess: 'none', magical: true },
      forcedMovement: {
        mode: 'push-from-source', distanceFeet: 15, appliesOn: 'failed-save',
      },
    }],
  }
  if (spell.id === 'guardian-of-faith') return {
    visual: { preset: 'arcane', intensity: 'strong' },
    effectToken: {
      label: spell.name, emoji: '🛡️', color: '#fde68a', size: 2, hiddenBody: false,
    },
    triggers: [{
      id: 'guardian-of-faith-enter', label: `${spell.name}·守卫打击`,
      timing: 'on-enter', oncePerTurn: true,
      savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'half', magical: true },
      damage: { count: 0, sides: 6, modifier: 20, type: 'radiant' },
      maximumTotalDamage: 60,
    }],
  }
  if (spell.id === 'alarm') return {
    visual: { preset: 'arcane', intensity: 'subtle' },
  }
  if (spell.id === 'antilife-shell') return {
    visual: { preset: 'arcane', intensity: 'normal' },
    blocking: {
      movement: true,
      movementMode: 'enter',
      excludedCreatureTypes: ['construct', 'undead'],
      excludeSourceToken: true,
    },
    anchorMode: 'source-token',
    sourceOverlapBehavior: 'remove-area',
  }
  if (spell.id === 'antimagic-field') return {
    visual: { preset: 'arcane', intensity: 'normal' },
    occupantModifiers: { suppressesMagic: true },
  }
  if (spell.id === 'globe-of-invulnerability') return {
    visual: { preset: 'arcane', intensity: 'strong' },
    // The globe appears around the caster when cast, but the rules explicitly
    // describe the resulting barrier as stationary.  Self-origin areas default
    // to following the source token, so pin this spell to its creation cells.
    anchorMode: 'fixed',
    occupantModifiers: { suppressesSpellsThroughLevel: 5 },
    castLevelProfiles: [7, 8, 9].map((minimumCastLevel) => ({
      minimumCastLevel,
      durationRounds: 10,
      concentration: true,
      occupantModifiers: { suppressesSpellsThroughLevel: minimumCastLevel - 1 },
    })),
  }
  if (spell.id === 'forbiddance') return {
    visual: { preset: 'arcane', intensity: 'subtle' },
    blocking: { blocksTeleportationEntry: true },
  }
  if (spell.id === 'private-sanctum') return {
    visual: { preset: 'arcane', intensity: 'subtle' },
    blocking: { blocksTeleportationEntry: true, blocksTeleportationExit: true },
  }
  if (spell.id === 'tiny-hut') return {
    visual: { preset: 'arcane', intensity: 'normal' },
    blocking: {
      movement: true,
      movementMode: 'enter',
      entryPermission: 'occupants-at-creation',
      blocksTeleportationEntry: true,
      vision: true,
      visionMode: 'outside-in',
      lineOfEffect: true,
      lineOfEffectMode: 'boundary',
    },
    creationConstraints: {
      // Tiny Hut holds the caster plus up to nine other Medium-or-smaller
      // creatures. The map constraint counts every creature in the area,
      // including the caster, so the total limit is ten.
      maximumCreatureCount: 10,
      maximumCreatureSizeRank: 2,
    },
    anchorMode: 'fixed',
    sourceExitBehavior: 'remove-area',
  }
  if (spell.id === 'reverse-gravity') return {
    visual: { preset: 'arcane', intensity: 'strong' },
    occupantModifiers: { magicallyHeldAloft: true },
  }
  if (spell.id === 'storm-of-vengeance') return {
    visual: { preset: 'call-lightning', intensity: 'strong' },
    triggers: [{
      id: 'storm-of-vengeance-round-1', label: `${spell.name}·第一轮雷鸣`, timing: 'on-create',
      minimumLifecycleAdvances: 0, maximumLifecycleAdvances: 0,
      savingThrow: { ability: 'con', dc: 'source-save-dc', onSuccess: 'none', magical: true },
      damage: { count: 2, sides: 6, type: 'thunder' },
      condition: {
        condition: 'deafened',
        duration: { expiresAt: 'target-turn-end', remainingRounds: 50 },
      },
    }, {
      id: 'storm-of-vengeance-round-2', label: `${spell.name}·第二轮酸雨`, timing: 'source-turn-start',
      minimumLifecycleAdvances: 1, maximumLifecycleAdvances: 1,
      targetKinds: ['creature'],
      damage: { count: 1, sides: 6, type: 'acid' },
    }, {
      id: 'storm-of-vengeance-round-3', label: `${spell.name}·第三轮闪电`, timing: 'source-turn-start',
      minimumLifecycleAdvances: 2, maximumLifecycleAdvances: 2,
      maximumTotalUses: 6, sourceChoosesTargets: true,
      targetKinds: ['creature'],
      savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'half', magical: true },
      damage: { count: 10, sides: 6, type: 'lightning' },
    }, {
      id: 'storm-of-vengeance-round-4', label: `${spell.name}·第四轮冰雹`, timing: 'source-turn-start',
      minimumLifecycleAdvances: 3, maximumLifecycleAdvances: 3,
      damage: { count: 2, sides: 6, type: 'bludgeoning' },
    }, {
      id: 'storm-of-vengeance-round-5-10', label: `${spell.name}·冻雨狂风`, timing: 'source-turn-start',
      minimumLifecycleAdvances: 4, maximumLifecycleAdvances: 9,
      damage: { count: 1, sides: 6, type: 'cold' },
    }],
    lifecycle: {
      timing: 'source-turn-start',
      stages: [{
        atAdvance: 4,
        movementCostMultiplier: 2,
        obscuration: { kind: 'heavy' },
        occupantModifiers: {
          preventsRangedWeaponAttacks: true,
          concentrationSavingThrowDisadvantage: true,
        },
        dispersesFogAndMist: true,
      }],
    },
  }
  return {}
}

/**
 * Converts one audited deterministic SRD spell to a data-only Activity. Every
 * non-structural rule family becomes a durable Host rule-state. Concrete
 * consumers can match these exact ids without introducing spell-specific
 * executable branches or trusting prose supplied by a client.
 */
function fullActivity(spell: RegisteredDnd5ePluginSpell): Dnd5eActivityDefinitionV1 {
  if (spell.id === 'conjure-celestial') return conjureCelestialActivity(spell)
  if (spell.id === 'conjure-elemental') return conjureElementalActivity(spell)
  if (spell.id === 'conjure-fey') return conjureFeyActivity(spell)
  if (spell.id === 'conjure-minor-elementals') return conjureMinorElementalsActivity(spell)
  if (spell.id === 'conjure-woodland-beings') return conjureWoodlandBeingsActivity(spell)
  if (spell.id === 'magic-mouth') return magicMouthActivity(spell)
  if (spell.id === 'command') return commandActivity(spell)
  if (spell.id === 'legend-lore') return legendLoreActivity(spell)
  if (
    spell.id === 'disguise-self' || spell.id === 'illusory-script' ||
    spell.id === 'mirage-arcane' || spell.id === 'unseen-servant'
  ) {
    return partialActivity(spell)
  }
  const source = spell as Dnd5ePluginSpellDefinition
  const base = dnd5eActivityFromSpellDefinition(source, 'headless-action')
  const auditedTarget: Dnd5eActivityDefinitionV1['target'] =
    spell.id === 'fire-storm' && base.target.kind === 'area'
      ? {
          ...base.target,
          instanceCount: 10,
          minimumInstanceCount: 1,
          instanceAdjacency: 'face',
        }
      : spell.id === 'guardian-of-faith' && base.target.kind === 'area'
        ? {
            ...base.target,
            relation: 'enemy',
            includeSelf: false,
            unoccupiedAnchorSizeFeet: 10,
          }
      : spell.id === 'phantom-steed' || spell.id === 'find-familiar'
        ? { kind: 'self' }
      : spell.id === 'floating-disk'
        ? {
            kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
            // The force plane is 3 feet across. A zero-radius point placement
            // keeps its rules footprint to the selected grid cell; the 0.6-size
            // effect Token renders the physical three-foot diameter precisely.
            placeRangeFeet: 30, radiusFeet: 0, maximumTargets: 1,
            requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'arcane-eye'
        ? {
            kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
            placeRangeFeet: 30, radiusFeet: 5, maximumTargets: 1,
            requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'mislead'
        ? {
            kind: 'area', relation: 'any', origin: 'self', shape: 'circle',
            placeRangeFeet: 5, radiusFeet: 5, maximumTargets: 1,
            includeSelf: true, requiresLineOfSight: false, requiresLineOfEffect: false,
          }
      : spell.id === 'project-image'
        ? {
            kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
            placeRangeFeet: 100_000, radiusFeet: 5, maximumTargets: 1,
            requiresLineOfSight: false, requiresLineOfEffect: false,
          }
      : spell.id === 'arcane-sword'
        ? {
            kind: 'area', relation: 'enemy', origin: 'point', shape: 'circle',
            placeRangeFeet: 60, radiusFeet: 5, maximumTargets: 1,
            requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'arcane-hand'
        ? {
            kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
            placeRangeFeet: 120, radiusFeet: 5, maximumTargets: 1,
            requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'magic-circle'
        ? {
            kind: 'area', relation: 'any', origin: 'point', shape: 'cylinder',
            placeRangeFeet: 10, radiusFeet: 10, heightFeet: 20,
            maximumTargets: 256, includeSelf: true,
            requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'resilient-sphere'
        ? {
            kind: 'area', relation: 'any', origin: 'point', shape: 'sphere',
            placeRangeFeet: 30, radiusFeet: 5, maximumTargets: 1,
            includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'reverse-gravity'
        ? {
            kind: 'area', relation: 'any', origin: 'point', shape: 'cylinder',
            placeRangeFeet: 100, radiusFeet: 50, heightFeet: 100,
            maximumTargets: 256, includeSelf: true,
            requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'passwall'
        ? {
            kind: 'area', relation: 'any', origin: 'point', shape: 'rect',
            placeRangeFeet: 30, lengthFeet: 20, widthFeet: 5, heightFeet: 8,
            // Creatures are occupants of the passage, not selected spell
            // targets. The opening may legally overlap the caster and any
            // number of nearby creatures; closure/ejection is map-owned.
            maximumTargets: 256, includeSelf: true, rotatable: true,
            requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'arcane-lock' || spell.id === 'knock'
        ? {
            kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
            placeRangeFeet: spell.id === 'arcane-lock' ? 5 : 60,
            radiusFeet: 5, maximumTargets: 1,
            requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'goodberry' || spell.id === 'create-food-and-water' || spell.id === 'identify' || spell.id === 'clone' ||
          spell.id === 'instant-summons' || spell.id === 'magic-jar' || spell.id === 'meld-into-stone' ||
          spell.id === 'secret-chest'
        ? { kind: 'self' }
      : spell.id === 'animal-shapes'
        ? {
            kind: 'creature', relation: 'ally', rangeFeet: 30, count: 64,
            includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'polymorph'
        ? {
            kind: 'creature', relation: 'any', rangeFeet: 60, count: 1,
            includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'eyebite'
        ? {
            kind: 'creature', relation: 'enemy', rangeFeet: 60, count: 1,
            requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'true-resurrection'
        ? {
            // A remaining corpse is still a Touch target. When no body exists,
            // the spell instead creates the named creature's body in a chosen
            // unoccupied space within 10 feet. The outer spell transaction has
            // the corpse ledger and enforces that conditional 5/10-foot split;
            // the generic Activity gate must admit the wider legal branch.
            kind: 'creature', relation: 'any', rangeFeet: 10, count: 1,
            includeSelf: false, requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'nondetection'
        ? {
            // Touch may protect the caster or any other willing creature. The
            // generic legacy adapter only enables self for an explicit Self
            // range, which made this legal use impossible in the map UI.
            kind: 'creature', relation: 'any', rangeFeet: 5, count: 1,
            includeSelf: true, requiresLineOfSight: true, requiresLineOfEffect: true,
          }
      : spell.id === 'message'
        ? { kind: 'self' }
      : base.target
  const decision = decisions[spell.id]!
  // These spells settle their saves through persistent-area triggers. A
  // top-level Activity save would either roll twice (Incendiary Cloud) or ask
  // current occupants to save before they first enter (Guardian of Faith).
  const persistentAreaOwnsSavingThrow = spell.id === 'incendiary-cloud' ||
    spell.id === 'guardian-of-faith'
  // Descriptions of beneficial effects often mention that they grant save
  // advantage. Only audit decisions that explicitly declare a saving throw
  // may create a Host check; prose matching alone would make buffs such as
  // Haste incorrectly ask their willing target to save.
  const saveAbility = (decision.includes('saving-throw') || spell.id === 'divine-word' || spell.id === 'polymorph' || spell.id === 'reverse-gravity') &&
    spell.id !== 'irresistible-dance' && !persistentAreaOwnsSavingThrow
    ? spell.id === 'polymorph'
      ? 'wis'
      : spell.id === 'reverse-gravity'
        ? 'dex'
        : auditedSavingThrowAbility(spell)
    : undefined
  const hasSpellAttack = decision.includes('spell-attack')
  const checks: Dnd5eActivityDefinitionV1['checks'] = saveAbility
    ? [{
        id: 'spell-save', kind: 'saving-throw', rollId: 'spell-save-d20', ability: saveAbility,
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
        rollMode: 'host-derived', scope: 'per-target',
        ...((spell.id === 'polymorph' || spell.id === 'levitate' || spell.id === 'light')
          ? { automaticFailureIfAllied: true }
          : {}),
        ...(spell.id === 'enthrall' ? {
          automaticSuccessIfConditionImmune: 'charmed' as const,
          rollModeIfOpposed: 'advantage' as const,
        } : {}),
        ...(spell.id === 'compulsion' ? {
          automaticSuccessIfConditionImmune: 'charmed' as const,
        } : {}),
      }]
    : hasSpellAttack
      ? [{
          id: 'spell-attack', kind: 'attack-roll', rollId: 'spell-attack-d20',
          attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
          rollMode: 'host-derived', scope: 'per-target',
        }]
      : undefined
  const stateCodes = (AUDITED_RULE_STATE_CODE_OVERRIDES[spell.id] ?? decision.slice(1))
    .filter((code) => !STRUCTURAL_DECISION_CODES.has(code))
  const durationKind = spell.duration.type === 'until-dispelled'
    ? 'permanent'
    : spell.duration.concentration
      ? 'concentration'
      : 'rounds'
  const concreteEffect = concreteAuditedEffect(spell)
  const choiceEffects = auditedChoiceEffects(spell)
  const spellSpecificEffects = divineWordEffects(spell)
  const choices = auditedModeChoices(spell)
  const directOperations = directAuditedOperations(spell)
  const unconditionalOperations = unconditionalAuditedOperations(spell)
  // Per-target checks are evaluated once for each candidate target. Their
  // successful/failed outcomes must therefore operate on that current target,
  // not fan back out over every creature originally submitted to the area.
  // Using `all-targets` here caused a single failed save to apply the effect to
  // creatures that had already succeeded (most visibly with Confusion).
  const checkedOutcomeTarget = auditedTarget.kind === 'self'
    ? 'actor' as const
    : checks?.some((check) => check.scope === 'per-target')
      ? 'target' as const
      : 'all-targets' as const
  const auditedRequirements: Dnd5eActivityDefinitionV1['requirements'] = spell.id === 'animal-friendship'
    ? [
        { kind: 'creature-type', subject: 'target', types: ['beast', '野兽'] },
        { kind: 'ability-score', subject: 'target', ability: 'int', comparison: 'below', value: 4 },
        { kind: 'can-hear-source' },
      ]
      : spell.id === 'telepathic-bond'
        ? [{ kind: 'ability-score', subject: 'target', ability: 'int', comparison: 'above', value: 2 }]
      : spell.id === 'feather-fall'
        ? [{ kind: 'airborne-state', subject: 'target', state: 'unsupported-airborne' }]
      : spell.id === 'enthrall'
        ? [{ kind: 'can-hear-source' }]
      : spell.id === 'simulacrum'
        ? [{ kind: 'creature-type', subject: 'target', types: ['beast', 'humanoid', '野兽', '类人生物'] }]
      : undefined
  const persistentAreaOperation = decision.includes('persistent-area') && base.target.kind === 'area' &&
    spell.id !== 'alarm' && spell.id !== 'forcecage' && spell.id !== 'magic-circle' &&
    spell.id !== 'faithful-hound'
    ? {
        id: 'create-persistent-area', kind: 'create-persistent-area' as const,
        label: spell.name,
        durationRounds: Math.min(5_256_000, auditedDurationRounds(spell)),
        concentration: spell.duration.concentration,
        color: '#7c3aed',
        ...(decision.includes('movement-blocking') && !decision.includes('typed-target') ? {
          blocking: { movement: true, lineOfEffect: true },
        } : {}),
        ...(decision.includes('sensor-blocking') ? {
          obscuration: { kind: 'heavy' as const },
        } : {}),
        ...auditedPersistentAreaExtension(spell),
      }
    : undefined
  const effectOperations: Dnd5eActivityDefinitionV1['outcomes'][number]['operations'] = [
    ...directOperations,
    ...(concreteEffect && spell.id !== 'light' && spell.id !== 'nondetection' ? [{
      id: 'apply-concrete-effect', kind: 'apply-effect' as const,
      target: spell.id === 'animal-friendship' ? 'target' as const : checkedOutcomeTarget,
      effectId: concreteEffect.id,
    }] : []),
    ...stateCodes.map((code, index) => ({
    id: `rule-state-${index + 1}`,
    kind: 'mechanic' as const,
    target: checkedOutcomeTarget,
    handlerId: 'core.rule-state',
    parameters: {
      'state-id': `spell:${spell.id}:${code}`,
      'duration-kind': durationKind,
      'duration-rounds': auditedDurationRounds(spell),
      stacking: 'replace',
      magical: true,
    },
    })),
  ]
  // Fire Storm's closed choice changes which area occupants are resolved; it
  // is consumed by the executor's Host-side target filter and must not create
  // a transient rule-state marker of its own.
  const choiceOutcomes: Dnd5eActivityDefinitionV1['outcomes'] = (spell.id === 'fire-storm'
    ? []
    : choices?.[0]?.options ?? []).map((option, index) => ({
    id: `mode-${option.id}`,
    when: checks?.length
      ? {
          kind: 'all' as const,
          conditions: [
            { kind: 'check' as const, checkId: checks[0]!.id, result: hasSpellAttack ? 'success' as const : 'failure' as const },
            { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
          ],
        }
      : { kind: 'choice' as const, choiceId: 'mode', optionId: option.id },
    // A choice that already applies a concrete Effect must not also emit an
    // inert rule-state marker: doing both makes coverage report a false
    // missing component. Extension conditions on that Effect (including
    // Contagion's Mindfire confused-turn behaviour) are consumed by the
    // authoritative ActiveEffect lifecycle.
    operations: [...(
      auditedChoiceOperations(spell, option.id).length > 0
      ? []
      :
      spell.id === 'fire-shield'
      || choiceEffects.some((effect) => effect.id === `${spell.id}-${option.id}`)
        ? []
        : [{
      id: `mode-state-${index + 1}`,
      kind: 'mechanic' as const,
      target: checkedOutcomeTarget,
      handlerId: 'core.rule-state',
      parameters: {
        'state-id': `spell:${spell.id}:mode:${option.id}`,
        'duration-kind': durationKind,
        'duration-rounds': auditedDurationRounds(spell),
        stacking: 'replace',
        magical: true,
      },
    }]), ...auditedChoiceOperations(spell, option.id), ...(choiceEffects.some((effect) => effect.id === `${spell.id}-${option.id}`) ? [{
      id: `apply-mode-effect-${index + 1}`,
      kind: 'apply-effect' as const,
      target: checkedOutcomeTarget,
      effectId: `${spell.id}-${option.id}`,
    }] : [])],
  }))
  return {
    ...base,
    target: auditedTarget,
    // The outer spell transaction owns reaction economy. Until a concrete
    // combat event supplies a reaction-window receipt, the map invokes the
    // spell explicitly and the Host still validates/spends the reaction.
    invocation: spell.castingTime.unit === 'reaction'
      ? { kind: 'active', confirmation: 'actor-choice' }
      : base.invocation,
    requirements: [...(base.requirements ?? []), ...(auditedRequirements ?? [])],
    checks,
    choices,
    effects: concreteEffect || choiceEffects.length || spellSpecificEffects.length
      ? [...(concreteEffect ? [concreteEffect] : []), ...choiceEffects, ...spellSpecificEffects]
      : undefined,
    scaling: spell.id === 'delayed-blast-fireball'
      ? [
          ...(base.scaling ?? []),
          {
            basis: 'slot-level', baseLevel: 7,
            adjustments: [{ operationId: 'create-persistent-area', diceCountPerStep: 1 }],
          },
        ]
      : spell.id === 'animal-friendship'
      ? [
          ...(base.scaling ?? []),
          {
            basis: 'slot-level', baseLevel: 1,
            adjustments: [{ operationId: 'apply-concrete-effect', additionalTargetsPerStep: 1 }],
          },
        ]
      : spell.id === 'branding-smite'
      ? [
          ...(base.scaling ?? []).filter((entry) =>
            !(entry.adjustments ?? []).some((adjustment) => adjustment.operationId === 'apply-concrete-effect')),
          {
            basis: 'slot-level', baseLevel: 2,
            adjustments: [{ operationId: 'apply-concrete-effect', diceCountPerStep: 1 }],
          },
        ]
      : spell.id === 'confusion'
        ? [
            ...(base.scaling ?? []),
            { basis: 'slot-level', baseLevel: 4, areaRadiusFeetPerStep: 5 },
          ]
      : base.scaling,
    outcomes: [
      ...(unconditionalOperations.length ? [{
        id: 'unconditional-results', when: { kind: 'always' as const },
        operations: unconditionalOperations,
      }] : []),
      ...(persistentAreaOperation ? [{
        id: 'persistent-area', when: { kind: 'always' as const }, operations: [persistentAreaOperation],
      }] : []),
      ...(effectOperations.length ? [{
        id: checks?.length ? 'check-failure' : 'resolved',
        when: checks?.length
          ? { kind: 'check' as const, checkId: checks[0]!.id, result: hasSpellAttack ? 'success' as const : 'failure' as const }
          : { kind: 'always' as const },
        operations: effectOperations,
      }] : []),
      ...choiceOutcomes,
      ...divineWordOutcomes(spell),
      ...(spell.id === 'fire-storm' && checks?.length ? [{
        id: 'save-success',
        when: { kind: 'check' as const, checkId: checks[0]!.id, result: 'success' as const },
        operations: [{
          ...directOperations[0] as Extract<typeof directOperations[number], { kind: 'damage' }>,
          id: 'fire-storm-damage-half',
          amount: {
            kind: 'floor' as const,
            value: {
              kind: 'multiply' as const,
              values: [
                (directOperations[0] as Extract<typeof directOperations[number], { kind: 'damage' }>).amount,
                { kind: 'constant' as const, value: 0.5 },
              ],
            },
          },
        }],
      }] : []),
    ],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

const partialSpells = Object.entries(decisions)
  .filter(([id, decision]) =>
    (decision[0] === 'partial' && id !== 'disguise-self' && id !== 'illusory-script' && id !== 'mirage-arcane') ||
    id === 'magic-mouth')
  .flatMap(([id]) => {
    const spell = pluginSpell(id)
    return spell ? [spell] : []
  })

const partialSpellById = new Map(partialSpells.map((spell) => [spell.id, spell]))

const manualSpells = Object.entries(decisions)
  .filter(([, decision]) => decision[0] === 'manual')
  .flatMap(([id]) => {
    const spell = pluginSpell(id)
    return spell ? [spell] : []
  })

const manualSpellById = new Map(manualSpells.map((spell) => [spell.id, spell]))

const fullSpells = Object.entries(decisions)
  .filter(([id, decision]) =>
    (decision[0] === 'full' && id !== 'magic-mouth') ||
    id === 'disguise-self' || id === 'illusory-script' || id === 'mirage-arcane')
  .flatMap(([id]) => {
    const spell = pluginSpell(id)
    return spell ? [spell] : []
  })

const fullSpellById = new Map(fullSpells.map((spell) => [spell.id, spell]))

export const DND5E_SRD_AUDITED_PARTIAL_SPELL_IDS = Object.freeze(partialSpells.map((spell) => spell.id))
export const DND5E_SRD_AUDITED_FULL_SPELL_IDS = Object.freeze(fullSpells.map((spell) => spell.id))
export const DND5E_SRD_AUDITED_MANUAL_SPELL_IDS = Object.freeze(manualSpells.map((spell) => spell.id))

export function dnd5eSrdAuditedPartialSpellDefinitionV1(
  spellId: string,
): RegisteredDnd5ePluginSpell | undefined {
  const spell = partialSpellById.get(spellId)
  return spell ? structuredClone(spell) : undefined
}

export function dnd5eSrdAuditedPartialSpellActivityV1(
  spellId: string,
): Dnd5eActivityDefinitionV1 | undefined {
  const spell = partialSpellById.get(spellId)
  return spell ? partialActivity(spell) : undefined
}

export function dnd5eSrdAuditedSpellDefinitionV1(
  spellId: string,
): RegisteredDnd5ePluginSpell | undefined {
  // Minor Illusion is stored as a rich override of the legacy core spell
  // entry, rather than in the audited partial-spell list. The executable
  // plugin transaction still needs the same structured spell definition;
  // without this bridge the live map can render/select the Activity but the
  // Host cannot prepare its owning cast transaction (and therefore cannot
  // authoritatively spend the action).
  const spell = fullSpellById.get(spellId) ?? partialSpellById.get(spellId) ??
    manualSpellById.get(spellId) ?? (spellId === 'minor-illusion' ? pluginSpell(spellId) : undefined)
  return spell ? structuredClone(spell) : undefined
}

export function dnd5eSrdAuditedSpellActivityV1(
  spellId: string,
): Dnd5eActivityDefinitionV1 | undefined {
  const full = fullSpellById.get(spellId)
  if (full) return fullActivity(full)
  const partial = partialSpellById.get(spellId)
  if (partial) return partialActivity(partial)
  const manual = manualSpellById.get(spellId)
  if (manual) return manualActivity(manual)
  const coreOverride = spellId === 'minor-illusion' ? pluginSpell(spellId) : undefined
  return coreOverride ? minorIllusionActivity(coreOverride) : undefined
}

/** Rich audited replacements for legacy core catalog placeholders. */
export function dnd5eSrdAuditedCoreOverrideSpellActivityV1(
  spellId: string,
): Dnd5eActivityDefinitionV1 | undefined {
  if (spellId !== 'minor-illusion') return undefined
  const spell = pluginSpell(spellId)
  return spell ? minorIllusionActivity(spell) : undefined
}

export function dnd5eSrdAuditedManualContentDefinitionsV1(): readonly RegisteredContentDefinition[] {
  return manualSpells.map((spell) => ({
    schemaVersion: 1,
    id: spell.id,
    namespace: DND5E_SRD_AUDITED_SPELL_PACKAGE_ID,
    version: DND5E_SRD_AUDITED_SPELL_PACKAGE_VERSION,
    kind: 'spell',
    name: spell.name,
    description: spell.description,
    source: {
      packageId: DND5E_SRD_AUDITED_SPELL_PACKAGE_ID,
      packageVersion: DND5E_SRD_AUDITED_SPELL_PACKAGE_VERSION,
    },
    payload: structuredClone(spell),
    activities: [manualActivity(spell)],
    automation: automationCapabilityFromLegacyStatus('partial', [
      '确定性施法资源由 Host 结算；法术答案包含显式 DM 裁定边界。',
    ]),
  }))
}

export function dnd5eSrdAuditedPartialContentDefinitionsV1(): readonly RegisteredContentDefinition[] {
  return partialSpells.map((spell) => ({
    schemaVersion: 1,
    id: spell.id,
    namespace: DND5E_SRD_AUDITED_SPELL_PACKAGE_ID,
    version: DND5E_SRD_AUDITED_SPELL_PACKAGE_VERSION,
    kind: 'spell',
    name: spell.name,
    description: spell.description,
    source: {
      packageId: DND5E_SRD_AUDITED_SPELL_PACKAGE_ID,
      packageVersion: DND5E_SRD_AUDITED_SPELL_PACKAGE_VERSION,
    },
    payload: structuredClone(spell),
    activities: [
      partialActivity(spell),
      ...(['contingency', 'shapechange', 'tree-stride', 'detect-magic', 'detect-thoughts', 'geas'].includes(spell.id)
        ? auditedTriggeredActivities(spell)
        : []),
    ],
    automation: automationCapabilityFromLegacyStatus('partial', [
      '该法术包含显式 DM 裁定边界。',
    ]),
  }))
}

export function dnd5eSrdAuditedFullContentDefinitionsV1(): readonly RegisteredContentDefinition[] {
  return fullSpells.map((spell) => ({
    schemaVersion: 1,
    id: spell.id,
    namespace: DND5E_SRD_AUDITED_SPELL_PACKAGE_ID,
    version: DND5E_SRD_AUDITED_SPELL_PACKAGE_VERSION,
    kind: 'spell',
    name: spell.name,
    description: spell.description,
    source: {
      packageId: DND5E_SRD_AUDITED_SPELL_PACKAGE_ID,
      packageVersion: DND5E_SRD_AUDITED_SPELL_PACKAGE_VERSION,
    },
    payload: structuredClone(spell),
    activities: [fullActivity(spell), ...auditedTriggeredActivities(spell)],
    automation: automationCapabilityFromLegacyStatus('full'),
  }))
}
