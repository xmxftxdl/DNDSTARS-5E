import { useEffect } from 'react'
import { browserSharedRoomService } from '../composition/browserSharedRoomService'
import { useNavigate } from 'react-router-dom'
import {
  COMBAT_PLAYBACK_EVENT_MAX_AGE_MS,
  shouldConsumeBackgroundPlayerActionAck,
  shouldSilentlyConsumeDiceEvent,
} from '../lib/combatBackgroundAcknowledgement'
import { combatPlaybackIds, combatPlaybackScope } from '../lib/combatPlaybackLedger'
import type {
  Mode,
  SharedDiceEventsState,
  SharedDiceState,
  SharedPlayerActionAckState,
  SharedRollRequestEvent,
} from '../lib/sharedCombatTypes'
import type { RoomSession } from '../lib/roomSession'
import { useCharacterStore } from '../store/characters'
import { useMapStore } from '../store/maps'
import {
  isPlayerDiceRollRequestForClient,
  rememberPendingPlayerDiceRollRequest,
} from '../pages/maps/playerDiceRoll'
import { getAssignedPlayerCharacterId, playerViewCharacters } from '../lib/playerView'

export interface CampaignCombatBackgroundSystemProps {
  session: RoomSession
  active: boolean
}

/**
 * Receives combat acknowledgements while the campaign user is on characters,
 * spellbook, communications, settings, or another non-map page. Authoritative
 * logs remain server-persisted, while presentation IDs are consumed without
 * mounting dice, banners, or spell animations.
 */
export default function CampaignCombatBackgroundSystem({
  session,
  active,
}: CampaignCombatBackgroundSystemProps) {
  const navigate = useNavigate()
  const mode: Mode = session.role === 'dm' ? 'dm' : 'player'
  const scope = combatPlaybackScope({
    roomId: session.roomId,
    memberId: session.memberId,
    mode,
  })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const seenDiceIds = combatPlaybackIds(scope, 'dice')
    const seenRollRequestIds = combatPlaybackIds(scope, 'roll-request')

    const consumeDice = (event?: SharedDiceState | null) => {
      if (cancelled || !shouldSilentlyConsumeDiceEvent({
        event,
        mode,
        now: Date.now(),
        seenIds: seenDiceIds,
      })) return
      // Mark rolling announcements too. Their terminal result normally reuses
      // the same ID and must remain silent if the user returns to the map before
      // the roll finishes.
      seenDiceIds.add(event!.id)
    }

    const loadDice = async () => {
      const eventState = await browserSharedRoomService.loadSharedResource<SharedDiceEventsState>('dice-events')
      if (cancelled) return
      if (eventState?.events?.length) {
        for (const event of eventState.events) consumeDice(event)
        return
      }
      consumeDice(await browserSharedRoomService.loadSharedResource<SharedDiceState>('dice'))
    }

    const remoteMode = mode === 'dm' ? 'player' : 'dm'
    const stopRollRequests = browserSharedRoomService.subscribeSharedEvent<SharedRollRequestEvent>(
      `dice-roll-request-${remoteMode}-to-${mode}`,
      (event) => {
        if (
          !active || cancelled || !event?.requestId || event.sourceMode === mode ||
          Date.now() - event.updatedAt > COMBAT_PLAYBACK_EVENT_MAX_AGE_MS
        ) return
        // Preserve an actionable request before routing its controlling client
        // to the map. The map then opens the dice tray and returns the result.
        if (event.delivery === 'player-roll-request') {
          const assignedCharacterId = session.role === 'player'
            ? getAssignedPlayerCharacterId(session.slot)
            : null
          const controlledCharacterIds = new Set([
            ...(assignedCharacterId ? [assignedCharacterId] : []),
            ...playerViewCharacters(useCharacterStore.getState().characters, {
              slot: session.slot,
              assignedCharacterId,
            }).map((character) => character.id),
          ])
          if (isPlayerDiceRollRequestForClient({
            event,
            mode,
            spectator: session.role === 'spectator',
            controlledCharacterIds,
          })) {
            rememberPendingPlayerDiceRollRequest(event)
            navigate(`/campaign/${session.campaignId ?? 'local'}/maps`)
          }
          return
        }
        seenRollRequestIds.add(event.requestId)
      },
    )
    const stopDice = browserSharedRoomService.subscribeSharedResourceInvalidation(
      'dice-events',
      loadDice,
      { recoveryMs: 2_000, recoverWhenHidden: true, refreshOnVisibilityRestore: true },
    )
    void loadDice().catch((error) => console.warn('[combat-background] dice ACK failed', error))

    return () => {
      cancelled = true
      stopRollRequests()
      stopDice()
    }
  }, [active, mode, navigate, scope, session])

  useEffect(() => {
    if (!active || mode !== 'player') return
    let cancelled = false
    const seenAckIds = combatPlaybackIds(scope, 'player-action-ack')

    const consumeAck = async (ack?: SharedPlayerActionAckState | null) => {
      if (cancelled || !shouldConsumeBackgroundPlayerActionAck({
        ack,
        roomMemberId: session.memberId,
        seenIds: seenAckIds,
      })) return
      const acceptedAck = ack!
      seenAckIds.add(acceptedAck.id)
      if (acceptedAck.status !== 'accepted') return
      // The page-local pending lock is gone after navigation, but the accepted
      // action still needs to hydrate the same authoritative map/character state
      // the Maps page would have loaded before releasing that lock.
      await Promise.all([
        useMapStore.getState().loadShared(),
        useCharacterStore.getState().loadShared(),
      ])
    }

    const onAck = (ack: SharedPlayerActionAckState) => {
      void consumeAck(ack).catch((error) => {
        console.error('[combat-background] player action ACK sync failed', error)
      })
    }
    const stopAckEvents = browserSharedRoomService.subscribeSharedEvent<SharedPlayerActionAckState>(
      'player-action-dm-to-player',
      onAck,
    )
    const loadAck = async () => consumeAck(
      await browserSharedRoomService.loadSharedResource<SharedPlayerActionAckState>('player-action-ack'),
    )
    const stopAckResource = browserSharedRoomService.subscribeSharedResourceInvalidation(
      'player-action-ack',
      loadAck,
      { recoveryMs: 2_000, recoverWhenHidden: true, refreshOnVisibilityRestore: true },
    )
    void loadAck().catch((error) => console.warn('[combat-background] persisted action ACK failed', error))

    return () => {
      cancelled = true
      stopAckEvents()
      stopAckResource()
    }
  }, [active, mode, scope, session.memberId])

  return null
}
