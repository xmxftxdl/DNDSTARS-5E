import type { Dnd5eCombatActionCommand, Dnd5eCombatActionDescriptorV1 } from '../../lib/dnd5eCombatActionDescriptors'
import { canSubmitPlayerSpellAction } from '../../lib/playerActionAuthorityRouter'
import type { PendingPlayerActionLock } from '../../lib/playerActionSync'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { dnd5eEffectiveWalkingSpeed } from '../../rulesets/dnd5e/classes'
import { createDnd5eTurnEconomyCounts } from '../../rulesets/dnd5e/turnEconomy'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import PlayerCombatHotbar from './PlayerCombatHotbar'
import { playerMapMovablePersistentAreas, playerMapSustainedAreaControls } from './playerMapPersistentAreas'

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
  selectedSpellSlotLevels?: Readonly<Record<string, number>>
  onSelectedSpellSlotLevelChange?: (actionId: string, slotLevel: number) => void
  onCommand: (command: Dnd5eCombatActionCommand, descriptor: Dnd5eCombatActionDescriptorV1) => void
  onUnavailable?: (descriptor: Dnd5eCombatActionDescriptorV1) => void
}

export default function PlayerMapSpellHotbar(props: PlayerMapSpellHotbarProps) {
  const character = props.combatActive ? props.activeCharacter : props.playerCharacter
  if (props.isDM || !character) return null
  const token = props.map.tokens.find((candidate) =>
    candidate.type === 'player' && candidate.characterId === character.id,
  )
  const turnEconomy = character.id === props.activeCharacter?.id
    ? props.activeTurnEconomy
    : token
      ? createDnd5eTurnEconomyCounts(
          `exploration:${props.map.id}:${token.id}`,
          dnd5eEffectiveWalkingSpeed(character),
        )
      : createDnd5eTurnEconomyCounts('inactive')
  const canAct = canSubmitPlayerSpellAction({
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
  const movablePersistentAreas = playerMapMovablePersistentAreas(props.map, character)
  const sustainedAreaControls = playerMapSustainedAreaControls(props.map, character)
  const hunterMarkTargetId = character.dnd5eCombatState?.huntersMarkTargetId
  const hunterMarkTarget = hunterMarkTargetId
    ? props.map.tokens.find((candidate) => candidate.id === hunterMarkTargetId)
    : undefined
  const hunterMarkTransferAvailable = !!hunterMarkTargetId &&
    character.concentrating === true &&
    character.dnd5eCombatState?.concentrationSpellId === 'hunters-mark' &&
    (!hunterMarkTarget || (hunterMarkTarget.hp != null && hunterMarkTarget.hp <= 0))

  return (
    <div className="pointer-events-none absolute bottom-3 left-28 right-3 z-40 flex justify-center">
      <PlayerCombatHotbar
        key={`${props.combatActive ? 'combat' : 'exploration'}:${character.id}`}
        mode={props.combatActive ? 'combat' : 'exploration'}
        character={character}
        canAct={canAct}
        pending={!!props.pendingAction}
        turnEconomy={turnEconomy}
        activeActionId={props.activeActionId}
        grappleEscapes={props.combatActive ? props.grappleEscapes : []}
        movablePersistentAreas={movablePersistentAreas}
        sustainedAreaControls={sustainedAreaControls}
        hunterMarkTransferAvailable={hunterMarkTransferAvailable}
        selectedSpellSlotLevels={props.selectedSpellSlotLevels}
        onSelectedSpellSlotLevelChange={props.onSelectedSpellSlotLevelChange}
        onCommand={props.onCommand}
        onUnavailable={props.onUnavailable}
      />
    </div>
  )
}
