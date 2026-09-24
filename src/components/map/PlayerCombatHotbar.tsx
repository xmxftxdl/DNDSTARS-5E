import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Backpack, ChevronLeft, ChevronRight, LockKeyhole, PackageOpen, Sparkles, Swords, X } from 'lucide-react'
import type { Character } from '../../types/character'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'
import { useSpellbookStore } from '../../store/spellbook'
import { getClassResource } from '../../lib/classResources'
import {
  FIGHTER_RESOURCE_KEYS,
  dnd5eAvailableSpellModifierIntents,
  dnd5eCharacterClassLevel,
  dnd5eClassDefinitionForCharacter,
  dnd5eMartialSpellSynergyForCharacter,
  dnd5eMartialSpellBonusAttackAvailable,
  dnd5ePluginBonusWeaponAttackForCharacter,
  dnd5eRageFeatureForCharacter,
  dnd5eEffectiveSpellcastingSources,
  dnd5eEffectiveSpellSelections,
  dnd5eInventoryEntryIsActive,
  dnd5eFreeSpellCastSource,
  dnd5ePactSlotLevel,
  dnd5eSelectedSpellIdsForClass,
  dnd5eSpellModifierIntentDefinition,
  dnd5eSpellbookEntriesWithPlugins,
  dnd5eSpellbookEntryCastingTime,
  dnd5eSpellbookEntryDescription,
  dnd5eSpellbookEntryCanUseStructuredCastRoute,
  dnd5eSpellbookEntryHasFullHeadlessAutomation,
  dnd5eSpellUsesNarrativeResolution,
  dnd5eSpellSupportsNarrativeObjectAlternative,
  dnd5eActiveSustainedSpellControl,
  dnd5eFlameBladeManifestationControl,
  dnd5eActiveActionRestriction,
  dnd5eActiveHitPointMaximumBonus,
  dnd5eAvailableRestrictedExtraActionKinds,
  type Dnd5eActiveActionRestriction,
  getDnd5eSrdCombatSpell,
  getDnd5eSrdMonster,
  normalizeDnd5eInventory,
  registeredDnd5ePluginSpells,
  resolveDnd5eSpellModifierIntents,
  toggleDnd5eSpellModifierIntent,
  dnd5eWeaponAttackProfile,
  dnd5eWeaponPropertyIds,
  dnd5eActivityWeaponAttackGrantMatchesV1,
  fighterResourceState,
} from '../../rulesets/dnd5e'
import { dnd5ePluginSpellActivity } from '../../rulesets/dnd5e/pluginSpellTransaction'
import { dnd5ePluginSpellDefinition } from '../../rulesets/dnd5e/plugins/pluginContentCatalog'
import { dnd5eClassFeatureActionIcon, dnd5eItemActionIcon, dnd5eSpellActionIcon, dnd5eSystemActionIcon } from '../../lib/dnd5eActionIcons'
import {
  buildDnd5eCombatActionDescriptors,
  groupDnd5eCombatHotbarDescriptors,
  moveDnd5eCombatHotbarAction,
  reconcileDnd5eCombatHotbarPreference,
  resolveDnd5eCombatSpellSlotSelection,
  type Dnd5eCombatActionCommand,
  type Dnd5eCombatActionDescriptorV1,
  type Dnd5eCombatActionEconomy,
  type Dnd5eCombatActionFeatureSource,
  type Dnd5eCombatSpellModifier,
  type Dnd5eCombatActionSpellSource,
  type Dnd5eCombatActionTargeting,
  type Dnd5eCombatHotbarPreferenceV1,
} from '../../lib/dnd5eCombatActionDescriptors'
import Dnd5eActionIcon from './Dnd5eActionIcon'
import { dnd5eCombatSpellSlotSummary } from './combatSpellSlotSummary'
import EquipmentTab from '../character/EquipmentTab'
import {
  assignCombatItemQuickbarSlot,
  clearCombatItemQuickbarSlot,
  reconcileCombatItemQuickbarPreference,
  type CombatItemQuickbarPreferenceV1,
} from './combatItemQuickbar'
import { dnd5eCombatSpellDamagePreview } from './combatSpellDamagePresentation'
import PlayerQuickCharacterSheet from './PlayerQuickCharacterSheet'
import {
  dnd5eApplicableHotbarSpellModifiers,
  dnd5eHotbarPluginSpellModifierCompatibility,
  resolveDnd5eHotbarSpellCommand,
} from './playerCombatHotbarSpellCommand'

const STORAGE_PREFIX = 'dndstars5e:combat-hotbar:v1:'
const ITEM_QUICKBAR_STORAGE_PREFIX = 'dndstars5e:combat-item-quickbar:v1:'
const ITEM_BACKPACK_OPEN_PREFIX = 'dndstars5e:combat-backpack-open:v1:'
const EMPTY_ARMED_SPELL_MODIFIERS = new Set<Dnd5eCombatSpellModifier>()

// eslint-disable-next-line react-refresh/only-export-components
export function dnd5eHotbarActionRestrictionReason(
  entry: Dnd5eCombatActionDescriptorV1,
  restriction: Dnd5eActiveActionRestriction,
): string | undefined {
  if (entry.command.kind === 'select-move' || entry.command.kind === 'end-turn') return undefined
  const allowedDash = entry.command.kind === 'basic-action' && entry.command.action === 'dash' &&
    restriction.allowedBasicActions?.includes('dash')
  const allowedActivity = entry.command.kind === 'use-persistent-area-activity' &&
    restriction.allowedActivityIds?.some((activityId) => entry.id.endsWith(`:${activityId}`))
  if (allowedDash || allowedActivity) return undefined
  if (entry.command.kind === 'open-panel') {
    if (restriction.allowedBasicActions) return '当前形态只允许规则明确列出的动作。'
    if (entry.command.panel === 'inventory' && restriction.prohibited.includes('object-interaction')) {
      return '当前形态禁止使用或操作物品。'
    }
    return undefined
  }
  return entry.sourceKind === 'weapon' && restriction.prohibited.includes('attack')
    ? '当前形态禁止攻击。'
    : entry.sourceKind === 'spell' && restriction.prohibited.includes('spellcasting')
      ? '当前形态禁止施法。'
      : entry.sourceKind === 'item' && restriction.prohibited.includes('object-interaction')
        ? '当前形态禁止使用或操作物品。'
        : restriction.allowedBasicActions &&
          (entry.economy === 'action' || entry.economy === 'bonus-action' || entry.economy === 'reaction')
          ? '当前形态只允许规则明确列出的动作。'
          : undefined
}

const ECONOMY_LABELS: Record<Dnd5eCombatActionEconomy, string> = {
  action: '动作',
  'bonus-action': '附赠动作',
  reaction: '反应',
  movement: '移动',
  none: '无行动消耗',
  special: '长时/特殊施法',
}

const TARGETING_LABELS: Record<Dnd5eCombatActionTargeting, string> = {
  none: '无需目标',
  self: '自身',
  creature: '选择生物',
  area: '选择范围',
  'map-position': '选择地图位置',
  configure: '打开配置',
}

interface PlayerCombatHotbarProps {
  character: Character
  mapWeather?: import('../../rulesets/dnd5e/environmentRules').Dnd5eMapWeather
  mode?: 'combat' | 'exploration'
  canAct: boolean
  pending: boolean
  turnEconomy: {
    turnKey?: string
    usedOncePerTurnKeys?: readonly string[]
    action: { current: number; max?: number }
    bonusAction: { current: number; max?: number }
    movement: { current: number; max?: number }
  }
  activeActionId?: string
  grappleEscapes?: readonly {
    grapplerTokenId: string
    grapplerLabel: string
    dc?: number
  }[]
  movablePersistentAreas?: readonly {
    id: string
    label: string
     economy: 'action' | 'bonus-action' | 'none'
     maximumFeet: number
     destinationRangeFeet?: number
     coreSpellId?: string
  }[]
  sustainedAreaControls?: readonly {
    areaId: string
    spellId: string
    castingClassId: string
    slotLevel: number
    controlId: import('../../lib/sharedCombatTypes').Dnd5eSustainedSpellControlId
    label: string
    economy: 'action' | 'bonus-action' | 'none'
    targeting: 'area' | 'creature'
  }[]
  persistentAreaActivityControls?: readonly {
    areaId?: string
    effectId?: string
    featureId: string
    activityId: string
    label: string
    economy: 'action' | 'bonus-action' | 'reaction' | 'none'
    targeting: 'self' | 'creature' | 'area'
    oncePerTurnKeys?: readonly string[]
  }[]
  hunterMarkTransferAvailable?: boolean
  /**
   * Pending "next spell" modifiers are owned by the map casting session when
   * supplied. Keeping them above this hotbar prevents opening another dock or
   * remounting the hotbar from silently dropping Overchannel/Sculpt Spell.
   */
  armedSpellModifiers?: readonly Dnd5eCombatSpellModifier[]
  onArmedSpellModifiersChange?: (modifiers: readonly Dnd5eCombatSpellModifier[]) => void
  selectedSpellSlotLevels?: Readonly<Record<string, number>>
  /** Reaction spells whose authoritative trigger is currently open. */
  triggeredReactionSpellIds?: readonly string[]
  /** Allows only Host-triggered reaction spell descriptors while off turn. */
  canUseTriggeredReactions?: boolean
  onSelectedSpellSlotLevelChange?: (actionId: string, slotLevel: number) => void
  onCommand: (command: Dnd5eCombatActionCommand, descriptor: Dnd5eCombatActionDescriptorV1) => void
  onUnavailable?: (descriptor: Dnd5eCombatActionDescriptorV1) => void
}

function spellEconomy(value: ReturnType<typeof dnd5eSpellbookEntryCastingTime>): Dnd5eCombatActionEconomy {
  if (value === 'bonus-action') return 'bonus-action'
  if (value === 'reaction') return 'reaction'
  if (value === 'action') return 'action'
  return 'special'
}

// eslint-disable-next-line react-refresh/only-export-components
export function dnd5eHotbarSpellTargeting(
  spell: ReturnType<typeof getDnd5eSrdCombatSpell>,
  activity?: ReturnType<typeof dnd5ePluginSpellActivity>,
  spellbookId?: string,
): Dnd5eCombatActionTargeting {
  // Voice-narrative object, environment and conversation spells do not have a
  // VTT target. Never expose a legacy creature/map picker for them.
  if (dnd5eSpellUsesNarrativeResolution(spellbookId ?? spell?.id, activity)) return 'none'
  if (spell?.area || spell?.target === 'area') return 'area'
  if (spell?.rangeFeet === 0 && spell.target === 'ally') return 'self'
  if (spell) return 'creature'
  if (activity?.target.kind === 'area') {
    return activity.target.maximumTargets === 1 && activity.target.origin === 'point'
      ? 'map-position'
      : 'area'
  }
  if (activity?.target.kind === 'self') return 'self'
  if (activity?.target.kind === 'creature') return 'creature'
  return 'configure'
}

