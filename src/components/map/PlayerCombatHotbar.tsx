import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, LockKeyhole, PackageOpen, Sparkles, Swords, X } from 'lucide-react'
import type { Character } from '../../types/character'
import { useSpellbookStore } from '../../store/spellbook'
import { getClassResource } from '../../lib/classResources'
import {
  DND5E_SRD_CLASS_DEFINITIONS,
  dnd5eAvailableSpellModifierIntents,
  dnd5eFreeSpellCastSource,
  dnd5ePactSlotLevel,
  dnd5eSelectedSpellIdsForClass,
  dnd5eSpellModifierIntentDefinition,
  dnd5eSpellbookEntriesWithPlugins,
  dnd5eSpellbookEntryCastingTime,
  dnd5eSpellbookEntryDescription,
  getDnd5eSrdCombatSpell,
  normalizeDnd5eClassLevels,
  normalizeDnd5eInventory,
  registeredDnd5ePluginSpells,
  resolveDnd5eSpellModifierIntents,
  toggleDnd5eSpellModifierIntent,
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
  type Dnd5eCombatSpellModifier,
  type Dnd5eCombatActionSpellSource,
  type Dnd5eCombatActionTargeting,
  type Dnd5eCombatHotbarPreferenceV1,
} from '../../lib/dnd5eCombatActionDescriptors'
import Dnd5eActionIcon from './Dnd5eActionIcon'

const STORAGE_PREFIX = 'dndstars5e:combat-hotbar:v1:'
const SPELL_PAGE_SIZE = 12
const FEATURE_PAGE_SIZE = 3
const ITEM_PAGE_SIZE = 6
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
    action: { current: number }
    bonusAction: { current: number }
    movement: { current: number }
  }
  activeActionId?: string
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

