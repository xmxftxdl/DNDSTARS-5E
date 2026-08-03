import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Backpack, ChevronLeft, ChevronRight, LockKeyhole, PackageOpen, Sparkles, Swords, X } from 'lucide-react'
import type { Character } from '../../types/character'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'
import { useSpellbookStore } from '../../store/spellbook'
import { getClassResource } from '../../lib/classResources'
import {
  dnd5eAvailableSpellModifierIntents,
  dnd5eMartialSpellSynergyForCharacter,
  dnd5eMartialSpellBonusAttackAvailable,
  dnd5eRageFeatureForCharacter,
  dnd5eEffectiveSpellcastingSources,
  dnd5eEffectiveSpellSelections,
  dnd5eFreeSpellCastSource,
  dnd5ePactSlotLevel,
  dnd5eSelectedSpellIdsForClass,
  dnd5eSpellModifierIntentDefinition,
  dnd5eSpellbookEntriesWithPlugins,
  dnd5eSpellbookEntryCastingTime,
  dnd5eSpellbookEntryDescription,
  getDnd5eSrdCombatSpell,
  normalizeDnd5eInventory,
  registeredDnd5ePluginSpells,
  resolveDnd5eSpellModifierIntents,
  toggleDnd5eSpellModifierIntent,
  dnd5eWeaponAttackProfile,
} from '../../rulesets/dnd5e'
import { dnd5eItemActionIcon, dnd5eSpellActionIcon, dnd5eSystemActionIcon } from '../../lib/dnd5eActionIcons'
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
  COMBAT_ITEM_QUICK_SLOT_COUNT,
  reconcileCombatItemQuickbarPreference,
  type CombatItemQuickbarPreferenceV1,
} from './combatItemQuickbar'
import { dnd5eCombatSpellDamagePreview } from './combatSpellDamagePresentation'

const STORAGE_PREFIX = 'dndstars5e:combat-hotbar:v1:'
const ITEM_QUICKBAR_STORAGE_PREFIX = 'dndstars5e:combat-item-quickbar:v1:'
const ITEM_BACKPACK_OPEN_PREFIX = 'dndstars5e:combat-backpack-open:v1:'
const SPELL_PAGE_SIZE = 12
const FEATURE_PAGE_SIZE = 3
const EMPTY_ARMED_SPELL_MODIFIERS = new Set<Dnd5eCombatSpellModifier>()

