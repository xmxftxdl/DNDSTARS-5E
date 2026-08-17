import {
  lazy,
  memo,
  type ComponentProps,
} from 'react'
import { Swords, X } from 'lucide-react'
import CharacterDetailPanel from '../../components/map/CharacterDetailPanel'
import EnemyDetailPanel from '../../components/map/EnemyDetailPanel'
import InitiativeTracker from '../../components/map/InitiativeTracker'
import MapInventoryPanel from '../../components/map/MapInventoryPanel'
import MapSpellsPanel from '../../components/map/MapSpellsPanel'
import Dnd5eSpellEffectDetailPanel from '../../components/map/Dnd5eSpellEffectDetailPanel'
import type { CombatLogEntry } from '../../lib/sharedCombatTypes'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import CombatLogEntryCard from '../../pages/maps/CombatLogEntryCard'
import { useLatestCallback } from '../hooks/useLatestCallback'

const Dnd5ePersistentAreaDetailPanel = lazy(
  () => import('../../components/map/Dnd5ePersistentAreaDetailPanel'),
)
const Dnd5eActiveEffectDetailsDialog = lazy(
  () => import('../../components/map/Dnd5eActiveEffectDetailsDialog'),
)

function useOptionalLatestCallback<Args extends unknown[], Result>(
  callback: ((...args: Args) => Result) | undefined,
): ((...args: Args) => Result) | undefined {
  const latestCallback = useLatestCallback((...args: Args) => {
    if (!callback) throw new Error('Map workspace panel callback is unavailable')
    return callback(...args)
  })
  return callback ? latestCallback : undefined
}

const MemoizedInitiativeTracker = memo(InitiativeTracker)

/** Stable initiative boundary shared by the floating and toolbar layouts. */
export function MapWorkspaceInitiativePanel(
  props: ComponentProps<typeof InitiativeTracker>,
) {
  const onScroll = useLatestCallback(props.onScroll)
  const onSelect = useLatestCallback(props.onSelect)
  return <MemoizedInitiativeTracker {...props} onScroll={onScroll} onSelect={onSelect} />
}

const MemoizedCombatLogEntryCard = memo(CombatLogEntryCard)

export interface MapWorkspacePanelsLayerProps {
  combatActive: boolean
  combatLog: readonly CombatLogEntry[]
  combatLogOpen: boolean
  tokens: readonly Token[]
  characters: readonly Character[]
  currentTurnTokenId?: string
  showFloatingInitiative: boolean
  initiativeEntries: ComponentProps<typeof InitiativeTracker>['entries']
  initiativeActiveIndex: number
  initiativeScrollOffset: number
  initiativeRound?: number
  initiativeHitPoints?: ComponentProps<typeof InitiativeTracker>['hpByToken']
  defeatedTokenIds?: string[]
  monsterThinkingTokenId?: string
  onInitiativeScroll: (offset: number) => void
  onInitiativeSelect: (tokenId: string) => void
  onClearCombatLog: () => void
  onOpenCombatLog: () => void
  onCloseCombatLog: () => void
}

/**
 * High-cost map panels live behind one memo boundary. Pointer previews and
 * editing gestures can re-render the workspace without rebuilding the combat
 * log or initiative portraits when their actual inputs are unchanged.
 */