/**
 * Preserve explicit upcast intent: a primary click never silently chooses a
 * higher slot, but it should expose the slot picker when the currently pinned
 * or printed slot is unavailable and another legal slot exists.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function dnd5eHotbarSpellFallbackConfigurationLevel(
  entry: Dnd5eCombatActionDescriptorV1,
  configuredSlotLevel?: number,
): number | undefined {
  if (entry.command.kind !== 'cast-spell' || !entry.enabled) return undefined
  const availableLevels = entry.availableSlotLevels ?? []
  if (availableLevels.length < 1) return undefined
  const currentLevel = configuredSlotLevel ?? entry.command.slotLevel
  return availableLevels.includes(currentLevel) ? undefined : availableLevels[0]
}

/** Resolve the slot level shown by the compact direct-cast tooltip. */
// eslint-disable-next-line react-refresh/only-export-components
export function dnd5eHotbarSpellTooltipLevel(
  entry: Dnd5eCombatActionDescriptorV1 | undefined,
  configuredSlotLevel?: number,
): number | undefined {
  if (entry?.sourceKind !== 'spell') return undefined
  return entry.command.kind === 'cast-spell'
    ? configuredSlotLevel ?? entry.command.slotLevel
    : entry.resource?.current
}

function readPreference(characterId: string): Dnd5eCombatHotbarPreferenceV1 | undefined {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}${characterId}`) ?? 'null') as Partial<Dnd5eCombatHotbarPreferenceV1> | null
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.actionIds)) return undefined
    return {
      schemaVersion: 1,
      actionIds: parsed.actionIds.filter((id): id is string => typeof id === 'string'),
      activePage: Number.isFinite(parsed.activePage) ? Math.max(0, Math.floor(parsed.activePage!)) : 0,
    }
  } catch {
    return undefined
  }
}

function savePreference(characterId: string, preference: Dnd5eCombatHotbarPreferenceV1) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${characterId}`, JSON.stringify(preference))
  } catch {
    // 浏览器禁用或清理本地存储时，快捷栏仍可使用默认顺序。
  }
}

function readItemQuickbarPreference(characterId: string): CombatItemQuickbarPreferenceV1 | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(`${ITEM_QUICKBAR_STORAGE_PREFIX}${characterId}`) ?? 'null',
    ) as Partial<CombatItemQuickbarPreferenceV1> | null
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.slots)) return undefined
    return {
      schemaVersion: 1,
      slots: parsed.slots.map((instanceId) => typeof instanceId === 'string' ? instanceId : null),
    }
  } catch {
    return undefined
  }
}

function saveItemQuickbarPreference(
  characterId: string,
  preference: CombatItemQuickbarPreferenceV1,
) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `${ITEM_QUICKBAR_STORAGE_PREFIX}${characterId}`,
      JSON.stringify(preference),
    )
  } catch {
    // 本地存储不可用时仅失去快捷槽偏好，权威库存数据不受影响。
  }
}

function readBackpackOpen(characterId: string): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(`${ITEM_BACKPACK_OPEN_PREFIX}${characterId}`) === '1'
}