const ECONOMY_LABELS: Record<Dnd5eCombatActionEconomy, string> = {
  action: '动作',
  'bonus-action': '附赠动作',
  reaction: '反应',
  movement: '移动',
  none: '无行动消耗',
  special: '需要配置',
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
  canAct: boolean
  pending: boolean
  turnEconomy: {
    turnKey?: string
    action: { current: number }
    bonusAction: { current: number }
    movement: { current: number }
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
    economy: 'action' | 'bonus-action'
    maximumFeet: number
    coreSpellId?: string
  }[]
  selectedSpellSlotLevels?: Readonly<Record<string, number>>
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

function spellTargeting(spell: ReturnType<typeof getDnd5eSrdCombatSpell>): Dnd5eCombatActionTargeting {
  if (!spell) return 'configure'
  if (spell.area || spell.target === 'area') return 'area'
  if (spell.rangeFeet === 0 && spell.target === 'ally') return 'self'
  return 'creature'
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
  canAct,
  pending,
  turnEconomy,
  activeActionId,
  grappleEscapes = [],
  movablePersistentAreas = [],
  selectedSpellSlotLevels,
  onSelectedSpellSlotLevelChange,
  onCommand,
  onUnavailable,
}: PlayerCombatHotbarProps) {
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
  const [armedSpellModifierState, setArmedSpellModifierState] = useState<{
    characterId: string
    ids: Set<Dnd5eCombatSpellModifier>
  }>(() => ({ characterId: character.id, ids: new Set() }))
  const armedSpellModifiers = armedSpellModifierState.characterId === character.id
    ? armedSpellModifierState.ids
    : EMPTY_ARMED_SPELL_MODIFIERS
  const descriptors = useMemo(() => {
    const spellbookById = new Map(dnd5eSpellbookEntriesWithPlugins(importedSpells, registeredDnd5ePluginSpells()).map((spell) => [spell.id, spell]))
    const spellSources: Dnd5eCombatActionSpellSource[] = []
    for (const source of dnd5eEffectiveSpellcastingSources(character)) {
      const definition = source.definition
      if (!definition.spellcasting) continue
      for (const spellId of dnd5eSelectedSpellIdsForClass(character, source.classId)) {
        const entry = spellbookById.get(spellId)
        if (!entry) continue
        const combat = getDnd5eSrdCombatSpell(spellId)
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
        const defaultSlotLevel = entry.level === 0
          ? 0
          : pactLevel != null
            ? pactLevel
            : entry.level
        const modifierResolution = combat && availableSlotLevels[0] != null
          ? resolveDnd5eSpellModifierIntents({
              character,
              castingClassId: definition.id,
              spellId,
              slotLevel: availableSlotLevels[0],
              modifierIds: [...armedSpellModifiers],
            })
          : undefined
        const castingTime = modifierResolution?.ok && modifierResolution.effectiveEconomy === 'bonus-action'
          ? 'bonus-action'
          : baseCastingTime
        const supportedCastingTime = castingTime !== 'reaction' && dnd5eSpellbookEntryCastingTime(entry) !== 'unsupported'
        spellSources.push({
          id: spellId,
          label: entry.name,
          description: dnd5eSpellbookEntryDescription(entry) || '打开法术配置，确认法术位与规则选项。',
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
          targeting: spellTargeting(combat),
          castingClassId: definition.id,
          defaultSlotLevel,
          availableSlotLevels,
          available: supportedCastingTime && availableSlotLevels.length > 0,
          unavailableReason: castingTime === 'reaction'
            ? '反应法术会在对应触发发生时询问。'
            : !supportedCastingTime
              ? '该法术的施法时间不适用于战斗动作。'
              : '没有可用于施放该法术的法术位。',
        })
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
      icon: dnd5eSystemActionIcon(definition.id, definition.iconMotif),
      modifier: definition.id,
      resource,
      available,
      unavailableReason,
    }))
    featureSources.unshift(...movablePersistentAreas.map((area) => ({
      id: `persistent-area-move:${area.id}`,
      label: `移动${area.label}`,
      description: `以${area.economy === 'bonus-action' ? '附赠动作' : '动作'}在地图上选择新位置，至多移动 ${area.maximumFeet} 尺；落点、路径和撞击效果仍由 Headless 校验。`,
      icon: dnd5eSpellActionIcon({
        id: area.coreSpellId ?? area.id,
        name: area.label,
      }),
      economy: area.economy,
      targeting: 'map-position' as const,
      resource: { label: '尺', current: area.maximumFeet },
      command: { kind: 'move-persistent-area' as const, areaId: area.id },
    })))
    const turnKey = turnEconomy.turnKey ?? ''
    const mainWeaponId = character.equipment?.mainWeapon?.id
    if (
      dnd5eWeaponAttackProfile(character) &&
      dnd5eMartialSpellBonusAttackAvailable(character, turnKey)
    ) {
      featureSources.push({
        id: 'martial-spell-synergy-cantrip-then-bonus-attack-attack',
        label: '特性附赠武器攻击',
        description: '施法已开启本回合的一次附赠动作武器攻击；目标、距离和命中仍由 Host 校验。',
        icon: dnd5eSystemActionIcon('martial-spell-synergy-cantrip-then-bonus-attack', 'melee-attack'),
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
        icon: dnd5eSystemActionIcon('martial-spell-synergy-linked-equipment', 'summon'),
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
        icon: dnd5eSystemActionIcon('feature-extra-action-teleport', 'arcane'),
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
        icon: dnd5eSystemActionIcon('rage-feature-eagle-dash', 'dash'),
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
        icon: dnd5eSystemActionIcon('rage-feature-wolf-knockdown', 'control'),
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
      if (!entry.item.use) return []
      const resource = Object.values(entry.resources ?? {})[0]
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
        usable: entry.identified !== false && entry.quantity > 0 && (!resource || resource.current > 0),
        unavailableReason: entry.identified === false ? '魔法物品尚未鉴定。' : resource?.current === 0 ? `${resource.label}已经耗尽。` : undefined,
      }]
    })
    return buildDnd5eCombatActionDescriptors({
      canAct,
      pending,
      actionRemaining,
      bonusActionRemaining,
      movementRemaining,
      weaponLabel: character.equipment?.mainWeapon?.name,
      grappleEscapes,
      spells: spellSources,
      features: featureSources,
      items: itemSources,
    })
  }, [
    actionRemaining,
    armedSpellModifiers,
    bonusActionRemaining,
    canAct,
    character,
    grappleEscapes,
    importedSpells,
    inventory,
    movablePersistentAreas,
    movementRemaining,
    pending,
    spellModifierIntents,
    turnEconomy.turnKey,
  ])

  const [storedPreference, setPreference] = useState<Dnd5eCombatHotbarPreferenceV1>(() =>
    reconcileDnd5eCombatHotbarPreference(readPreference(character.id), descriptors),
  )
  const quickbarCandidateIds = useMemo(() => {
    const usable = inventory.entries
      .filter((entry) => !!entry.item.use)
      .map((entry) => entry.instanceId)
    const remaining = inventory.entries
      .filter((entry) => !entry.item.use)
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
  const spellPageCount = Math.max(1, Math.ceil(grouped.spells.length / SPELL_PAGE_SIZE))
  const activeSpellPage = Math.min(spellPageCount - 1, preference.activePage)
  const visibleSpells = grouped.spells.slice(activeSpellPage * SPELL_PAGE_SIZE, (activeSpellPage + 1) * SPELL_PAGE_SIZE)
  const inventoryEntryById = useMemo(
    () => new Map(inventory.entries.map((entry) => [entry.instanceId, entry])),
    [inventory.entries],
  )
  const itemDescriptorByInstanceId = useMemo(() => {
    const byInstanceId = new Map<string, Dnd5eCombatActionDescriptorV1>()
    for (const descriptor of grouped.items) {
      if (descriptor.command.kind === 'use-item') {
        byInstanceId.set(descriptor.command.instanceId, descriptor)
      }
    }
    return byInstanceId
  }, [grouped.items])
  const [featurePage, setFeaturePage] = useState(0)
  const featurePageCount = Math.max(1, Math.ceil(grouped.features.length / FEATURE_PAGE_SIZE))
  const activeFeaturePage = Math.min(featurePageCount - 1, featurePage)
  const visibleFeatures = grouped.features.slice(
    activeFeaturePage * FEATURE_PAGE_SIZE,
    (activeFeaturePage + 1) * FEATURE_PAGE_SIZE,
  )
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
      setArmedSpellModifierState((current) => ({
        characterId: character.id,
        ids: toggleDnd5eSpellModifierIntent(
          current.characterId === character.id ? current.ids : new Set(),
          modifier,
        ),
      }))
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
      const resolution = resolveDnd5eSpellModifierIntents({
        character,
        castingClassId: entry.command.castingClassId as Parameters<typeof resolveDnd5eSpellModifierIntents>[0]['castingClassId'],
        spellId: entry.command.spellId,
        slotLevel,
        modifierIds: [...armedSpellModifiers],
      })
      if (!resolution.ok) {
        onUnavailable?.({
          ...entry,
          enabled: false,
          disabledReason: resolution.reasons.join('；'),
        })
        return
      }
      onCommand({
        ...entry.command,
        slotLevel,
        options: {
          ...resolution.options,
          autoSubmitOnTargetSelection: !resolution.requiresTargetConfiguration,
        },
      }, entry)
      setArmedSpellModifierState({ characterId: character.id, ids: new Set() })
      setSpellConfiguration(null)
      return
    }
    onCommand(entry.command, entry)
  }, [armedSpellModifiers, character, onCommand, onUnavailable])

  const pinSpellSlotLevel = useCallback((actionId: string, slotLevel: number) => {
    if (onSelectedSpellSlotLevelChange) {
      onSelectedSpellSlotLevelChange(actionId, slotLevel)
    } else {
      setLocalSelectedSpellSlotLevels((current) => ({ ...current, [actionId]: slotLevel }))
    }
    setSpellConfiguration(null)
  }, [onSelectedSpellSlotLevelChange])

  useEffect(() => {
    if (!spellConfiguration && !backpackOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSpellConfiguration(null)
      if (event.key === 'Escape') setBackpackVisible(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [backpackOpen, setBackpackVisible, spellConfiguration])

  const spellConfigurationResolution = useMemo(() => {
    if (!spellConfiguration || spellConfiguration.entry.command.kind !== 'cast-spell') return undefined
    return resolveDnd5eSpellModifierIntents({
      character,
      castingClassId: spellConfiguration.entry.command.castingClassId as Parameters<typeof resolveDnd5eSpellModifierIntents>[0]['castingClassId'],
      spellId: spellConfiguration.entry.command.spellId,
      slotLevel: spellConfiguration.slotLevel,
      modifierIds: [...armedSpellModifiers],
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
        )
      : undefined
    const modifierActive = entry.command.kind === 'toggle-spell-modifier' &&
      armedSpellModifiers.has(entry.command.modifier)
    return <button
      key={entry.id}
      type="button"
      data-action-id={entry.id}
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
        if (!suppressClickAfterDragRef.current) activate(entry, pinnedSpellSlotLevel)
      }}
      onContextMenu={(event) => {
        if (entry.command.kind !== 'cast-spell') return
        event.preventDefault()
        event.stopPropagation()
        const availableLevels = entry.availableSlotLevels ?? []
        if (availableLevels.length < 1) {
          onUnavailable?.(entry)
          return
        }
        setTooltip(null)
        setSpellConfiguration({
          entry,
          slotLevel: pinnedSpellSlotLevel != null && availableLevels.includes(pinnedSpellSlotLevel)
            ? pinnedSpellSlotLevel
            : availableLevels[0],
        })
      }}
      onMouseEnter={(event) => showTooltip(entry, event.currentTarget)}
      onMouseLeave={() => hideTooltip(entry.id)}
      onFocus={(event) => showTooltip(entry, event.currentTarget)}
      onBlur={() => hideTooltip(entry.id)}
      aria-label={entry.label}
      title={entry.command.kind === 'cast-spell'
        ? [
            entry.label,
            pinnedSpellSlotLevel == null
              ? `${entry.command.slotLevel === 0 ? '戏法' : `${entry.command.slotLevel}环`}（默认）`
              : `${pinnedSpellSlotLevel === 0 ? '戏法' : `${pinnedSpellSlotLevel}环`}（已固定）`,
            damagePreview?.summary,
          ].filter(Boolean).join('\n')
        : undefined}
      data-spell-slot-level={entry.command.kind === 'cast-spell'
        ? pinnedSpellSlotLevel ?? entry.command.slotLevel
        : undefined}
      data-spell-slot-locked={entry.command.kind === 'cast-spell' && pinnedSpellSlotLevel != null
        ? 'true'
        : undefined}
      aria-describedby={tooltip?.entry.id === entry.id ? 'combat-hotbar-action-tooltip' : undefined}
      className={`group relative h-12 w-12 shrink-0 rounded-lg border p-px transition ${entry.id === 'system:end-turn' ? 'border-amber-300/35 bg-amber-400/10' : activeActionId === entry.id || modifierActive ? 'border-amber-300/70 bg-amber-400/15 shadow-[0_0_14px_rgba(251,191,36,0.28)]' : entry.enabled ? 'border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-violet-300/50 hover:bg-violet-500/10' : 'cursor-not-allowed border-white/[0.045] bg-black/20'}`}
    >
      <Dnd5eActionIcon spec={entry.icon} level={spellLevel} active={activeActionId === entry.id || modifierActive} disabled={!entry.enabled} badge={resourceBadge} className="w-full" />
      {modifierActive ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-amber-100/70 bg-amber-400 px-1 text-[9px] font-black text-void-950">✓</span> : null}
      {!entry.enabled ? <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20"><LockKeyhole className="h-4 w-4 text-slate-300/75 drop-shadow" /></span> : null}
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

  const useBackpackItem = (instanceId: string): boolean => {
    const descriptor = itemDescriptorByInstanceId.get(instanceId)
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
          className="relative h-12 w-12 shrink-0 rounded-lg border border-dashed border-amber-200/[0.1] bg-black/10 hover:border-amber-200/25 hover:bg-amber-400/[0.06]"
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
        title={directlyUsable
          ? `${entry.item.name}\n${descriptor.description}`
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
        className={[
          'group relative h-12 w-12 shrink-0 rounded-lg border p-px transition',
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
        {!directlyUsable ? (
          <span className="absolute inset-x-1 bottom-0.5 rounded bg-black/75 px-0.5 text-[7px] font-semibold text-slate-300">
            查看
          </span>
        ) : null}
        {descriptor && !descriptor.enabled ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
            <LockKeyhole className="h-4 w-4 text-slate-300/75 drop-shadow" />
          </span>
        ) : null}
      </button>
    )
  }

  const tooltipSpellSlotLevel = tooltip?.entry.command.kind === 'cast-spell'
    ? effectiveSelectedSpellSlotLevels[tooltip.entry.id] ?? tooltip.entry.command.slotLevel
    : undefined
  const tooltipSpellDamage = tooltip?.entry.command.kind === 'cast-spell' &&
    tooltipSpellSlotLevel != null
    ? dnd5eCombatSpellDamagePreview(
        character,
        tooltip.entry.command.castingClassId,
        tooltip.entry.command.spellId,
        tooltipSpellSlotLevel,
      )
    : undefined
  const tooltipSpellSlotLocked = tooltip?.entry.command.kind === 'cast-spell' &&
    effectiveSelectedSpellSlotLevels[tooltip.entry.id] != null
  const portrait = resolveMapTokenPortrait(character)
  const hpPercentage = Math.max(0, Math.min(100, character.maxHp > 0 ? character.currentHp / character.maxHp * 100 : 0))

  return (<>
    <section
      data-testid="player-combat-hotbar"
      className="pointer-events-auto w-full max-w-[1320px] overflow-x-auto rounded-xl border border-amber-200/20 bg-gradient-to-b from-[#171712]/95 to-[#090a0d]/95 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl"
    >
      <div className="grid min-w-[1100px] grid-cols-[82px_minmax(330px,1fr)_218px_218px_218px] gap-1.5">
        <aside className="flex flex-col items-center justify-between rounded-lg border border-amber-100/10 bg-black/25 p-1.5">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-amber-200/55 bg-violet-950 shadow-[0_0_16px_rgba(245,189,80,0.18)]">
            {portrait
              ? <img src={portrait} alt={`${character.name}的战斗头像`} className="h-full w-full object-cover" />
              : <span className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-2xl ${character.accent}`}>{character.avatar}</span>}
          </div>
          <div className="mt-1 w-full">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/70"><div className="h-full rounded-full bg-gradient-to-r from-rose-700 to-emerald-400" style={{ width: `${hpPercentage}%` }} /></div>
            <div className="mt-0.5 text-center text-[9px] font-semibold tabular-nums text-slate-300">{character.currentHp}/{character.maxHp}</div>
          </div>
          <div className="mt-1 grid w-full grid-cols-3 gap-0.5 text-center text-[8px] font-bold">
            <span title="动作" className={`rounded py-0.5 ${actionRemaining > 0 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/5 text-slate-600'}`}>动 {actionRemaining}</span>
            <span title="附赠动作" className={`rounded py-0.5 ${bonusActionRemaining > 0 ? 'bg-sky-400/20 text-sky-200' : 'bg-white/5 text-slate-600'}`}>附 {bonusActionRemaining}</span>
            <span title="剩余移动力" className={`rounded py-0.5 ${movementRemaining > 0 ? 'bg-amber-400/20 text-amber-200' : 'bg-white/5 text-slate-600'}`}>{movementRemaining}</span>
          </div>
        </aside>

        <div data-testid="combat-hotbar-spells" className="rounded-lg border border-violet-300/15 bg-violet-950/15 p-1.5">
          {spellSlots.length > 0 ? (
            <div
              data-testid="combat-hotbar-spell-slots"
              aria-label={`${character.name}剩余法术位：${spellSlotLabel}`}
              className="mb-1 flex min-h-5 flex-wrap items-center gap-1 rounded-md border border-violet-300/15 bg-black/25 px-1.5 py-0.5"
            >
              <span className="mr-0.5 text-[9px] font-semibold text-violet-200/75">剩余法术位</span>
              {spellSlots.map((slot) => (
                <span
                  key={slot.key}
                  title={`${slot.isPact ? '契约法术位' : `${slot.level}环法术位`}：剩余 ${slot.current}，总计 ${slot.max}`}
                  className={[
                    'whitespace-nowrap rounded border px-1.5 py-px text-[9px] font-semibold tabular-nums',
                    slot.current > 0
                      ? 'border-violet-300/25 bg-violet-400/10 text-violet-100'
                      : 'border-white/[0.06] bg-black/20 text-slate-600',
                  ].join(' ')}
                >
                  {slot.label} <strong className="text-[10px]">{slot.current}</strong>/{slot.max}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mb-1 flex h-4 items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-violet-200/80">
            <Sparkles className="h-3 w-3" />法术
            <span className="ml-auto font-normal tracking-normal text-slate-500">{grouped.spells.length} 项 · {activeSpellPage + 1}/{spellPageCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setSpellPage(activeSpellPage - 1)} disabled={activeSpellPage <= 0} aria-label="上一页法术" className="flex h-12 w-5 shrink-0 items-center justify-center rounded border border-white/5 bg-black/20 text-slate-400 hover:bg-white/10 disabled:opacity-20"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <div className="grid min-w-0 flex-1 grid-cols-6 gap-1">
              {Array.from({ length: SPELL_PAGE_SIZE }, (_, index) => visibleSpells[index]
                ? actionButton(visibleSpells[index])
                : <div key={`empty-spell-${index}`} className="h-12 w-12 shrink-0 rounded-lg border border-dashed border-violet-200/[0.07] bg-black/10" />)}
            </div>
            <button type="button" onClick={() => setSpellPage(activeSpellPage + 1)} disabled={activeSpellPage >= spellPageCount - 1} aria-label="下一页法术" className="flex h-12 w-5 shrink-0 items-center justify-center rounded border border-white/5 bg-black/20 text-slate-400 hover:bg-white/10 disabled:opacity-20"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div data-testid="combat-hotbar-features" className="rounded-lg border border-emerald-300/15 bg-emerald-950/10 p-1.5">
          <div className="mb-1 flex h-4 items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-100/80">
            <Sparkles className="h-3 w-3" />职业特性
            <span className="ml-auto font-normal tracking-normal text-slate-500">{grouped.features.length} 项 · {activeFeaturePage + 1}/{featurePageCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setFeaturePage(Math.max(0, activeFeaturePage - 1))} disabled={activeFeaturePage <= 0} aria-label="上一页职业特性" className="flex h-12 w-5 shrink-0 items-center justify-center rounded border border-white/5 bg-black/20 text-slate-400 hover:bg-white/10 disabled:opacity-20"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
              {Array.from({ length: FEATURE_PAGE_SIZE }, (_, index) => visibleFeatures[index]
                ? actionButton(visibleFeatures[index])
                : <div key={`empty-feature-${index}`} className="h-12 w-12 shrink-0 rounded-lg border border-dashed border-emerald-200/[0.07] bg-black/10" />)}
            </div>
            <button type="button" onClick={() => setFeaturePage(Math.min(featurePageCount - 1, activeFeaturePage + 1))} disabled={activeFeaturePage >= featurePageCount - 1} aria-label="下一页职业特性" className="flex h-12 w-5 shrink-0 items-center justify-center rounded border border-white/5 bg-black/20 text-slate-400 hover:bg-white/10 disabled:opacity-20"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div data-testid="combat-hotbar-items" className="rounded-lg border border-amber-300/15 bg-amber-950/10 p-1.5">
          <div className="mb-1 flex h-4 items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-100/80">
            <PackageOpen className="h-3 w-3" />道具
            <span className="ml-auto font-normal tracking-normal text-slate-500">
              快捷 {itemQuickbarPreference.slots.filter(Boolean).length}/{COMBAT_ITEM_QUICK_SLOT_COUNT} · 背包 {inventory.entries.length}
            </span>
          </div>
          <div data-testid="combat-item-quick-grid" className="grid grid-cols-4 gap-1">
            {itemQuickbarPreference.slots.map(quickbarItemButton)}
            <button
              type="button"
              data-testid="combat-item-backpack"
              aria-label="打开完整背包"
              title={`打开完整背包（${inventory.entries.length} 个物品栏位）`}
              onClick={() => setBackpackVisible(true)}
              className="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-300/30 bg-gradient-to-br from-amber-400/15 to-orange-950/25 text-amber-100 transition hover:-translate-y-0.5 hover:border-amber-200/60 hover:bg-amber-400/25"
            >
              <Backpack className="h-6 w-6 drop-shadow" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-amber-100/40 bg-amber-500 px-1 text-[8px] font-black text-void-950">
                {inventory.entries.length}
              </span>
            </button>
          </div>
        </div>

        <div data-testid="combat-hotbar-basics" className="rounded-lg border border-slate-200/15 bg-slate-900/30 p-1.5">
          <div className="mb-1 flex h-4 items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-300">
            <Swords className="h-3 w-3" />基础动作
            <span className="ml-auto font-normal tracking-normal text-slate-600">拖拽排序</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {grouped.basics.map(actionButton)}
          </div>
        </div>
      </div>
    </section>
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
          className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-amber-300/20 bg-[#0b0d14]/98 shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
        >
          <header className="flex shrink-0 items-start gap-3 border-b border-white/10 px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-100">
              <Backpack className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 id="combat-backpack-title" className="text-base font-bold text-white">战斗背包</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                背包包含角色的全部装备与道具。可直接使用已接入 Headless 的物品，也可选择物品后放入或交换 1–7 号快捷槽。
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
        <span className="mt-1 block text-[10px] leading-4 text-slate-400">{tooltip.entry.description}</span>
        <span className={`mt-2 block text-[10px] ${tooltip.entry.enabled ? 'text-emerald-300' : 'text-amber-300'}`}>
          {tooltip.entry.enabled
            ? `${ECONOMY_LABELS[tooltip.entry.economy]} · ${TARGETING_LABELS[tooltip.entry.targeting]}`
            : tooltip.entry.disabledReason}
        </span>
        {tooltip.entry.sourceKind === 'spell' ? <>
          <span className="mt-1 block text-[10px] font-semibold text-violet-200">
            {tooltipSpellSlotLevel === 0
              ? '戏法'
              : `${tooltipSpellSlotLevel} 环施放${tooltipSpellSlotLocked ? '（已固定）' : '（默认）'}`}
          </span>
          {tooltipSpellDamage ? <span className="mt-1 block rounded-md border border-rose-300/15 bg-rose-500/[0.06] px-2 py-1.5 text-[10px] leading-4 text-rose-100">
            <strong>伤害：</strong>{tooltipSpellDamage.summary}
            {tooltipSpellDamage.featureBonuses.length > 0
              ? <span className="mt-0.5 block text-amber-200">
                  {tooltipSpellDamage.featureBonuses.join('；')}
                </span>
              : null}
          </span> : null}
          <span className="mt-1 block text-[9px] text-violet-300">左键按当前环位施放 · 右键重新固定环位</span>
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
        </section>
      </div>,
      document.body,
    ) : null}
  </>)
}
