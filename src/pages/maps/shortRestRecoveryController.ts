import { SHORT_REST_RECOVERY_RESOURCE, validShortRestRecoveryJournal } from '../../../shared/short-rest-recovery.mjs'
import type { Dnd5eShortRestRecoveryCommand } from '../../rulesets/dnd5e/shortRestRecoveryAuthority'
import { dnd5eCharacterClassLevel } from '../../rulesets/dnd5e/multiclass'
import { dnd5eBardSongOfRestDie } from '../../rulesets/dnd5e/classes'
import { dnd5eCombatantCanHearSource } from '../../rulesets/dnd5e/audibility'
import { readCampaignInteractionContext } from './campaignInteractionController'
import { publishDnd5eShortRestRecovery } from './publishShortRestRecovery'
import * as shared from '../../composition/browserSharedRoomResources'
import { getRoomSession } from '../../lib/roomSession'

/** Called inside the Host's existing request queue; do not acquire its scheduler twice. */
export async function runShortRestRecovery(input: {
  command: Dnd5eShortRestRecoveryCommand
  authenticatedMemberId?: string
  roll(sides: number, label: string): Promise<number>
  confirmSong(bardName: string, recipientName: string): Promise<boolean>
}) {
  const session = getRoomSession()
  if (session && session.role !== 'dm') throw Error('rest-host-required')
  const guard = () => {
    const current = getRoomSession()
    if (current?.roomId !== session?.roomId || (current && current.role !== 'dm')) throw Error('rest-room-changed')
  }
  const [context, rawJournal] = await Promise.all([
    readCampaignInteractionContext(input.command.mapId),
    shared.loadSharedResource<unknown>(SHORT_REST_RECOVERY_RESOURCE),
  ])
  guard()
  if (rawJournal != null && !validShortRestRecoveryJournal(rawJournal)) throw Error('invalid-rest-journal')
  const journal = rawJournal ?? { schemaVersion: 1 as const, receipts: [] }
  const revision = rawJournal == null ? 0 : (rawJournal as { _sync?: { revision?: number } })._sync?.revision
  if (!Number.isSafeInteger(revision) || revision! < 0) throw Error('rest-journal-revision-required')
  const hero = context.characters.find(row => row.id === input.command.characterId)
  if (!hero || (session ? !input.authenticatedMemberId || hero.roomMemberId !== input.authenticatedMemberId
    : hero.roomMemberId != null || input.authenticatedMemberId != null)) throw Error('character-owner-mismatch')
  const prior = journal.receipts.find(row => row.command.id === input.command.id)
  const pool = hero.hitPointDice?.[input.command.poolIndex]
  if (!prior && (!pool || pool.current !== input.command.expectedPoolCurrent)) throw Error('hit-dice-conflict')
  let songOfRestRoll: number | undefined
  const eligible: string[] = []
  const bardId = input.command.songOfRestBardId
  if (bardId && !prior) {
    const bard = context.characters.find(row => row.id === bardId)
    const listener = context.state.combatants[input.command.tokenId]
    const bardToken = context.map.tokens.find(row => row.characterId === bardId)
    const source = bardToken && context.state.combatants[bardToken.id]
    const level = bard ? dnd5eCharacterClassLevel(bard, 'bard') : 0
    if (!bard || !listener || !source || level < 2 || source.currentHp <= 0 ||
      source.conditions.some(condition => ['incapacitated', 'unconscious'].includes(condition)) ||
      !dnd5eCombatantCanHearSource(listener, source) || !await input.confirmSong(bard.name, hero.name)) throw Error('song-of-rest-unavailable')
    guard()
    eligible.push(bardId)
    songOfRestRoll = await input.roll(dnd5eBardSongOfRestDie(level), '休憩曲')
  }
  const hitDieRoll = prior ? 1 : await input.roll(pool!.sides, '短休生命骰')
  guard()
  return publishDnd5eShortRestRecovery({ authority: {
    command: input.command, controlledCharacterIds: [hero.id], characters: context.characters,
    advances: context.clock.advances, map: context.map, round: context.state.round,
    worldMinute: context.clock.worldMinute, combatActive: context.state.active, geometry: context.geometry,
    journal, hitDieRoll, songOfRestRoll, songOfRestEligibleBardIds: eligible,
  }, maps: context.maps, characterSelectedId: context.characterSelectedId, mapSelectedId: context.mapSelectedId,
    updatedAt: Date.now(), expectedRevisions: { characters: context.expectedRevisions.characters,
      maps: context.expectedRevisions.maps, [SHORT_REST_RECOVERY_RESOURCE]: revision! },
    readRevisions: { ...context.readRevisions, 'campaign-time': context.expectedRevisions['campaign-time'] },
    gateway: { saveResourcesAtomically: (writes, options) => { guard(); return shared.saveSharedResourcesAtomically(writes, options) },
      loadResource: name => { guard(); return shared.loadSharedResource(name) } },
  })
}