export default function PlayerCombatHotbar({
  character,
  mapWeather,
  mode = 'combat',
  canAct,
  pending,
  turnEconomy,
  activeActionId,
  grappleEscapes = [],
  movablePersistentAreas = [],
  sustainedAreaControls = [],
  persistentAreaActivityControls = [],
  hunterMarkTransferAvailable = false,
  armedSpellModifiers: controlledArmedSpellModifiers,
  onArmedSpellModifiersChange,
  selectedSpellSlotLevels,
  triggeredReactionSpellIds = [],
  canUseTriggeredReactions = false,
  onSelectedSpellSlotLevelChange,
  onCommand,
  onUnavailable,
}: PlayerCombatHotbarProps) {
  const [activeCategory, setActiveCategory] = useState<'basics' | 'spells' | 'features' | 'items'>('basics')
  const exploration = mode === 'exploration'
  const actionRemaining = turnEconomy.action.current
  const bonusActionRemaining = turnEconomy.bonusAction.current
  const movementRemaining = turnEconomy.movement.current
  const importedSpells = useSpellbookStore((state) => state.spells)
  const spellSlots = useMemo(() => dnd5eCombatSpellSlotSummary(character), [character])
  const inventory = useMemo(() => normalizeDnd5eInventory(character), [character])
  const spellSlotLabel = spellSlots.map((slot) => `${slot.label} ${slot.current}/${slot.max}`).join('，')
  const spellModifierIntents = useMemo(
    () => dnd5eAvailableSpellModifierIntents(character),
    [character],
  )
  const primaryClassId = dnd5eClassDefinitionForCharacter(character)?.id ?? 'fighter'
  const activeCreatureForm = character.dnd5eCombatState?.wildShapeFormId
    ? getDnd5eSrdMonster(character.dnd5eCombatState.wildShapeFormId)
    : undefined
  const spellCreatureForm = !!activeCreatureForm &&
    (character.dnd5eCombatState?.wildShapeMode === 'polymorph' ||
      character.dnd5eCombatState?.wildShapeMode === 'true-polymorph' ||
      character.dnd5eCombatState?.wildShapeMode === 'animal-shapes')
  const shapechangeEquipmentDisposition = character.dnd5eCombatState?.wildShapeMode === 'shapechange'
    ? character.dnd5eCombatState.shapechangeEquipmentDisposition
    : undefined
  const creatureFormEquipmentUnavailable = spellCreatureForm ||
    (!!activeCreatureForm && character.dnd5eCombatState?.wildShapeMode === 'shapechange' &&
      shapechangeEquipmentDisposition !== 'wear')
  const activeCreatureFormLabel = character.dnd5eCombatState?.wildShapeMode === 'true-polymorph'
    ? '完全变形术'
    : character.dnd5eCombatState?.wildShapeMode === 'polymorph'
    ? '变形术'
    : character.dnd5eCombatState?.wildShapeMode === 'animal-shapes'
      ? '动物形态'
      : character.dnd5eCombatState?.wildShapeMode === 'shapechange'
        ? '形体变化'
        : '荒野形态'
  const [armedSpellModifierState, setArmedSpellModifierState] = useState<{
    characterId: string
    ids: Set<Dnd5eCombatSpellModifier>
  }>(() => ({ characterId: character.id, ids: new Set() }))
  const armedSpellModifiers = useMemo(() => controlledArmedSpellModifiers != null
    ? new Set(controlledArmedSpellModifiers)
    : armedSpellModifierState.characterId === character.id
      ? armedSpellModifierState.ids
      : EMPTY_ARMED_SPELL_MODIFIERS,
  [armedSpellModifierState, character.id, controlledArmedSpellModifiers])
  const commitArmedSpellModifiers = useCallback((next: Set<Dnd5eCombatSpellModifier>) => {
    if (onArmedSpellModifiersChange) {
      onArmedSpellModifiersChange([...next])
      return
    }
    setArmedSpellModifierState({ characterId: character.id, ids: next })
  }, [character.id, onArmedSpellModifiersChange])
  const descriptors = useMemo(() => {
    const spellbookById = new Map(dnd5eSpellbookEntriesWithPlugins(importedSpells, registeredDnd5ePluginSpells()).map((spell) => [spell.id, spell]))
    const spellSources: Dnd5eCombatActionSpellSource[] = []
    const sustainedControlSources: Dnd5eCombatActionFeatureSource[] = []
    const sustainedControlKeys = new Set<string>()
    for (const source of dnd5eEffectiveSpellcastingSources(character)) {
      const definition = source.definition
      if (!definition.spellcasting) continue
      for (const spellId of dnd5eSelectedSpellIdsForClass(character, source.classId)) {
        const entry = spellbookById.get(spellId)
        if (!entry) continue
        const narrativeSpell = dnd5eSpellUsesNarrativeResolution(
          entry.id,
          dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition(entry.id)),
        )
        const fullHeadless = !narrativeSpell && dnd5eSpellbookEntryHasFullHeadlessAutomation(entry)
        const structuredCastRoute = !narrativeSpell && dnd5eSpellbookEntryCanUseStructuredCastRoute(entry)
        const combat = getDnd5eSrdCombatSpell(spellId)
        const pluginActivity = dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition(entry.id))
        const imported = entry.imported
        const baseCastingTime = spellEconomy(dnd5eSpellbookEntryCastingTime(entry))
        const classLevel = source.classLevel
        const classSelections = dnd5eEffectiveSpellSelections(character, source)
        const freeBaseCast = entry.level > 0
          ? dnd5eFreeSpellCastSource({
              classId: definition.id,
              level: classLevel,
              classSelections,
              classResources: character.classResources ?? {},
            }, { id: spellId, level: entry.level }, entry.level)
          : undefined
        const pactLevel = definition.spellcasting.kind === 'pact' ? dnd5ePactSlotLevel(classLevel) : undefined
        const resourceSlotLevels = entry.level === 0
          ? [0]
          : pactLevel != null
            ? (pactLevel >= entry.level && (getClassResource(character, 'dnd5e-pact-slot')?.current ?? 0) > 0 ? [pactLevel] : [])
            : Array.from({ length: 9 - entry.level + 1 }, (_, index) => entry.level + index)
                .filter((level) => (getClassResource(character, `dnd5e-spell-slot-${level}`)?.current ?? 0) > 0)
        const availableSlotLevels = [...new Set([
          ...(freeBaseCast ? [entry.level] : []),
          ...resourceSlotLevels,
        ])].sort((left, right) => left - right)
        const ritualAvailable = (entry.imported?.ritual === true || entry.reference?.ritual === true) &&
          definition.spellcasting.ritualCasting === true && entry.level > 0
        const defaultSlotLevel = entry.level === 0
          ? 0
          : pactLevel != null
            ? pactLevel
            : entry.level
        const modifierResolution = availableSlotLevels[0] != null
          ? resolveDnd5eSpellModifierIntents({
              character,
              castingClassId: definition.id,
              spellId,
              slotLevel: availableSlotLevels[0],
              modifierIds: [...armedSpellModifiers],
              pluginSpell: dnd5eHotbarPluginSpellModifierCompatibility(spellId),
            })
          : undefined
        const castingTime = modifierResolution?.ok && modifierResolution.effectiveEconomy === 'bonus-action'
          ? 'bonus-action'
          : baseCastingTime
        const reactionTriggerOpen = castingTime === 'reaction' && triggeredReactionSpellIds.includes(spellId)
        const declaredCastingTime = dnd5eSpellbookEntryCastingTime(entry)
        const supportedCastingTime = (castingTime !== 'reaction' || reactionTriggerOpen) &&
          (declaredCastingTime !== 'unsupported' || exploration)
        spellSources.push({
          id: spellId,
          label: entry.name,
          description: dnd5eSpellbookEntryDescription(entry) || '点击直接施放；需要的规则选项会在施放流程中询问。',
          icon: dnd5eSpellActionIcon({
            id: spellId,
            name: entry.name,
            englishName: entry.englishName,
            level: entry.level,
            school: combat?.school ?? imported?.school ?? entry.reference?.school,
            effect: combat?.effect ?? imported?.mechanics?.resolution,
            damageType: combat?.damageType ?? imported?.mechanics?.damage?.type,
            tags: imported?.tags,
            castingClassId: definition.id,
            iconAssetId: entry.iconAssetId,
          }),
          level: entry.level,
          castingTime,
          targeting: dnd5eHotbarSpellTargeting(combat, pluginActivity, entry.id),
          castingClassId: definition.id,
          defaultSlotLevel,
          availableSlotLevels,
          ritualAvailable,
          available: supportedCastingTime && (availableSlotLevels.length > 0 || ritualAvailable),
          unavailableReason: castingTime === 'reaction' && !reactionTriggerOpen
            ? '反应法术会在对应触发发生时询问。'
            : !supportedCastingTime
              ? '该法术的施法时间不适用于战斗动作。'
              : ritualAvailable
                ? '没有普通施法位；仍可右键请求仪式施法。'
                : '没有可用于施放该法术的法术位。',
        })
        const sustainedControl = combat && (fullHeadless || structuredCastRoute)
          ? dnd5eActiveSustainedSpellControl(character, combat)
          : undefined
        if (sustainedControl && combat) {
          const sustainedControlKey = `${combat.id}:${sustainedControl.id}`
          if (sustainedControlKeys.has(sustainedControlKey)) continue
          sustainedControlKeys.add(sustainedControlKey)
          sustainedControlSources.push({
            id: `sustained-spell:${combat.id}:${sustainedControl.id}`,
            label: sustainedControl.label,
            description: sustainedControl.description,
            icon: dnd5eSpellActionIcon({
              id: combat.id,
              name: combat.name,
              englishName: combat.englishName,
              level: combat.level,
              school: combat.school,
              effect: combat.effect,
              damageType: combat.damageType,
              castingClassId: definition.id,
              iconAssetId: entry.iconAssetId,
            }),
            economy: sustainedControl.economy,
            targeting: sustainedControl.targeting,
            command: sustainedControl.id === 'expeditious-retreat'
              ? {
                  kind: 'basic-action',
                  action: 'dash',
                  sourceSpellId: 'expeditious-retreat',
                }
              : {
                  kind: 'cast-spell',
                  spellId: combat.id,
                  castingClassId: definition.id,
                  slotLevel: sustainedControl.slotLevel,
                  sustainedEffectAttack: sustainedControl.id,
                },
          })
        }
        const flameBladeManifestation = combat && (fullHeadless || structuredCastRoute)
          ? dnd5eFlameBladeManifestationControl(character, combat)
          : undefined
        if (flameBladeManifestation && combat) {
          const controlKey = `${combat.id}:manifestation`
          if (!sustainedControlKeys.has(controlKey)) {
            sustainedControlKeys.add(controlKey)
            sustainedControlSources.push({
              id: `sustained-spell:${combat.id}:manifestation`,
              label: flameBladeManifestation.label,
              description: flameBladeManifestation.description,
              icon: dnd5eSpellActionIcon({
                id: combat.id,
                name: combat.name,
                englishName: combat.englishName,
                level: combat.level,
                school: combat.school,
                effect: combat.effect,
                damageType: combat.damageType,
                castingClassId: definition.id,
                iconAssetId: entry.iconAssetId,
              }),
              economy: flameBladeManifestation.economy,
              targeting: 'none',
              command: {
                kind: 'set-flame-blade-manifestation',
                effectId: flameBladeManifestation.effectId,
                manifested: !flameBladeManifestation.manifested,
              },
            })
          }
        }
      }
    }
    const featureSources: Dnd5eCombatActionFeatureSource[] = spellModifierIntents.map(({
      definition,
      available,
      unavailableReason,
      resource,
    }) => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      icon: dnd5eClassFeatureActionIcon({
        id: definition.id,
        name: definition.label,
        classId: definition.source.classId ?? primaryClassId,
      }),
      modifier: definition.id,
      resource,
      available,
      unavailableReason,
    }))
    const fighterLevel = dnd5eCharacterClassLevel(character, 'fighter')
    if (fighterLevel >= 1) {
      const secondWind = fighterResourceState({
        level: fighterLevel,
        classResources: character.classResources,
      }, FIGHTER_RESOURCE_KEYS.secondWind)
      const secondWindUnavailableReason = secondWind.current < 1
        ? '回气次数已耗尽；完成短休或长休后恢复。'
        : character.currentHp <= 0
          ? '生命值为 0 时不能使用回气。'
          : character.currentHp >= character.maxHp
            ? '生命值已满，不需要使用回气。'
            : undefined
      featureSources.push({
        id: 'fighter-second-wind',
        label: '回气',
        description: `以附赠动作恢复 1d10＋${fighterLevel} 点生命值；投骰与资源消耗由 Headless 结算。`,
        icon: dnd5eClassFeatureActionIcon({ id: 'second-wind', name: '回气', classId: 'fighter' }),
        economy: 'bonus-action',
        targeting: 'self',
        resource: { label: '次数', current: secondWind.current, maximum: secondWind.max },
        available: secondWindUnavailableReason == null,
        unavailableReason: secondWindUnavailableReason,
        command: { kind: 'use-fighter-feature', feature: 'second-wind' },
      })
    }
    if (fighterLevel >= 2) {
      const actionSurge = fighterResourceState({
        level: fighterLevel,
        classResources: character.classResources,
      }, FIGHTER_RESOURCE_KEYS.actionSurge)
      const alreadyUsedThisTurn = (turnEconomy.action.max ?? 1) > 1
      const actionSurgeUnavailableReason = actionSurge.current < 1
        ? '动作如潮次数已耗尽；完成短休或长休后恢复。'
        : alreadyUsedThisTurn
          ? '同一回合只能使用一次动作如潮。'
          : undefined
      featureSources.push({
        id: 'fighter-action-surge',
        label: '动作如潮',
        description: '不消耗动作或附赠动作，本回合额外获得一个动作；资源与同回合限制由 Headless 复核。',
        icon: dnd5eClassFeatureActionIcon({ id: 'action-surge', name: '动作如潮', classId: 'fighter' }),
        economy: 'none',
        targeting: 'self',
        resource: { label: '次数', current: actionSurge.current, maximum: actionSurge.max },
        available: actionSurgeUnavailableReason == null,
        unavailableReason: actionSurgeUnavailableReason,
        command: { kind: 'use-fighter-feature', feature: 'action-surge' },
      })
    }
    featureSources.unshift(...sustainedControlSources)
    if (hunterMarkTransferAvailable) {
      featureSources.unshift({
        id: 'sustained-spell:hunters-mark-transfer',
        label: '转移猎人印记',
        description: '附赠动作 · 原目标降至 0 生命后，打开目标列表选择新的猎物；不消耗法术位。',
        icon: dnd5eSpellActionIcon({ id: 'hunters-mark', name: '猎人印记' }),
        economy: 'bonus-action',
        targeting: 'configure',
        command: { kind: 'open-panel', panel: 'features', focusId: 'ranger-move-hunters-mark' },
      })
    }
    featureSources.unshift(...sustainedAreaControls.map((control) => ({
      id: `sustained-spell:${control.areaId}:${control.controlId}`,
      label: control.label,
      description: `${control.economy === 'bonus-action' ? '附赠动作' : '动作'} · 操控地图上的现有法术实体，不消耗法术位。`,
      icon: dnd5eSpellActionIcon({ id: control.spellId, name: control.label }),
      economy: control.economy,
      targeting: control.targeting,
      command: {
        kind: 'cast-spell' as const,
        spellId: control.spellId,
        castingClassId: control.castingClassId,
        slotLevel: control.slotLevel,
        sustainedEffectAttack: control.controlId,
        sustainedEffectAreaId: control.areaId,
      },
    })))
    featureSources.unshift(...persistentAreaActivityControls.map((control) => ({
      id: `granted-activity:${control.areaId ?? control.effectId}:${control.activityId}`,
      label: control.label,
      description: `由${control.areaId ? '地图持续区域' : '当前持续效果'}授予；${control.economy === 'bonus-action' ? '附赠动作' : control.economy === 'action' ? '动作' : control.economy === 'reaction' ? '反应' : '不消耗行动'}，来源结束后按钮自动移除。`,
      icon: dnd5eSpellActionIcon({ id: control.activityId, name: control.label }),
      economy: control.economy,
      targeting: control.targeting,
      available: !control.oncePerTurnKeys?.some((key) =>
        turnEconomy.usedOncePerTurnKeys?.includes(key)),
      unavailableReason: control.oncePerTurnKeys?.some((key) =>
        turnEconomy.usedOncePerTurnKeys?.includes(key))
        ? '同一回合只能使用一次。'
        : undefined,
      command: {
        kind: 'use-persistent-area-activity' as const,
        areaId: control.areaId,
        effectId: control.effectId,
        featureId: control.featureId,
      },
    })))
    featureSources.unshift(...movablePersistentAreas.map((area) => ({
      id: `persistent-area-move:${area.id}`,
      label: area.coreSpellId === 'major-image' ? '改变高等幻影位置' : `移动${area.label}`,
      description: area.coreSpellId === 'major-image' && area.destinationRangeFeet != null
        ? `动作 · 将地图上的现有高等幻影移到施法者 ${area.destinationRangeFeet} 尺内的任意新位置；不消耗法术位，也不会重新施法。`
        : `${area.economy === 'none' ? '不消耗行动' : area.economy === 'bonus-action' ? '以附赠动作' : '以动作'}在地图上选择新位置，至多移动 ${area.maximumFeet} 尺；落点、路径和撞击效果仍由 Headless 校验。`,
      icon: dnd5eSpellActionIcon({
        id: area.coreSpellId ?? area.id,
        name: area.label,
      }),
      economy: area.economy,
      targeting: 'map-position' as const,
      resource: area.coreSpellId === 'major-image' && area.destinationRangeFeet != null
        ? { label: '射程', current: area.destinationRangeFeet }
        : { label: '尺', current: area.maximumFeet },
      command: { kind: 'move-persistent-area' as const, areaId: area.id },
    })))
    const turnKey = turnEconomy.turnKey ?? ''
    const mainWeaponId = character.equipment?.mainWeapon?.id
    const mainWeaponProfile = dnd5eWeaponAttackProfile(character)
    const activityWeaponProfiles = [
      ...(mainWeaponProfile ? [{ slot: 'main-hand' as const, profile: mainWeaponProfile }] : []),
      ...(() => {
        const profile = dnd5eWeaponAttackProfile(character, { weaponSlot: 'offHand' })
        return profile ? [{ slot: 'off-hand' as const, profile }] : []
      })(),
    ]
    const activityWeaponAttackGrants = Object.values(
      character.dnd5eCombatState?.activityWeaponAttackGrants ?? {},
    ).flatMap((grant) => activityWeaponProfiles.flatMap(({ slot, profile }) =>
      dnd5eActivityWeaponAttackGrantMatchesV1(grant, turnKey, {
        weaponId: profile.weaponId,
        baseWeaponId: profile.baseWeaponId,
        mode: profile.mode,
        weaponProperties: dnd5eWeaponPropertyIds(profile.properties),
        proficient: profile.proficient,
      }, slot) ? [{ grant, slot, profile }] : []))
    const genericBonusWeaponAttack = dnd5ePluginBonusWeaponAttackForCharacter(character, turnKey)
    if (mainWeaponProfile && genericBonusWeaponAttack) {
      featureSources.push({
        id: `generic-bonus-weapon-attack:${genericBonusWeaponAttack.id}`,
        label: genericBonusWeaponAttack.name,
        description: '完成攻击动作后，以附赠动作进行一次武器攻击；次数、装备、目标、距离与命中均由 Host 校验。',
        icon: dnd5eClassFeatureActionIcon({
          id: genericBonusWeaponAttack.id,
          name: genericBonusWeaponAttack.name,
          classId: genericBonusWeaponAttack.sourceClassId ?? primaryClassId,
        }),
        economy: 'bonus-action',
        targeting: 'creature',
        command: {
          kind: 'select-weapon-target',
          options: { featureBonusWeaponAttackId: genericBonusWeaponAttack.id },
        },
      })
    }
    featureSources.push(...activityWeaponAttackGrants.map(({ grant, slot, profile }) => ({
      id: `activity-weapon-attack:${grant.grantId}:${slot}`,
      label: `${grant.label} · ${profile.weaponName}`,
      description: '由统一 Activity 触发；点击后选择目标，Host 会重新校验当前主手武器、距离、命中与附赠动作。',
      icon: dnd5eClassFeatureActionIcon({
        id: grant.sourceActivityId,
        name: grant.label,
        classId: primaryClassId,
      }),
      economy: 'bonus-action' as const,
      targeting: 'creature' as const,
      command: {
        kind: 'select-weapon-target' as const,
        options: {
          activityWeaponAttackGrantId: grant.grantId,
          activityWeaponAttackWeaponSlot: slot,
        },
      },
    })))
    if (
      dnd5eWeaponAttackProfile(character) &&
      dnd5eMartialSpellBonusAttackAvailable(character, turnKey)
    ) {
      featureSources.push({
        id: 'martial-spell-synergy-cantrip-then-bonus-attack-attack',
        label: '特性附赠武器攻击',
        description: '施法已开启本回合的一次附赠动作武器攻击；目标、距离和命中仍由 Host 校验。',
        icon: dnd5eClassFeatureActionIcon({
          id: 'martial-spell-synergy-cantrip-then-bonus-attack',
          name: '特性附赠武器攻击',
          classId: primaryClassId,
        }),
        economy: 'bonus-action',
        targeting: 'creature',
        command: {
          kind: 'select-weapon-target',
          options: { featureBonusWeaponAttack: true },
        },
      })
    }
    if (
      mainWeaponId &&
      dnd5eMartialSpellSynergyForCharacter(character, 'linked-equipment') &&
      character.dnd5eCombatState?.linkedEquipmentIds?.includes(mainWeaponId)
    ) {
      featureSources.push({
        id: 'linked-equipment-recall',
        label: '召回联结武器',
        description: `以附赠动作召回${character.equipment?.mainWeapon?.name ?? '当前主武器'}。`,
        icon: dnd5eClassFeatureActionIcon({
          id: 'martial-spell-synergy-linked-equipment',
          name: '召回联结武器',
          classId: primaryClassId,
        }),
        economy: 'bonus-action',
        targeting: 'self',
        command: {
          kind: 'use-class-feature',
          payload: {
            feature: 'linked-equipment-recall',
            weaponId: mainWeaponId,
          },
        },
      })
    }
    if (
      dnd5eMartialSpellSynergyForCharacter(character, 'extra-action-teleport') &&
      character.dnd5eCombatState?.extraActionTeleportTurnKey === turnKey &&
      character.dnd5eCombatState?.extraActionTeleportUsedTurnKey !== turnKey
    ) {
      featureSources.push({
        id: 'feature-extra-action-teleport',
        label: '额外动作传送',
        description: '动作如潮已开启；在地图选择 30 尺内未占据落点。',
        icon: dnd5eClassFeatureActionIcon({
          id: 'feature-extra-action-teleport',
          name: '额外动作传送',
          classId: primaryClassId,
        }),
        economy: 'none',
        targeting: 'map-position',
        command: { kind: 'select-extra-action-teleport-destination' },
      })
    }
    const wearingHeavyArmor =
      character.equipment?.armor?.dnd5e?.kind === 'armor' &&
      character.equipment.armor.dnd5e.category === 'heavy'
    if (dnd5eRageFeatureForCharacter(character, 'rage-mobile-defense')) {
      featureSources.push({
        id: 'rage-feature-eagle-dash',
        label: '狂暴特性疾走',
        description: '狂暴期间以附赠动作获得一份等同步行速度的本回合移动。',
        icon: dnd5eClassFeatureActionIcon({
          id: 'rage-feature-eagle-dash',
          name: '狂暴特性疾走',
          classId: 'barbarian',
        }),
        economy: 'bonus-action',
        targeting: 'self',
        available: character.dnd5eCombatState?.raging === true && !wearingHeavyArmor,
        unavailableReason: wearingHeavyArmor
          ? '穿着重甲时不能使用。'
          : '需要先进入狂暴。',
        command: {
          kind: 'use-class-feature',
          payload: { feature: 'feature-rage-bonus-dash' },
        },
      })
    }
    const wolfTargets =
      character.dnd5eCombatState?.bonusProneEligibleTargetIds ?? []
    if (
      dnd5eRageFeatureForCharacter(character, 'bonus-prone-on-hit') &&
      wolfTargets.length > 0
    ) {
      featureSources.push({
        id: 'rage-feature-wolf-knockdown',
        label: '狂暴特性击倒',
        description: wolfTargets.length === 1
          ? '以附赠动作击倒本回合已被近战命中的合格目标。'
          : '本回合有多个合格目标；打开职业特性面板选择其中一个。',
        icon: dnd5eClassFeatureActionIcon({
          id: 'rage-feature-wolf-knockdown',
          name: '狂暴特性击倒',
          classId: 'barbarian',
        }),
        economy: 'bonus-action',
        targeting: wolfTargets.length === 1 ? 'creature' : 'configure',
        command: wolfTargets.length === 1
          ? {
              kind: 'use-class-feature',
              payload: {
                feature: 'feature-rage-bonus-prone',
                targetTokenId: wolfTargets[0],
              },
            }
          : { kind: 'open-panel', panel: 'features' },
      })
    }
    const itemSources = inventory.entries.flatMap((entry) => {
      if (entry.item.useActions?.length) {
        const active = dnd5eInventoryEntryIsActive(entry)
        return entry.item.useActions.map((use) => {
          const spell = use.effect.kind === 'spell-cast'
            ? getDnd5eSrdCombatSpell(use.effect.spellId)
            : undefined
          const reactionOnly = spell?.castingTime === 'reaction'
          const resource = use.resourceCost
            ? entry.resources?.[use.resourceCost.resourceId]
            : Object.values(entry.resources ?? {})[0]
          const targeting: Dnd5eCombatActionTargeting = use.targeting?.kind === 'map-area'
            ? 'area'
            : use.targeting?.kind === 'creature'
              ? 'creature'
              : 'self'
          const enoughResource = !use.resourceCost || (resource?.current ?? 0) >= use.resourceCost.amount
          return {
            instanceId: entry.instanceId,
            useActionId: use.id,
            label: entry.identified === false ? '未鉴定魔法物品' : `${entry.item.name} · ${use.label}`,
            description: entry.identified === false ? '该物品尚未鉴定，不能在战斗中使用。' : entry.item.rulesText,
            icon: dnd5eItemActionIcon(entry.item),
            economy: use.economy === 'bonusAction' ? 'bonus-action' as const : use.economy === 'action' ? 'action' as const : 'none' as const,
            targeting,
            quantity: entry.quantity,
            resource: resource ? { label: resource.label, current: resource.current, maximum: resource.maximum } : undefined,
            usable: active && entry.quantity > 0 && enoughResource && !reactionOnly,
            unavailableReason: entry.identified === false
              ? '魔法物品尚未鉴定。'
              : !active
                ? '需要先完成同调。'
                : reactionOnly
                  ? '满足触发条件时由战斗反应窗口使用。'
                  : !enoughResource ? `${resource?.label ?? '资源'}不足。` : undefined,
          }
        })
      }
      if (!entry.item.use) return []
      const resource = Object.values(entry.resources ?? {})[0]
      const active = dnd5eInventoryEntryIsActive(entry)
      const spell = entry.item.use.effect.kind === 'spell-cast'
        ? getDnd5eSrdCombatSpell(entry.item.use.effect.spellId)
        : undefined
      const reactionOnly = spell?.castingTime === 'reaction'
      const targeting: Dnd5eCombatActionTargeting = entry.item.use.targeting?.kind === 'map-area'
        ? 'area'
        : entry.item.use.targeting?.kind === 'creature'
          ? 'creature'
          : 'self'
      return [{
        instanceId: entry.instanceId,
        label: entry.identified === false ? '未鉴定魔法物品' : entry.item.name,
        description: entry.identified === false ? '该物品尚未鉴定，不能在战斗中使用。' : entry.item.rulesText,
        icon: dnd5eItemActionIcon(entry.item),
        economy: entry.item.use.economy === 'bonusAction' ? 'bonus-action' as const : entry.item.use.economy === 'action' ? 'action' as const : 'none' as const,
        targeting,
        quantity: entry.quantity,
        resource: resource ? { label: resource.label, current: resource.current, maximum: resource.maximum } : undefined,
        usable: active && entry.quantity > 0 && (!resource || resource.current > 0) && !reactionOnly,
        unavailableReason: entry.identified === false
          ? '魔法物品尚未鉴定。'
          : !active
            ? '需要先完成同调。'
            : reactionOnly
              ? '满足触发条件时由战斗反应窗口使用。'
              : resource?.current === 0 ? `${resource.label}已经耗尽。` : undefined,
      }]
    })
    const reactionOnly = !canAct && canUseTriggeredReactions && triggeredReactionSpellIds.length > 0
    const restrictedExtraActionKinds = dnd5eAvailableRestrictedExtraActionKinds({
      effects: character.dnd5eCombatState?.activeEffects,
      usesByEffect: character.dnd5eCombatState?.restrictedExtraActionUsesByEffect,
      turnKey: turnEconomy.turnKey,
    })
    const built = buildDnd5eCombatActionDescriptors({
      canAct: canAct || reactionOnly,
      pending,
      actionRemaining,
      bonusActionRemaining,
      movementRemaining,
      restrictedExtraActionKinds,
      weaponLabel: mainWeaponProfile?.weaponName ?? character.equipment?.mainWeapon?.name,
      grappleEscapes,
      spells: spellSources,
      features: featureSources,
      items: itemSources,
    })
    const creatureFormAttacks: Dnd5eCombatActionDescriptorV1[] = activeCreatureForm?.actions.flatMap((formAction, actionIndex) => {
      if (formAction.kind !== 'weapon-attack' && formAction.kind !== 'multiattack') return []
      const enabled = !pending && canAct && (
        actionRemaining > 0 || restrictedExtraActionKinds.includes('weapon-attack')
      )
      return [{
        schemaVersion: 1,
        id: `creature-form:${activeCreatureForm.id}:attack:${actionIndex}`,
        sourceKind: 'weapon',
        label: `${activeCreatureForm.name}：${formAction.name}`,
        description: formAction.description,
        icon: dnd5eSystemActionIcon(
          `creature-form:${activeCreatureForm.id}:${formAction.id}`,
          'monster-attack',
        ),
        economy: 'action',
        targeting: 'creature',
        enabled,
        disabledReason: enabled
          ? undefined
          : pending
            ? '正在等待 DM 结算上一项操作。'
            : !canAct
              ? '当前不是该角色的可行动回合。'
              : '本回合动作已用尽。',
        command: {
          kind: 'select-weapon-target',
          options: { wildShapeActionIndex: actionIndex },
        },
      }]
    }) ?? []
    const builtWithCreatureFormAttacks = activeCreatureForm
      ? [...built, ...creatureFormAttacks]
      : built
    const authorizedBuilt = reactionOnly
      ? builtWithCreatureFormAttacks.map((entry) => {
          const triggeredSpell = entry.sourceKind === 'spell' &&
            triggeredReactionSpellIds.some((spellId) => entry.id.endsWith(`:${spellId}`))
          return triggeredSpell ? entry : {
            ...entry,
            enabled: false,
            disabledReason: '当前只开放已触发的反应法术。',
          }
        })
      : builtWithCreatureFormAttacks
    const formAuthorizedBuilt = spellCreatureForm || creatureFormEquipmentUnavailable
      ? authorizedBuilt.map((entry) => {
          if (
            entry.command.kind === 'select-weapon-target' &&
            entry.command.options?.wildShapeActionIndex != null
          ) return entry
          if (!spellCreatureForm && entry.sourceKind !== 'weapon' && entry.sourceKind !== 'item') return entry
          if (entry.sourceKind === 'system') return entry
          const disabledReason = entry.sourceKind === 'weapon'
            ? shapechangeEquipmentDisposition === 'drop'
              ? '本体武器已掉落在形体变化的施法位置；请使用当前形态动作。'
              : '本体武器已融入法术形态；请使用基础动作栏中的当前形态攻击。'
            : entry.sourceKind === 'item'
              ? shapechangeEquipmentDisposition === 'drop'
                ? '装备与道具已掉落在形体变化的施法位置，当前不能启动、使用、持握或受益。'
                : '装备与道具已融入法术形态，当前不能启动、使用、持握或受益。'
              : entry.sourceKind === 'spell'
                ? '变形术或动物形态期间不能施法。'
                : '法术形态会替换本体游戏数据，当前不能使用本体职业特性。'
          return { ...entry, enabled: false, disabledReason }
        })
      : authorizedBuilt
    const explorationAuthorizedBuilt = !exploration
      ? formAuthorizedBuilt
      : formAuthorizedBuilt.filter((entry) =>
          entry.id !== 'feature:sustained-spell:expeditious-retreat:expeditious-retreat'
        ).map((entry) => {
          // 可执行的道具在探索状态下仍应沿用 use-item 权威链路。此前这里把药水等
          // 全部降级成“打开背包”，导致快捷槽只能查看，不能真正使用。
          if (entry.sourceKind === 'item') return entry
          if (
            entry.sourceKind === 'feature' &&
            !entry.id.startsWith('feature:sustained-spell:') &&
            !entry.id.startsWith('feature:persistent-area-move:') &&
            !entry.id.startsWith('feature:persistent-area-activity:') &&
            entry.command.kind !== 'use-persistent-area-activity' &&
            entry.command.kind !== 'open-panel' &&
            entry.command.kind !== 'toggle-spell-modifier'
          ) return {
            ...entry,
            enabled: true,
            disabledReason: undefined,
            command: { kind: 'open-panel' as const, panel: 'features' as const, focusId: entry.id },
          }
          if (entry.sourceKind !== 'system' && entry.sourceKind !== 'weapon') return entry
          return {
            ...entry,
            enabled: false,
            disabledReason: '基础动作只能在战斗中、轮到自己时使用。',
          }
        })
    const actionRestriction = dnd5eActiveActionRestriction(character.dnd5eCombatState?.activeEffects)
    if (!actionRestriction) return explorationAuthorizedBuilt
    return explorationAuthorizedBuilt.map((entry) => {
      const prohibitedReason = dnd5eHotbarActionRestrictionReason(entry, actionRestriction)
      return prohibitedReason ? { ...entry, enabled: false, disabledReason: prohibitedReason } : entry
    })
  }, [
    actionRemaining,
    activeCreatureForm,
    armedSpellModifiers,
    bonusActionRemaining,
    canAct,
    canUseTriggeredReactions,
    character,
    exploration,
    grappleEscapes,
    importedSpells,
    inventory,
    hunterMarkTransferAvailable,
    movablePersistentAreas,
    movementRemaining,
    pending,
    primaryClassId,
    spellModifierIntents,
    spellCreatureForm,
    sustainedAreaControls,
    persistentAreaActivityControls,
    creatureFormEquipmentUnavailable,
    shapechangeEquipmentDisposition,
    turnEconomy.action.max,
    turnEconomy.turnKey,
    turnEconomy.usedOncePerTurnKeys,
    triggeredReactionSpellIds,
  ])

  const [storedPreference, setPreference] = useState<Dnd5eCombatHotbarPreferenceV1>(() =>
    reconcileDnd5eCombatHotbarPreference(readPreference(character.id), descriptors),
  )
  const quickbarCandidateIds = useMemo(() => {
    const usable = inventory.entries
      .filter((entry) => !!entry.item.use || !!entry.item.useActions?.length)
      .map((entry) => entry.instanceId)
    const remaining = inventory.entries
      .filter((entry) => !entry.item.use && !entry.item.useActions?.length)
      .map((entry) => entry.instanceId)
    return [...usable, ...remaining]
  }, [inventory.entries])
  const [itemQuickbarStoredPreference, setItemQuickbarPreference] = useState<CombatItemQuickbarPreferenceV1>(
    () => reconcileCombatItemQuickbarPreference(
      readItemQuickbarPreference(character.id),
      quickbarCandidateIds,
    ),
  )
  const [draggedActionId, setDraggedActionId] = useState<string | null>(null)
  const [draggedItemInstanceId, setDraggedItemInstanceId] = useState<string | null>(null)
  const [backpackOpen, setBackpackOpen] = useState(() => readBackpackOpen(character.id))
  const [quickCharacterOpen, setQuickCharacterOpen] = useState(false)
  const setBackpackVisible = useCallback((open: boolean) => {
    setBackpackOpen(open)
    if (typeof window === 'undefined') return
    const key = `${ITEM_BACKPACK_OPEN_PREFIX}${character.id}`
    if (open) window.sessionStorage.setItem(key, '1')
    else window.sessionStorage.removeItem(key)
  }, [character.id])
  const [spellConfiguration, setSpellConfiguration] = useState<{
    entry: Dnd5eCombatActionDescriptorV1
    slotLevel: number
  } | null>(null)
  const [localSelectedSpellSlotLevels, setLocalSelectedSpellSlotLevels] = useState<
    Record<string, number>
  >({})
  const effectiveSelectedSpellSlotLevels =
    selectedSpellSlotLevels ?? localSelectedSpellSlotLevels
  const [tooltip, setTooltip] = useState<{
    entry: Dnd5eCombatActionDescriptorV1
    left: number
    top: number
  } | null>(null)
  const suppressClickAfterDragRef = useRef(false)
  const preference = useMemo(
    () => reconcileDnd5eCombatHotbarPreference(storedPreference, descriptors),
    [descriptors, storedPreference],
  )
  const itemQuickbarPreference = useMemo(
    () => reconcileCombatItemQuickbarPreference(itemQuickbarStoredPreference, quickbarCandidateIds),
    [itemQuickbarStoredPreference, quickbarCandidateIds],
  )

  useEffect(() => savePreference(character.id, preference), [character.id, preference])
  useEffect(
    () => saveItemQuickbarPreference(character.id, itemQuickbarPreference),
    [character.id, itemQuickbarPreference],
  )

  const orderedDescriptors = useMemo(() => {
    const byId = new Map(descriptors.map((entry) => [entry.id, entry]))
    return preference.actionIds.flatMap((id) => {
      const entry = byId.get(id)
      return entry ? [entry] : []
    })
  }, [descriptors, preference.actionIds])
  const grouped = useMemo(() => groupDnd5eCombatHotbarDescriptors(orderedDescriptors), [orderedDescriptors])
  const spellRailRef = useRef<HTMLDivElement>(null)
  const [spellPageSize, setSpellPageSize] = useState(1)
  useLayoutEffect(() => {
    const rail = spellRailRef.current
    if (!rail) return
    const measure = () => {
      if (rail.clientWidth <= 0) return
      const card = rail.firstElementChild as HTMLElement | null
      const width = card?.offsetWidth ?? 72
      const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0
      if (width <= 0) return
      const capacity = Math.max(1, Math.floor((rail.clientWidth + gap) / (width + gap)))
      setSpellPageSize(previous => previous === capacity ? previous : capacity)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    if (rail.firstElementChild) observer.observe(rail.firstElementChild)
    measure()
    return () => observer.disconnect()
  }, [grouped.spells.length])
  const spellPageCount = Math.max(1, Math.ceil(grouped.spells.length / spellPageSize))
  const activeSpellPage = Math.min(spellPageCount - 1, preference.activePage)
  const visibleSpells = grouped.spells.slice(activeSpellPage * spellPageSize, (activeSpellPage + 1) * spellPageSize)
  const inventoryEntryById = useMemo(
    () => new Map(inventory.entries.map((entry) => [entry.instanceId, entry])),
    [inventory.entries],
  )
  const itemDescriptorByInstanceId = useMemo(() => {
    const byInstanceId = new Map<string, Dnd5eCombatActionDescriptorV1>()
    for (const descriptor of grouped.items) {
      if (descriptor.command.kind === 'use-item') {
        if (!byInstanceId.has(descriptor.command.instanceId)) {
          byInstanceId.set(descriptor.command.instanceId, descriptor)
        }
      }
    }
    return byInstanceId
  }, [grouped.items])
  const activate = useCallback((entry: Dnd5eCombatActionDescriptorV1, configuredSlotLevel?: number) => {
    if (
      entry.command.kind === 'cast-spell' &&
      configuredSlotLevel != null &&
      !(entry.availableSlotLevels ?? []).includes(configuredSlotLevel)
    ) {
      onUnavailable?.({
        ...entry,
        enabled: false,
        disabledReason: `${configuredSlotLevel} 环位已耗尽或当前不可用；请右键重新固定施法环位。`,
      })
      return
    }
    if (!entry.enabled) {
      onUnavailable?.(entry)
      return
    }
    if (entry.command.kind === 'toggle-spell-modifier') {
      const modifier = entry.command.modifier
      commitArmedSpellModifiers(toggleDnd5eSpellModifierIntent(armedSpellModifiers, modifier))
      return
    }
    if (entry.command.kind === 'cast-spell') {
      const slotSelection = resolveDnd5eCombatSpellSlotSelection(entry, configuredSlotLevel)
      if (!slotSelection.ok) {
        onUnavailable?.({
          ...entry,
          enabled: false,
          disabledReason: slotSelection.reason,
        })
        return
      }
      const slotLevel = slotSelection.slotLevel
      let resolvedCommand: ReturnType<typeof resolveDnd5eHotbarSpellCommand>
      try {
        resolvedCommand = resolveDnd5eHotbarSpellCommand(
          character,
          entry.command,
          slotLevel,
          [...armedSpellModifiers],
        )
      } catch (error: unknown) {
        onUnavailable?.({
          ...entry,
          enabled: false,
          disabledReason: error instanceof Error
            ? `建立施法命令失败：${error.message}`
            : '建立施法命令失败。',
        })
        return
      }
      if (!resolvedCommand.ok) {
        onUnavailable?.({
          ...entry,
          enabled: false,
          disabledReason: resolvedCommand.reasons.join('；'),
        })
        return
      }
      onCommand(resolvedCommand.command, entry)
      commitArmedSpellModifiers(new Set())
      setSpellConfiguration(null)
      return
    }
    onCommand(entry.command, entry)
  }, [armedSpellModifiers, character, commitArmedSpellModifiers, onCommand, onUnavailable])

  const activateRitual = useCallback((entry: Dnd5eCombatActionDescriptorV1) => {
    if (entry.command.kind !== 'cast-spell' || entry.ritualAvailable !== true) return
    if (!entry.enabled) {
      onUnavailable?.(entry)
      return
    }
    onCommand({
      ...entry.command,
      options: { ritual: true },
    }, entry)
    commitArmedSpellModifiers(new Set())
    setSpellConfiguration(null)
  }, [commitArmedSpellModifiers, onCommand, onUnavailable])

  const activateNarrativeObject = useCallback((
    entry: Dnd5eCombatActionDescriptorV1,
    slotLevel: number,
  ) => {
    if (
      entry.command.kind !== 'cast-spell' ||
      !dnd5eSpellSupportsNarrativeObjectAlternative(entry.command.spellId)
    ) return
    const slotSelection = resolveDnd5eCombatSpellSlotSelection(entry, slotLevel)
    if (!entry.enabled || !slotSelection.ok) {
      onUnavailable?.({
        ...entry,
        enabled: false,
        disabledReason: slotSelection.ok
          ? entry.disabledReason
          : slotSelection.reason,
      })
      return
    }
    onCommand({
      ...entry.command,
      slotLevel: slotSelection.slotLevel,
      options: { narrativeObject: true },
    }, entry)
    commitArmedSpellModifiers(new Set())
    setSpellConfiguration(null)
  }, [commitArmedSpellModifiers, onCommand, onUnavailable])

  const pinSpellSlotLevel = useCallback((actionId: string, slotLevel: number) => {
    if (onSelectedSpellSlotLevelChange) {
      onSelectedSpellSlotLevelChange(actionId, slotLevel)
    } else {
      setLocalSelectedSpellSlotLevels((current) => ({ ...current, [actionId]: slotLevel }))
    }
    setSpellConfiguration(null)
  }, [onSelectedSpellSlotLevelChange])

  useEffect(() => {
    if (!spellConfiguration && !backpackOpen && !quickCharacterOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSpellConfiguration(null)
      if (event.key === 'Escape') setBackpackVisible(false)
      if (event.key === 'Escape') setQuickCharacterOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [backpackOpen, quickCharacterOpen, setBackpackVisible, spellConfiguration])

  const spellConfigurationResolution = useMemo(() => {
    if (!spellConfiguration || spellConfiguration.entry.command.kind !== 'cast-spell') return undefined
    const applicableModifiers = dnd5eApplicableHotbarSpellModifiers(
      character,
      spellConfiguration.entry.command,
      spellConfiguration.slotLevel,
      [...armedSpellModifiers],
    )
    return resolveDnd5eSpellModifierIntents({
      character,
      castingClassId: spellConfiguration.entry.command.castingClassId as Parameters<typeof resolveDnd5eSpellModifierIntents>[0]['castingClassId'],
      spellId: spellConfiguration.entry.command.spellId,
      slotLevel: spellConfiguration.slotLevel,
      modifierIds: applicableModifiers,
      pluginSpell: dnd5eHotbarPluginSpellModifierCompatibility(
        spellConfiguration.entry.command.spellId,
      ),
    })
  }, [armedSpellModifiers, character, spellConfiguration])

  const setSpellPage = (page: number) => setPreference((current) => ({ ...current, activePage: Math.min(spellPageCount - 1, Math.max(0, page)) }))

  const moveAction = (sourceId: string, targetId: string) => {
    setPreference((current) => {
      const reconciled = reconcileDnd5eCombatHotbarPreference(current, descriptors)
      return { ...reconciled, actionIds: moveDnd5eCombatHotbarAction(reconciled.actionIds, sourceId, targetId) }
    })
  }

  const showTooltip = (entry: Dnd5eCombatActionDescriptorV1, target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    const hotbarTop = target.closest<HTMLElement>('[data-testid="player-combat-hotbar"]')
      ?.getBoundingClientRect().top ?? rect.top
    setTooltip({
      entry,
      left: Math.max(128, Math.min(window.innerWidth - 128, rect.left + rect.width / 2)),
      top: hotbarTop - 8,
    })
  }

  const hideTooltip = (actionId: string) => {
    setTooltip((current) => current?.entry.id === actionId ? null : current)
  }

  const actionButton = (entry: Dnd5eCombatActionDescriptorV1) => {
    const resourceBadge = entry.sourceKind === 'spell'
      ? undefined
      : entry.resource
        ? entry.resource.maximum != null ? `${entry.resource.current}/${entry.resource.maximum}` : entry.resource.current
        : undefined
    const pinnedSpellSlotLevel = entry.command.kind === 'cast-spell'
      ? effectiveSelectedSpellSlotLevels[entry.id]
      : undefined
    const spellLevel = entry.sourceKind === 'spell'
      ? pinnedSpellSlotLevel ?? entry.resource?.current
      : undefined
    const damagePreview = entry.command.kind === 'cast-spell'
      ? dnd5eCombatSpellDamagePreview(
          character,
          entry.command.castingClassId,
          entry.command.spellId,
          pinnedSpellSlotLevel ?? entry.command.slotLevel,
          { weather: mapWeather },
        )
      : undefined
    const modifierActive = entry.command.kind === 'toggle-spell-modifier' &&
      armedSpellModifiers.has(entry.command.modifier)
    return <button
      key={entry.id}
      type="button"
      data-action-id={entry.id}
      data-command-kind={entry.command.kind}
      draggable
      onDragStart={() => {
        suppressClickAfterDragRef.current = true
        setDraggedActionId(entry.id)
      }}
      onDragEnd={() => {
        setDraggedActionId(null)
        window.setTimeout(() => { suppressClickAfterDragRef.current = false }, 0)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => {
        if (draggedActionId) moveAction(draggedActionId, entry.id)
        setDraggedActionId(null)
      }}
      onClick={() => {
        if (suppressClickAfterDragRef.current) return
        const fallbackSlotLevel = dnd5eHotbarSpellFallbackConfigurationLevel(entry, pinnedSpellSlotLevel)
        if (fallbackSlotLevel != null) {
          setTooltip(null)
          setSpellConfiguration({ entry, slotLevel: fallbackSlotLevel })
          return
        }
        activate(entry, pinnedSpellSlotLevel)
      }}
      onContextMenu={(event) => {
        if (entry.command.kind !== 'cast-spell') return
        event.preventDefault()
        event.stopPropagation()
        const availableLevels = entry.availableSlotLevels ?? []
        if (availableLevels.length < 1 && entry.ritualAvailable !== true) {
          onUnavailable?.(entry)
          return
        }
        setTooltip(null)
        setSpellConfiguration({
          entry,
          slotLevel: pinnedSpellSlotLevel != null && availableLevels.includes(pinnedSpellSlotLevel)
            ? pinnedSpellSlotLevel
            : availableLevels[0] ?? entry.command.slotLevel,
        })
      }}
      onMouseEnter={(event) => showTooltip(entry, event.currentTarget)}
      onMouseLeave={() => hideTooltip(entry.id)}
      onFocus={(event) => showTooltip(entry, event.currentTarget)}
      onBlur={() => hideTooltip(entry.id)}
      aria-label={entry.label}
      aria-pressed={entry.command.kind === 'toggle-spell-modifier' ? modifierActive : undefined}
      aria-disabled={!entry.enabled}
      title={entry.command.kind === 'cast-spell'
        ? entry.enabled ? [
            entry.label,
            pinnedSpellSlotLevel == null
              ? `${entry.command.slotLevel === 0 ? '戏法' : `${entry.command.slotLevel}环`}（默认）`
              : `${pinnedSpellSlotLevel === 0 ? '戏法' : `${pinnedSpellSlotLevel}环`}（已固定）`,
            damagePreview?.summary,
          ].filter(Boolean).join('\n') : `${entry.label}\n${entry.disabledReason ?? '当前不能施法。'}`
        : entry.disabledReason}
      data-spell-slot-level={entry.command.kind === 'cast-spell'
        ? pinnedSpellSlotLevel ?? entry.command.slotLevel
        : undefined}
      data-spell-slot-locked={entry.command.kind === 'cast-spell' && pinnedSpellSlotLevel != null
        ? 'true'
        : undefined}
      aria-describedby={tooltip?.entry.id === entry.id ? 'combat-hotbar-action-tooltip' : undefined}
      className={`combat-hotbar-labeled-action group relative flex h-20 w-[4.5rem] flex-col gap-1 shrink-0 snap-start items-center justify-center rounded-lg border p-1 transition ${entry.id === 'system:end-turn' ? 'border-amber-300/35 bg-amber-400/10' : activeActionId === entry.id || modifierActive ? 'border-amber-300/70 bg-amber-400/15 shadow-[0_0_14px_rgba(251,191,36,0.28)]' : entry.enabled ? 'border-white/10 bg-white/[0.035] hover:border-violet-300/50 hover:bg-violet-500/10' : 'cursor-not-allowed border-white/[0.045] bg-black/20'}`}
    >
      <Dnd5eActionIcon spec={entry.icon} level={spellLevel} active={activeActionId === entry.id || modifierActive} disabled={!entry.enabled} badge={resourceBadge} className="h-11 w-11" />
      <span className={`w-full truncate text-center text-xs leading-4 ${entry.enabled ? 'text-slate-100' : 'text-slate-400'}`}>{entry.label.replace(/^攻击：/, '').replace('更多主动动作', '更多动作').replace('更多附赠动作', '附赠动作')}</span>
      {modifierActive ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-amber-100/70 bg-amber-400 px-1 text-[9px] font-black text-void-950">✓</span> : null}
      {!entry.enabled ? <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/60 p-0.5"><LockKeyhole className="h-3 w-3 text-slate-300/75" /></span> : null}
    </button>
  }

  const assignItemToQuickbar = (instanceId: string, slotIndex: number) => {
    setItemQuickbarPreference((current) => {
      const reconciled = reconcileCombatItemQuickbarPreference(current, quickbarCandidateIds)
      return {
        schemaVersion: 1,
        slots: assignCombatItemQuickbarSlot(reconciled.slots, instanceId, slotIndex),
      }
    })
  }

  const clearItemQuickbarSlot = (slotIndex: number) => {
    setItemQuickbarPreference((current) => {
      const reconciled = reconcileCombatItemQuickbarPreference(current, quickbarCandidateIds)
      return {
        schemaVersion: 1,
        slots: clearCombatItemQuickbarSlot(reconciled.slots, slotIndex),
      }
    })
  }

  const useBackpackItem = (instanceId: string, useActionId?: string): boolean => {
    const descriptor = useActionId
      ? grouped.items.find((candidate) => candidate.command.kind === 'use-item' && candidate.command.instanceId === instanceId && candidate.command.useActionId === useActionId)
      : itemDescriptorByInstanceId.get(instanceId)
    if (!descriptor) return false
    if (!descriptor.enabled) {
      onUnavailable?.(descriptor)
      return false
    }
    activate(descriptor)
    setBackpackVisible(false)
    return true
  }

  const quickbarItemButton = (instanceId: string | null, slotIndex: number) => {
    const entry = instanceId ? inventoryEntryById.get(instanceId) : undefined
    const descriptor = entry ? itemDescriptorByInstanceId.get(entry.instanceId) : undefined
    const primaryResource = entry ? Object.values(entry.resources ?? {})[0] : undefined
    if (!entry) {
      return (
        <button
          key={`empty-quick-item-${slotIndex}`}
          type="button"
          data-testid={`combat-item-quick-slot-${slotIndex + 1}`}
          aria-label={`道具快捷槽 ${slotIndex + 1}：空`}
          onClick={() => setBackpackVisible(true)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggedItemInstanceId) assignItemToQuickbar(draggedItemInstanceId, slotIndex)
            setDraggedItemInstanceId(null)
          }}
          className="relative h-16 w-16 shrink-0 rounded-lg border border-dashed border-amber-200/[0.1] bg-black/10 hover:border-amber-200/25 hover:bg-amber-400/[0.06]"
        >
          <span className="text-[9px] font-black text-amber-100/25">{slotIndex + 1}</span>
        </button>
      )
    }

    const directlyUsable = !!descriptor
    return (
      <button
        key={entry.instanceId}
        type="button"
        draggable
        data-testid={`combat-item-quick-slot-${slotIndex + 1}`}
        aria-label={`${entry.item.name}${directlyUsable ? '' : '（打开背包查看）'}`}
        aria-disabled={descriptor ? !descriptor.enabled : undefined}
        data-command-kind={descriptor?.command.kind}
        title={directlyUsable
          ? `${entry.item.name}\n${descriptor.description}${(entry.item.useActions?.length ?? 0) > 1 ? '\n右键打开背包，选择其他法术或升环档位。' : ''}`
          : `${entry.item.name}\n该物品没有可直接执行的战斗使用动作，点击查看背包详情。`}
        onDragStart={() => {
          suppressClickAfterDragRef.current = true
          setDraggedItemInstanceId(entry.instanceId)
        }}
        onDragEnd={() => {
          setDraggedItemInstanceId(null)
          window.setTimeout(() => { suppressClickAfterDragRef.current = false }, 0)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (draggedItemInstanceId) assignItemToQuickbar(draggedItemInstanceId, slotIndex)
          setDraggedItemInstanceId(null)
        }}
        onClick={() => {
          if (suppressClickAfterDragRef.current) return
          if (descriptor) activate(descriptor)
          else setBackpackVisible(true)
        }}
        onContextMenu={(event) => {
          if ((entry.item.useActions?.length ?? 0) < 2) return
          event.preventDefault()
          event.stopPropagation()
          setBackpackVisible(true)
        }}
        className={[
          'group relative h-16 w-16 shrink-0 rounded-lg border p-px transition',
          descriptor && activeActionId === descriptor.id
            ? 'border-amber-300/70 bg-amber-400/15 shadow-[0_0_14px_rgba(251,191,36,0.28)]'
            : descriptor?.enabled
              ? 'border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-amber-500/10'
              : 'border-white/[0.06] bg-black/20 hover:border-white/15',
        ].join(' ')}
      >
        <Dnd5eActionIcon
          spec={dnd5eItemActionIcon(entry.item)}
          active={descriptor ? activeActionId === descriptor.id : false}
          disabled={entry.identified === false || (!!descriptor && !descriptor.enabled)}
          badge={primaryResource
            ? primaryResource.current
            : entry.quantity > 1
              ? entry.quantity
              : undefined}
          className="w-full"
        />
        <span className="absolute left-0.5 top-0 text-[8px] font-black text-amber-100/65">
          {slotIndex + 1}
        </span>
        {directlyUsable ? (
          <span className="absolute inset-x-1 bottom-0.5 rounded bg-black/75 px-0.5 text-[7px] font-semibold text-slate-300">
            {descriptor?.enabled ? '使用' : creatureFormEquipmentUnavailable
              ? shapechangeEquipmentDisposition === 'drop' ? '掉落' : '融入'
              : '不可用'}
          </span>
        ) : (
          <span className="absolute inset-x-1 bottom-0.5 rounded bg-black/75 px-0.5 text-[7px] font-semibold text-slate-300">
            查看
          </span>
        )}
        {descriptor && !descriptor.enabled ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
            <LockKeyhole className="h-4 w-4 text-slate-300/75 drop-shadow" />
          </span>
        ) : null}
      </button>
    )
  }

  const tooltipSpellSlotLevel = dnd5eHotbarSpellTooltipLevel(
    tooltip?.entry,
    tooltip ? effectiveSelectedSpellSlotLevels[tooltip.entry.id] : undefined,
  )
  const tooltipSpellDamage = tooltip?.entry.command.kind === 'cast-spell' &&
    tooltipSpellSlotLevel != null
    ? dnd5eCombatSpellDamagePreview(
        character,
        tooltip.entry.command.castingClassId,
        tooltip.entry.command.spellId,
        tooltipSpellSlotLevel,
        { weather: mapWeather },
      )
    : undefined
  const tooltipSpellSlotLocked = tooltip?.entry.command.kind === 'cast-spell' &&
    effectiveSelectedSpellSlotLevels[tooltip.entry.id] != null
  const portrait = resolveMapTokenPortrait(character)
  const hotbarCurrentHp = activeCreatureForm
    ? character.dnd5eCombatState?.wildShapeCurrentHp ?? activeCreatureForm.hitPoints.average
    : character.currentHp
  const hotbarMaximumHp = activeCreatureForm?.hitPoints.average ??
    character.maxHp + dnd5eActiveHitPointMaximumBonus(character.dnd5eCombatState?.activeEffects)
  const hpPercentage = Math.max(0, Math.min(100, hotbarMaximumHp > 0 ? hotbarCurrentHp / hotbarMaximumHp * 100 : 0))
  const restrictedExtraActionKinds = dnd5eAvailableRestrictedExtraActionKinds({
    effects: character.dnd5eCombatState?.activeEffects,
    usesByEffect: character.dnd5eCombatState?.restrictedExtraActionUsesByEffect,
    turnKey: turnEconomy.turnKey,
  })
  const endTurnAction = grouped.basics.find((entry) => entry.command.kind === 'end-turn')
  const shownCategory = activeCategory === 'spells' && grouped.spells.length === 0 ? 'basics' : activeCategory

  return (<>
    <section
      data-testid="player-combat-hotbar"
      data-mode={mode}
      data-action-remaining={actionRemaining}
      data-bonus-action-remaining={bonusActionRemaining}
      data-movement-remaining={movementRemaining}
      style={{ zoom: 1.035 }}
      className="pointer-events-auto flex max-h-[32vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-xl border border-amber-200/20 bg-gradient-to-b from-[#171712]/95 to-[#090a0d]/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 pb-1">
        <button type="button" data-testid="combat-hotbar-character-portrait" aria-label={`快速查看${character.name}的人物卡`} title="快速查看人物卡" onClick={() => setQuickCharacterOpen(true)} className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-amber-200/55">
          {portrait ? <img src={portrait} alt={`${character.name}的战斗头像`} className="h-full w-full object-cover" /> : <span className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-2xl ${character.accent}`}>{character.avatar}</span>}
        </button>
        <div className="w-24 shrink-0">
          <div className="truncate text-xs font-semibold text-slate-100" title={activeCreatureForm ? `${activeCreatureForm.name} · ${activeCreatureFormLabel}` : character.name}>{activeCreatureForm?.name ?? character.name}</div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/70"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${hpPercentage}%` }} /></div>
          <div className="mt-0.5 text-xs tabular-nums text-slate-300">生命 <span>{hotbarCurrentHp}/{hotbarMaximumHp}</span></div>
        </div>
        <div data-testid="combat-hotbar-turn-summary" role="status" className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs">
          {exploration ? <span className="rounded bg-violet-400/10 px-2 py-1 text-violet-200">探索中</span> : <>
            <span className={`rounded px-2 py-1 ${actionRemaining > 0 ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/5 text-slate-300'}`}>{actionRemaining > 0 ? `动作 ${actionRemaining}` : '动作已用完'}</span>
            <span className={`rounded px-2 py-1 ${bonusActionRemaining > 0 ? 'bg-sky-400/15 text-sky-200' : 'bg-white/5 text-slate-300'}`}>{bonusActionRemaining > 0 ? `附赠动作 ${bonusActionRemaining}` : '附赠动作已用完'}</span>
            <span className="rounded bg-amber-400/15 px-2 py-1 text-amber-200">剩余移动 {movementRemaining} 尺</span>
            {restrictedExtraActionKinds.length > 0 && <span data-testid="combat-hotbar-restricted-extra-action" className="rounded bg-cyan-400/15 px-2 py-1 text-cyan-200" title="可再执行一次武器攻击、疾走、撤离或躲藏">加速动作 1</span>}
          </>}
          {pending ? <span className="text-amber-200">正在结算上一项操作…</span> : !canAct && !exploration ? <span className="text-slate-300">等待自己的回合</span> : null}
        </div>
        {endTurnAction && <button type="button" data-testid="combat-hotbar-end-turn" disabled={!endTurnAction.enabled} title={endTurnAction.disabledReason} onClick={() => activate(endTurnAction)} className="shrink-0 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-40">结束回合</button>}
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-1">
          <div role="tablist" aria-label="角色能力分类" className="flex shrink-0 gap-1">
            {([
              { id: 'basics', label: '基础动作', count: grouped.basics.filter((entry) => entry.command.kind !== 'end-turn').length, icon: Swords },
              { id: 'spells', label: '法术', count: grouped.spells.length, icon: Sparkles },
              { id: 'features', label: '职业特性', count: grouped.features.length, icon: Swords },
              { id: 'items', label: '道具', count: inventory.entries.length, icon: PackageOpen },
            ] as const).filter((category) => category.id !== 'spells' || category.count > 0).map((category) => <button key={category.id} type="button" role="tab" id={`hotbar-tab-${category.id}`} aria-controls={`hotbar-panel-${category.id}`} aria-selected={shownCategory === category.id} onClick={() => { setActiveCategory(category.id); setTooltip(null) }} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${shownCategory === category.id ? 'bg-violet-400/20 text-violet-100' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><category.icon className="h-3.5 w-3.5" />{category.label}<span className="opacity-60">{category.count}</span></button>)}
          </div>
              {spellSlots.length > 0 && <div data-testid="combat-hotbar-spell-slots" aria-label={`${character.name}剩余法术位：${spellSlotLabel}`} className="flex flex-wrap items-center gap-1 text-xs">
                <span className="mr-1 text-slate-300">剩余法术位</span>
            {spellSlots.map((slot) => <span key={slot.key} data-spell-slot-summary-level={slot.level} data-spell-slot-summary-current={slot.current} data-spell-slot-summary-max={slot.max} title={`${slot.isPact ? '契约法术位' : `${slot.level}环法术位`}：剩余 ${slot.current}，总计 ${slot.max}`} className={`rounded border px-1.5 py-0.5 tabular-nums ${slot.current > 0 ? 'border-violet-300/25 bg-violet-400/10 text-violet-100' : 'border-white/5 text-slate-500'}`}>{slot.label} <strong>{slot.current}</strong>/{slot.max}</span>)}
          </div>}
        </div>
        <div data-testid="combat-hotbar-category-content" className="h-[6.75rem] overflow-y-auto overscroll-contain pt-1">
          <div role="tabpanel" id="hotbar-panel-basics" aria-labelledby="hotbar-tab-basics" hidden={shownCategory !== 'basics'} data-testid="combat-hotbar-basics">
            <div data-testid="combat-hotbar-basics-rail" aria-label="基础动作，可拖拽排序" className="flex flex-wrap gap-1.5">
              {grouped.basics.filter((entry) => entry.command.kind !== 'end-turn').map(actionButton)}
            </div>
          </div>
          <div role="tabpanel" id="hotbar-panel-spells" aria-labelledby="hotbar-tab-spells" hidden={shownCategory !== 'spells'} data-testid="combat-hotbar-spells">
            <div className="flex items-start gap-1.5">
              <button type="button" onClick={() => setSpellPage(activeSpellPage - 1)} disabled={activeSpellPage <= 0} aria-label="上一页法术" className="flex h-20 w-6 shrink-0 items-center justify-center rounded border border-white/10 text-slate-300 disabled:opacity-20"><ChevronLeft className="h-4 w-4" /></button>
              <div ref={spellRailRef} className="flex min-w-0 flex-1 flex-nowrap gap-1.5 overflow-hidden">{visibleSpells.map(actionButton)}</div>
              <button type="button" onClick={() => setSpellPage(activeSpellPage + 1)} disabled={activeSpellPage >= spellPageCount - 1} aria-label="下一页法术" className="flex h-20 w-6 shrink-0 items-center justify-center rounded border border-white/10 text-slate-300 disabled:opacity-20"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-right text-[11px] text-slate-400">{activeSpellPage + 1}/{spellPageCount} 页 · 拖拽排序 · 右键选择施法环位</p>
          </div>
          <div role="tabpanel" id="hotbar-panel-features" aria-labelledby="hotbar-tab-features" hidden={shownCategory !== 'features'} data-testid="combat-hotbar-features" className={shownCategory === 'features' ? 'flex flex-wrap gap-1.5' : 'hidden'}>
            {grouped.features.map(actionButton)}
            {grouped.features.length === 0 && <p className="py-3 text-xs text-slate-400">当前没有可主动使用的职业特性。</p>}
          </div>
          <div role="tabpanel" id="hotbar-panel-items" aria-labelledby="hotbar-tab-items" hidden={shownCategory !== 'items'} data-testid="combat-hotbar-items">
            <div data-testid="combat-item-quick-grid" className="flex flex-wrap gap-2">
              {itemQuickbarPreference.slots.map((instanceId, slotIndex) => <div key={slotIndex} className="flex w-[4.5rem] flex-col items-center gap-1">{quickbarItemButton(instanceId, slotIndex)}<span className="w-full truncate text-center text-[11px] text-slate-300" title={instanceId ? inventoryEntryById.get(instanceId)?.item.name : undefined}>{instanceId ? inventoryEntryById.get(instanceId)?.item.name : `快捷槽 ${slotIndex + 1}`}</span></div>)}
              <button type="button" data-testid="combat-item-backpack" aria-label="打开完整背包" onClick={() => setBackpackVisible(true)} className="flex w-[4.5rem] flex-col items-center justify-center gap-1 rounded-lg border border-amber-300/30 bg-amber-400/10 p-2 text-amber-100"><Backpack className="h-7 w-7" /><span className="text-[11px]">背包 {inventory.entries.length}</span></button>
            </div>
          </div>
        </div>
      </div>
    </section>
    {quickCharacterOpen && typeof document !== 'undefined' ? createPortal(
      <PlayerQuickCharacterSheet character={character} onClose={() => setQuickCharacterOpen(false)} />,
      document.body,
    ) : null}
    {backpackOpen && typeof document !== 'undefined' ? createPortal(
      <div
        className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setBackpackVisible(false)
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="combat-backpack-title"
          data-testid="combat-backpack-dialog"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[92vh] w-[min(96vw,1500px)] flex-col overflow-hidden rounded-2xl border border-amber-300/20 bg-[#0b0d14]/98 shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
        >
          <header className="flex shrink-0 items-start gap-3 border-b border-white/10 px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-100">
              <Backpack className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 id="combat-backpack-title" className="text-base font-bold text-white">角色物品栏</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                背包包含角色的全部装备与道具。可直接使用支持自动结算的物品，也可选择物品后放入或交换 1–7 号快捷槽。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBackpackVisible(false)}
              aria-label="关闭战斗背包"
              className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <EquipmentTab
              charId={character.id}
              compact
              pending={pending}
              onUseItem={useBackpackItem}
              quickbarSlots={itemQuickbarPreference.slots}
              onAssignQuickbarSlot={assignItemToQuickbar}
              onClearQuickbarSlot={clearItemQuickbarSlot}
            />
          </div>
        </section>
      </div>,
      document.body,
    ) : null}
    {tooltip && typeof document !== 'undefined' ? createPortal(
      <div
        id="combat-hotbar-action-tooltip"
        role="tooltip"
        className="pointer-events-none fixed z-[1400] w-60 -translate-x-1/2 -translate-y-full rounded-xl border border-white/15 bg-void-950/95 p-3 text-left shadow-2xl backdrop-blur-md"
        style={{ left: tooltip.left, top: tooltip.top }}
      >
        <strong className="block text-xs text-white">{tooltip.entry.label}</strong>
        <span className="mt-1 block text-[10px] leading-4 text-white">{tooltip.entry.description}</span>
        <span className={`mt-2 block text-[10px] ${tooltip.entry.enabled ? 'text-emerald-300' : 'text-amber-300'}`}>
          {tooltip.entry.enabled
            ? `${ECONOMY_LABELS[tooltip.entry.economy]} · ${TARGETING_LABELS[tooltip.entry.targeting]}`
            : tooltip.entry.disabledReason}
        </span>
        {tooltip.entry.sourceKind === 'spell' ? <>
          <span className="mt-1 block text-[10px] font-semibold text-violet-200">
            {tooltipSpellSlotLevel === 0
              ? '戏法'
              : tooltip.entry.command.kind === 'cast-spell'
                ? `${tooltipSpellSlotLevel} 环施放${tooltipSpellSlotLocked ? '（已固定）' : '（默认）'}`
                : `${tooltipSpellSlotLevel} 环法术`}
          </span>
          {tooltipSpellDamage ? <span className="mt-1 block rounded-md border border-rose-300/15 bg-rose-500/[0.06] px-2 py-1.5 text-[10px] leading-4 text-rose-100">
            <strong>伤害：</strong>{tooltipSpellDamage.summary}
            {tooltipSpellDamage.featureBonuses.length > 0
              ? <span className="mt-0.5 block text-amber-200">
                  {tooltipSpellDamage.featureBonuses.join('；')}
                </span>
              : null}
          </span> : null}
          <span className="mt-1 block text-[9px] text-violet-300">
            {tooltip.entry.command.kind === 'cast-spell'
              ? '左键按当前环位施放 · 右键重新固定环位'
              : '点击打开完整施法配置'}
          </span>
        </> : null}
      </div>,
      document.body,
    ) : null}
    {spellConfiguration && typeof document !== 'undefined' ? createPortal(
      <div
        className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSpellConfiguration(null)
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="combat-hotbar-spell-config-title"
          className="w-full max-w-md rounded-2xl border border-violet-300/25 bg-[#0d0e17]/98 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.75)]"
        >
          <div className="flex items-start gap-3">
            <Dnd5eActionIcon spec={spellConfiguration.entry.icon} level={spellConfiguration.entry.resource?.current} className="w-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 id="combat-hotbar-spell-config-title" className="text-base font-bold text-white">{spellConfiguration.entry.label}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">选择并固定施法环位。保存后左键点击法术图标，才会进入目标或范围选择。</p>
            </div>
            <button type="button" onClick={() => setSpellConfiguration(null)} aria-label="关闭施法配置" className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/80">施法环位</div>
            <div className="grid grid-cols-5 gap-2">
              {(spellConfiguration.entry.availableSlotLevels ?? []).map((level) => <button
                key={level}
                type="button"
                onClick={() => setSpellConfiguration((current) => current ? { ...current, slotLevel: level } : null)}
                className={`rounded-lg border px-2 py-2 text-sm font-bold ${spellConfiguration.slotLevel === level ? 'border-amber-300/70 bg-amber-400/20 text-amber-100' : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/10'}`}
              >
                {level === 0 ? '戏法' : `${level}环`}
              </button>)}
            </div>
          </div>
          {armedSpellModifiers.size > 0 ? <div className={`mt-4 rounded-xl border p-3 text-xs ${
            spellConfigurationResolution?.ok
              ? 'border-emerald-300/15 bg-emerald-500/[0.06] text-emerald-100'
              : 'border-amber-300/20 bg-amber-500/[0.08] text-amber-100'
          }`}>
            <div>已激活：{[...armedSpellModifiers]
              .map((id) => dnd5eSpellModifierIntentDefinition(id)?.label ?? id)
              .join('、')}</div>
            {!spellConfigurationResolution?.ok ? <div className="mt-1 leading-5 text-amber-200/80">
              {spellConfigurationResolution?.reasons.join('；')}
            </div> : null}
          </div> : null}
          <button
            type="button"
            disabled={spellConfigurationResolution?.ok === false}
            onClick={() => pinSpellSlotLevel(spellConfiguration.entry.id, spellConfiguration.slotLevel)}
            className="mt-5 w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {spellConfiguration.slotLevel === 0 ? '固定为戏法' : `固定为 ${spellConfiguration.slotLevel} 环`}
          </button>
          <button
            type="button"
            disabled={spellConfigurationResolution?.ok === false}
            onClick={() => {
              const { entry, slotLevel } = spellConfiguration
              activate(entry, slotLevel)
              pinSpellSlotLevel(entry.id, slotLevel)
            }}
            className="mt-2 w-full rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-bold text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {spellConfiguration.slotLevel === 0
              ? '以戏法施放'
              : `以 ${spellConfiguration.slotLevel} 环施放`}
          </button>
          {spellConfiguration.entry.ritualAvailable === true ? <button
            type="button"
            onClick={() => activateRitual(spellConfiguration.entry)}
            className="mt-2 w-full rounded-xl border border-sky-300/25 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-100 hover:bg-sky-500/20"
          >
            请求仪式施法（原施法时间 +10 分钟，不消耗法术位）
          </button> : null}
          {spellConfiguration.entry.command.kind === 'cast-spell' &&
          dnd5eSpellSupportsNarrativeObjectAlternative(
            spellConfiguration.entry.command.spellId,
          ) ? <button
            type="button"
            disabled={spellConfigurationResolution?.ok === false}
            onClick={() => activateNarrativeObject(
              spellConfiguration.entry,
              spellConfiguration.slotLevel,
            )}
            className="mt-2 w-full rounded-xl border border-sky-300/25 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-100 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {`以 ${spellConfiguration.slotLevel} 环对物件施放（语音叙事）`}
          </button> : null}
        </section>
      </div>,
      document.body,
    ) : null}
  </>)
}