const MemoizedMapWorkspacePanelsLayer = memo(function MapWorkspacePanelsLayer({
  combatActive,
  combatLog,
  combatLogOpen,
  tokens,
  characters,
  currentTurnTokenId,
  showFloatingInitiative,
  initiativeEntries,
  initiativeActiveIndex,
  initiativeScrollOffset,
  initiativeRound,
  initiativeHitPoints,
  defeatedTokenIds,
  monsterThinkingTokenId,
  onInitiativeScroll,
  onInitiativeSelect,
  onClearCombatLog,
  onOpenCombatLog,
  onCloseCombatLog,
}: MapWorkspacePanelsLayerProps) {
  return (
    <>
      {(combatActive || combatLog.length > 0) && (
        <div
          data-testid="combat-log-dock"
          className="absolute bottom-3 right-3 z-[76] flex max-w-[calc(100%-1.5rem)] flex-col items-end"
        >
          {combatLogOpen ? (
            <div className="w-[min(36rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-void-950/90 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <Swords className="h-4 w-4 text-amber-200" />
                <span className="text-sm font-bold text-slate-100">战斗记录</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-300">
                  {combatLog.length}
                </span>
                <button
                  type="button"
                  onClick={onClearCombatLog}
                  className="ml-auto rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-200"
                >
                  清空
                </button>
                <button
                  type="button"
                  onClick={onCloseCombatLog}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-slate-100"
                  title="隐藏战斗 Log"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[28rem] overflow-y-auto px-2 py-2">
                {combatLog.length === 0 ? (
                  <p className="px-2 py-5 text-center text-xs text-slate-500">暂无战斗记录</p>
                ) : (
                  <div className="space-y-1.5">
                    {combatLog.map((entry) => (
                      <MemoizedCombatLogEntryCard
                        key={entry.id}
                        entry={entry}
                        tokens={tokens}
                        characters={characters}
                        currentTurnTokenId={currentTurnTokenId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-testid="combat-log-toggle"
              onClick={onOpenCombatLog}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-void-950/88 px-3 py-2 text-xs font-bold text-slate-200 shadow-xl backdrop-blur-md hover:bg-white/10"
            >
              <Swords className="h-3.5 w-3.5 text-amber-200" />
              Log
              {combatLog.length > 0 && (
                <span className="rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-100">
                  {combatLog.length}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {showFloatingInitiative && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-2">
          <MapWorkspaceInitiativePanel
            entries={initiativeEntries}
            activeIndex={initiativeActiveIndex}
            scrollOffset={initiativeScrollOffset}
            round={initiativeRound}
            hpByToken={initiativeHitPoints}
            defeatedTokenIds={defeatedTokenIds}
            monsterThinkingTokenId={monsterThinkingTokenId}
            onScroll={onInitiativeScroll}
            onSelect={onInitiativeSelect}
          />
        </div>
      )}
    </>
  )
})

function MapWorkspacePanelsLayer(props: MapWorkspacePanelsLayerProps) {
  const onInitiativeScroll = useLatestCallback(props.onInitiativeScroll)
  const onInitiativeSelect = useLatestCallback(props.onInitiativeSelect)
  const onClearCombatLog = useLatestCallback(props.onClearCombatLog)
  const onOpenCombatLog = useLatestCallback(props.onOpenCombatLog)
  const onCloseCombatLog = useLatestCallback(props.onCloseCombatLog)
  return (
    <MemoizedMapWorkspacePanelsLayer
      {...props}
      onInitiativeScroll={onInitiativeScroll}
      onInitiativeSelect={onInitiativeSelect}
      onClearCombatLog={onClearCombatLog}
      onOpenCombatLog={onOpenCombatLog}
      onCloseCombatLog={onCloseCombatLog}
    />
  )
}

const MemoizedMapInventoryPanel = memo(MapInventoryPanel)

export function MapWorkspaceInventoryPanel(
  props: ComponentProps<typeof MapInventoryPanel>,
) {
  const onUseItem = useOptionalLatestCallback(props.onUseItem)
  return <MemoizedMapInventoryPanel {...props} onUseItem={onUseItem} />
}

const MemoizedMapSpellsPanel = memo(MapSpellsPanel)

export function MapWorkspaceSpellsPanel(props: ComponentProps<typeof MapSpellsPanel>) {
  const onSelectedSpellSlotLevelChange = useOptionalLatestCallback(props.onSelectedSpellSlotLevelChange)
  const onArmedSpellModifiersChange = useOptionalLatestCallback(props.onArmedSpellModifiersChange)
  const onCastSpell = useOptionalLatestCallback(props.onCastSpell)
  const onRequestAdjudication = useOptionalLatestCallback(props.onRequestAdjudication)
  const onConfirmSpellTargets = useOptionalLatestCallback(props.onConfirmSpellTargets)
  const onUndoSpellTarget = useOptionalLatestCallback(props.onUndoSpellTarget)
  const onToggleSculptSpellTargets = useOptionalLatestCallback(props.onToggleSculptSpellTargets)
  const onToggleCarefulSpellTargets = useOptionalLatestCallback(props.onToggleCarefulSpellTargets)
  const onToggleHeightenedSpellTarget = useOptionalLatestCallback(props.onToggleHeightenedSpellTarget)
  const onUseSustainedSpellAttack = useOptionalLatestCallback(props.onUseSustainedSpellAttack)
  const onUseSustainedAreaAttack = useOptionalLatestCallback(props.onUseSustainedAreaAttack)
  const onActivatePersistentArea = useOptionalLatestCallback(props.onActivatePersistentArea)
  const onMovePersistentArea = useOptionalLatestCallback(props.onMovePersistentArea)
  const onFocusedSpellChange = useOptionalLatestCallback(props.onFocusedSpellChange)

  return (
    <MemoizedMapSpellsPanel
      {...props}
      onArmedSpellModifiersChange={onArmedSpellModifiersChange}
      onSelectedSpellSlotLevelChange={onSelectedSpellSlotLevelChange}
      onCastSpell={onCastSpell}
      onRequestAdjudication={onRequestAdjudication}
      onConfirmSpellTargets={onConfirmSpellTargets}
      onUndoSpellTarget={onUndoSpellTarget}
      onToggleSculptSpellTargets={onToggleSculptSpellTargets}
      onToggleCarefulSpellTargets={onToggleCarefulSpellTargets}
      onToggleHeightenedSpellTarget={onToggleHeightenedSpellTarget}
      onUseSustainedSpellAttack={onUseSustainedSpellAttack}
      onUseSustainedAreaAttack={onUseSustainedAreaAttack}
      onActivatePersistentArea={onActivatePersistentArea}
      onMovePersistentArea={onMovePersistentArea}
      onFocusedSpellChange={onFocusedSpellChange}
    />
  )
}

const MemoizedEnemyDetailPanel = memo(EnemyDetailPanel)

export function MapWorkspaceEnemyDetailPanel(
  props: ComponentProps<typeof EnemyDetailPanel>,
) {
  const onSetHitPoints = useOptionalLatestCallback(props.onSetHitPoints)
  const onConditionsChange = useOptionalLatestCallback(props.onConditionsChange)
  const onMonsterBerserkChange = useOptionalLatestCallback(props.onMonsterBerserkChange)
  const onSelectMonsterAction = useOptionalLatestCallback(props.onSelectMonsterAction)
  const onSelectMonsterContinuation = useOptionalLatestCallback(props.onSelectMonsterContinuation)
  const onClose = useLatestCallback(props.onClose)
  return (
    <MemoizedEnemyDetailPanel
      {...props}
      onSetHitPoints={onSetHitPoints}
      onConditionsChange={onConditionsChange}
      onMonsterBerserkChange={onMonsterBerserkChange}
      onSelectMonsterAction={onSelectMonsterAction}
      onSelectMonsterContinuation={onSelectMonsterContinuation}
      onClose={onClose}
    />
  )
}

const MemoizedCharacterDetailPanel = memo(CharacterDetailPanel)

export function MapWorkspaceCharacterDetailPanel(
  props: ComponentProps<typeof CharacterDetailPanel>,
) {
  const onSetHitPoints = useLatestCallback(props.onSetHitPoints)
  const onConditionsChange = useOptionalLatestCallback(props.onConditionsChange)
  const onRemoveFromMap = useOptionalLatestCallback(props.onRemoveFromMap)
  const onClose = useLatestCallback(props.onClose)
  return (
    <MemoizedCharacterDetailPanel
      {...props}
      onSetHitPoints={onSetHitPoints}
      onConditionsChange={onConditionsChange}
      onRemoveFromMap={onRemoveFromMap}
      onClose={onClose}
    />
  )
}

const MemoizedSpellEffectDetailPanel = memo(Dnd5eSpellEffectDetailPanel)

export function MapWorkspaceSpellEffectDetailPanel(
  props: ComponentProps<typeof Dnd5eSpellEffectDetailPanel>,
) {
  const onDelete = useLatestCallback(props.onDelete)
  const onClose = useLatestCallback(props.onClose)
  return <MemoizedSpellEffectDetailPanel {...props} onDelete={onDelete} onClose={onClose} />
}

const MemoizedPersistentAreaDetailPanel = memo(Dnd5ePersistentAreaDetailPanel)

export function MapWorkspacePersistentAreaDetailPanel(
  props: ComponentProps<typeof Dnd5ePersistentAreaDetailPanel>,
) {
  const onDelete = useLatestCallback(props.onDelete)
  const onClose = useLatestCallback(props.onClose)
  return <MemoizedPersistentAreaDetailPanel {...props} onDelete={onDelete} onClose={onClose} />
}

const MemoizedActiveEffectDetailsDialog = memo(Dnd5eActiveEffectDetailsDialog)

export function MapWorkspaceActiveEffectDetailsDialog(
  props: ComponentProps<typeof Dnd5eActiveEffectDetailsDialog>,
) {
  const onClose = useLatestCallback(props.onClose)
  return <MemoizedActiveEffectDetailsDialog {...props} onClose={onClose} />
}

export default MapWorkspacePanelsLayer