export default function PlayerCombatHotbar({
  character,
  canAct,
  pending,
  turnEconomy,
  activeActionId,
  onCommand,
  onUnavailable,
}: PlayerCombatHotbarProps) {
  const actionRemaining = turnEconomy.action.current
  const bonusActionRemaining = turnEconomy.bonusAction.current
  const movementRemaining = turnEconomy.movement.current
  const importedSpells = useSpellbookStore((state) => state.spells)
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
    const classLevels = normalizeDnd5eClassLevels(character)
    const spellbookById = new Map(dnd5eSpellbookEntriesWithPlugins(importedSpells, registeredDnd5ePluginSpells()).map((spell) => [spell.id, spell]))
    const spellSources: Dnd5eCombatActionSpellSource[] = []
    for (const definition of DND5E_SRD_CLASS_DEFINITIONS) {
      if (!definition.spellcasting || (classLevels[definition.id] ?? 0) <= 0) continue
      for (const spellId of dnd5eSelectedSpellIdsForClass(character, definition.id)) {
        const entry = spellbookById.get(spellId)
        if (!entry) continue
        const combat = getDnd5eSrdCombatSpell(spellId)
        const imported = entry.imported
        const baseCastingTime = spellEconomy(dnd5eSpellbookEntryCastingTime(entry))
        const classLevel = classLevels[definition.id] ?? 0
        const classSelections = character.dnd5eClassChoices?.classes?.[definition.id]?.selections ?? {}
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
    const featureSources = spellModifierIntents.map(({ definition, available, unavailableReason, resource }) => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      icon: dnd5eSystemActionIcon(definition.id, definition.iconMotif),
      modifier: definition.id,
      resource,
      available,
      unavailableReason,
    }))
    const inventory = normalizeDnd5eInventory(character)
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
    importedSpells,
    movementRemaining,
    pending,
    spellModifierIntents,
  ])

  const [storedPreference, setPreference] = useState<Dnd5eCombatHotbarPreferenceV1>(() =>
    reconcileDnd5eCombatHotbarPreference(readPreference(character.id), descriptors),
  )
  const [draggedActionId, setDraggedActionId] = useState<string | null>(null)
  const [spellConfiguration, setSpellConfiguration] = useState<{
    entry: Dnd5eCombatActionDescriptorV1
    slotLevel: number
  } | null>(null)
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

  useEffect(() => savePreference(character.id, preference), [character.id, preference])

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
  const [itemPage, setItemPage] = useState(0)
  const itemPageCount = Math.max(1, Math.ceil(grouped.items.length / ITEM_PAGE_SIZE))
  const activeItemPage = Math.min(itemPageCount - 1, itemPage)
  const visibleItems = grouped.items.slice(activeItemPage * ITEM_PAGE_SIZE, (activeItemPage + 1) * ITEM_PAGE_SIZE)
  const [featurePage, setFeaturePage] = useState(0)
  const featurePageCount = Math.max(1, Math.ceil(grouped.features.length / FEATURE_PAGE_SIZE))
  const activeFeaturePage = Math.min(featurePageCount - 1, featurePage)
  const visibleFeatures = grouped.features.slice(
    activeFeaturePage * FEATURE_PAGE_SIZE,
    (activeFeaturePage + 1) * FEATURE_PAGE_SIZE,
  )
  const activate = useCallback((entry: Dnd5eCombatActionDescriptorV1, configuredSlotLevel?: number) => {
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

  useEffect(() => {
    if (!spellConfiguration) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSpellConfiguration(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [spellConfiguration])

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
    const spellLevel = entry.sourceKind === 'spell' ? entry.resource?.current : undefined
    const modifierActive = entry.command.kind === 'toggle-spell-modifier' &&
      armedSpellModifiers.has(entry.command.modifier)
    return <button
      key={entry.id}
      type="button"
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
        if (!suppressClickAfterDragRef.current) activate(entry)
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
        setSpellConfiguration({ entry, slotLevel: availableLevels[0] })
      }}
      onMouseEnter={(event) => showTooltip(entry, event.currentTarget)}
      onMouseLeave={() => hideTooltip(entry.id)}
      onFocus={(event) => showTooltip(entry, event.currentTarget)}
      onBlur={() => hideTooltip(entry.id)}
      aria-label={entry.label}
      aria-describedby={tooltip?.entry.id === entry.id ? 'combat-hotbar-action-tooltip' : undefined}
      className={`group relative h-12 w-12 shrink-0 rounded-lg border p-px transition ${entry.id === 'system:end-turn' ? 'border-amber-300/35 bg-amber-400/10' : activeActionId === entry.id || modifierActive ? 'border-amber-300/70 bg-amber-400/15 shadow-[0_0_14px_rgba(251,191,36,0.28)]' : entry.enabled ? 'border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-violet-300/50 hover:bg-violet-500/10' : 'cursor-not-allowed border-white/[0.045] bg-black/20'}`}
    >
      <Dnd5eActionIcon spec={entry.icon} level={spellLevel} active={activeActionId === entry.id || modifierActive} disabled={!entry.enabled} badge={resourceBadge} className="w-full" />
      {modifierActive ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-amber-100/70 bg-amber-400 px-1 text-[9px] font-black text-void-950">✓</span> : null}
      {!entry.enabled ? <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20"><LockKeyhole className="h-4 w-4 text-slate-300/75 drop-shadow" /></span> : null}
    </button>
  }

  const portrait = character.tokenPortrait || character.portrait
  const hpPercentage = Math.max(0, Math.min(100, character.maxHp > 0 ? character.currentHp / character.maxHp * 100 : 0))

  return (<>
    <section
      data-testid="player-combat-hotbar"
      className="pointer-events-auto w-full max-w-[1320px] overflow-x-auto rounded-xl border border-amber-200/20 bg-gradient-to-b from-[#171712]/95 to-[#090a0d]/95 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl"
    >
      <div className="grid min-w-[1100px] grid-cols-[82px_minmax(330px,1fr)_218px_minmax(190px,0.55fr)_218px] gap-1.5">
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
            <span className="ml-auto font-normal tracking-normal text-slate-500">{grouped.items.length} 项 · {activeItemPage + 1}/{itemPageCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setItemPage(Math.max(0, activeItemPage - 1))} disabled={activeItemPage <= 0} aria-label="上一页道具" className="flex h-12 w-5 shrink-0 items-center justify-center rounded border border-white/5 bg-black/20 text-slate-400 hover:bg-white/10 disabled:opacity-20"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
              {Array.from({ length: ITEM_PAGE_SIZE }, (_, index) => visibleItems[index]
                ? actionButton(visibleItems[index])
                : <div key={`empty-item-${index}`} className="h-12 w-12 shrink-0 rounded-lg border border-dashed border-amber-200/[0.07] bg-black/10" />)}
            </div>
            <button type="button" onClick={() => setItemPage(Math.min(itemPageCount - 1, activeItemPage + 1))} disabled={activeItemPage >= itemPageCount - 1} aria-label="下一页道具" className="flex h-12 w-5 shrink-0 items-center justify-center rounded border border-white/5 bg-black/20 text-slate-400 hover:bg-white/10 disabled:opacity-20"><ChevronRight className="h-3.5 w-3.5" /></button>
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
        {tooltip.entry.sourceKind === 'spell' ? <span className="mt-1 block text-[9px] text-violet-300">左键直接施放 · 右键选择升环与配置</span> : null}
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
              <p className="mt-1 text-xs leading-5 text-slate-400">选择本次施法使用的法术位。确认后回到地图点选目标或范围。</p>
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
            onClick={() => activate(spellConfiguration.entry, spellConfiguration.slotLevel)}
            className="mt-5 w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {spellConfiguration.slotLevel === 0 ? '施放戏法' : `以 ${spellConfiguration.slotLevel} 环施放`}
          </button>
        </section>
      </div>,
      document.body,
    ) : null}
  </>)
}
