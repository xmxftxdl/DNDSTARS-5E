import type {
  Dnd5eCombatActionCommand,
  Dnd5eCombatActionDescriptorV1,
  Dnd5eCombatSpellModifier,
} from '../../lib/dnd5eCombatActionDescriptors'
import {
  canSubmitPlayerSpellAction,
  canSubmitPlayerTriggeredReactionSpellAction,
} from '../../lib/playerActionAuthorityRouter'
import type { PendingPlayerActionLock } from '../../lib/playerActionSync'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { dnd5eEffectiveWalkingSpeed } from '../../rulesets/dnd5e/classes'
import { dnd5eConditionIncapacitated } from '../../rulesets/dnd5e/conditions'
import { dnd5eActivePreventsActions } from '../../rulesets/dnd5e/activeEffects'
import { createDnd5eTurnEconomyCounts } from '../../rulesets/dnd5e/turnEconomy'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import PlayerCombatHotbar from './PlayerCombatHotbar'
import {
  playerMapGrantedActivityControls,
  playerMapMovablePersistentAreas,
  playerMapSustainedAreaControls,
} from './playerMapPersistentAreas'
import { resolvePlayerMapSpellHotbarCharacter } from './playerMapSpellHotbarCharacter'

interface PlayerMapSpellHotbarProps {
  isDM: boolean
  combatActive: boolean
  mode?: 'dm' | 'player' | null
  map: BattleMap
  activeCharacter?: Character | null
  playerCharacter?: Character | null
  turnCharacter?: Character | null
  currentInitiativeToken?: Token
  playerCombatLocked: boolean
  pendingAction?: PendingPlayerActionLock | null
  characters: Character[]
  activeTurnEconomy: Dnd5eTurnEconomyCounts
  activeActionId?: string
  grappleEscapes?: readonly { grapplerTokenId: string; grapplerLabel: string; dc?: number }[]
  armedSpellModifiers?: readonly Dnd5eCombatSpellModifier[]
  onArmedSpellModifiersChange?: (modifiers: readonly Dnd5eCombatSpellModifier[]) => void
  selectedSpellSlotLevels?: Readonly<Record<string, number>>
  triggeredReactionSpellIds?: readonly string[]
  onSelectedSpellSlotLevelChange?: (actionId: string, slotLevel: number) => void
  onCommand: (command: Dnd5eCombatActionCommand, descriptor: Dnd5eCombatActionDescriptorV1) => void
  onUnavailable?: (descriptor: Dnd5eCombatActionDescriptorV1) => void
}

export default function PlayerMapSpellHotbar(props: PlayerMapSpellHotbarProps) {
  // The map bar belongs to the assigned player character, never to the
  // combatant whose turn happens to be active. During an enemy turn there is
  // no player-owned activeCharacter; deriving the bar from it made the whole
  // UI disappear and also hid spell-reaction entry points such as Counterspell.
  // `canAct` below remains the authority boundary for ordinary off-turn casts.
  const character = resolvePlayerMapSpellHotbarCharacter(props)
  if (props.isDM || !character) return null
  const token = props.currentInitiativeToken?.characterId === character.id
    ? props.currentInitiativeToken
    : props.map.tokens.find((candidate) =>
        candidate.type === 'player' && candidate.characterId === character.id && !candidate.dnd5eSimulacrum,
      )
  const turnEconomy = character.id === props.activeCharacter?.id ||
    ((props.triggeredReactionSpellIds?.length ?? 0) > 0 && character.id === props.playerCharacter?.id)
    ? props.activeTurnEconomy
    : token
      ? createDnd5eTurnEconomyCounts(
          `exploration:${props.map.id}:${token.id}`,
          dnd5eEffectiveWalkingSpeed(character),
        )
      : createDnd5eTurnEconomyCounts('inactive')
  const actionsPrevented = dnd5eConditionIncapacitated(character) ||
    dnd5eActivePreventsActions(character.dnd5eCombatState?.activeEffects)
  const canAct = !actionsPrevented && canSubmitPlayerSpellAction({
    activeMap: props.map,
    mode: props.mode,
    playerCombatLocked: props.playerCombatLocked,
    combatActive: props.combatActive,
    combatActiveSnapshot: props.combatActive,
    turnCharacter: props.turnCharacter,
    currentInitiativeToken: props.currentInitiativeToken,
    pendingAction: props.pendingAction,
    playerCharacter: props.playerCharacter,
    characters: props.characters,
  })
  const canUseTriggeredReactions = !actionsPrevented &&
    (props.triggeredReactionSpellIds?.length ?? 0) > 0 &&
    canSubmitPlayerTriggeredReactionSpellAction({
      activeMap: props.map,
      mode: props.mode,
      combatActive: props.combatActive,
      combatActiveSnapshot: props.combatActive,
      pendingAction: props.pendingAction,
      playerCharacter: props.playerCharacter,
      characters: props.characters,
    })
  const movablePersistentAreas = playerMapMovablePersistentAreas(props.map, character)
  const mapWeather = mapGeometryRuntimeForMap(props.map.id)?.weather
  const sustainedAreaControls = playerMapSustainedAreaControls(props.map, character)
  const persistentAreaActivityControls = playerMapGrantedActivityControls(props.map, character)
  const hunterMarkTargetId = character.dnd5eCombatState?.huntersMarkTargetId
  const hunterMarkTarget = hunterMarkTargetId
    ? props.map.tokens.find((candidate) => candidate.id === hunterMarkTargetId)
    : undefined
  const hunterMarkTransferAvailable = !!hunterMarkTargetId &&
    character.concentrating === true &&
    character.dnd5eCombatState?.concentrationSpellId === 'hunters-mark' &&
    (!hunterMarkTarget || (hunterMarkTarget.hp != null && hunterMarkTarget.hp <= 0))

  return (
    <div className="pointer-events-none absolute bottom-3 left-28 right-3 z-40 flex flex-col items-center gap-2">
      <PlayerCombatHotbar
        key={`${props.combatActive ? 'combat' : 'exploration'}:${character.id}`}
        mode={props.combatActive ? 'combat' : 'exploration'}
        character={character}
        mapWeather={mapWeather}
        canAct={canAct}
        canUseTriggeredReactions={canUseTriggeredReactions}
        pending={!!props.pendingAction}
        turnEconomy={turnEconomy}
        activeActionId={props.activeActionId}
        grappleEscapes={props.combatActive ? props.grappleEscapes : []}
        armedSpellModifiers={props.armedSpellModifiers}
        onArmedSpellModifiersChange={props.onArmedSpellModifiersChange}
        movablePersistentAreas={movablePersistentAreas}
        sustainedAreaControls={sustainedAreaControls}
        persistentAreaActivityControls={persistentAreaActivityControls}
        hunterMarkTransferAvailable={hunterMarkTransferAvailable}
        selectedSpellSlotLevels={props.selectedSpellSlotLevels}
        triggeredReactionSpellIds={props.triggeredReactionSpellIds}
        onSelectedSpellSlotLevelChange={props.onSelectedSpellSlotLevelChange}
        onCommand={props.onCommand}
        onUnavailable={props.onUnavailable}
      />
    </div>
  )
}
