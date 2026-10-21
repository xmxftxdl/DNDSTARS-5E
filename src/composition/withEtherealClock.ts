import type { Character } from '../types/character'
import type { Dnd5eActiveEffectInstance } from '../rulesets/dnd5e/activeEffects'
import type { SharedRoomGatewayPort, SharedResourceTransactionWrite, SharedResourceWriteOptions } from '../ports/sharedRoomGateway'

type Versioned = { _sync?: { revision?: number } }
type Roster = Versioned & { characters: Character[] }
type Clock = Versioned & { worldMinute: number; worldSecondRemainder?: number }
const hasPhase = (data: unknown) => (data as Roster | undefined)?.characters?.some(character =>
  character.dnd5eCombatState?.activeEffects?.some(effect => rounds(effect) != null)) === true
function rounds(effect: Dnd5eActiveEffectInstance): number | undefined {
  if (effect.modifiers?.planarPhase?.plane !== 'ethereal') return undefined
  return effect.duration.type === 'until-turn-boundary' ? 1 :
    effect.duration.type === 'rounds' || effect.duration.type === 'concentration' ? effect.duration.remainingRounds : undefined
}

/** Capture game time at publication, never browser wall time or a player-supplied deadline. */
export function withEtherealClock(gateway: SharedRoomGatewayPort): SharedRoomGatewayPort {
  const commit = async (writes: readonly SharedResourceTransactionWrite[],
    options?: SharedResourceWriteOptions & { transactionId?: string }) => {
    const write = writes.find(entry => entry.name === 'characters')
    const roster = write?.data as Roster | undefined
    if (!hasPhase(roster))
      return gateway.saveResourcesAtomically(writes, options)
    const [previous, storedClock] = await Promise.all([
      gateway.loadResource<Roster>('characters'), gateway.loadResource<Clock>('campaign-time'),
    ])
    const clockWrite = writes.find(entry => entry.name === 'campaign-time')
    if (!previous && (write!.expectedRevision ?? gateway.getRevisionWatermark('characters')) > 0)
      throw Error('ethereal-clock-roster-unavailable')
    const clock = (clockWrite?.data as Clock | undefined) ?? storedClock
    if (!clock || !Number.isSafeInteger(clock.worldMinute) || clock.worldMinute < 0 ||
      (clock.worldSecondRemainder != null && (!Number.isInteger(clock.worldSecondRemainder) ||
        clock.worldSecondRemainder < 0 || clock.worldSecondRemainder > 59))) throw Error('ethereal-clock-unavailable')
    const now = clock.worldMinute * 60 + (clock.worldSecondRemainder ?? 0)
    const characters = roster!.characters.map(character => {
      const effects = character.dnd5eCombatState?.activeEffects
      if (!effects?.some(effect => rounds(effect) != null)) return character
      const old = previous?.characters.find(entry => entry.id === character.id)?.dnd5eCombatState?.activeEffects ?? []
      return { ...character, dnd5eCombatState: { ...character.dnd5eCombatState, activeEffects: effects.map(effect => {
        const duration = rounds(effect)
        if (duration == null) return effect
        if (!Number.isSafeInteger(duration) || duration <= 0 || !Number.isSafeInteger(now + duration * 6))
          throw Error('ethereal-clock-duration-invalid')
        const prior = old.find(entry => entry.id === effect.id && entry.appliedAt === effect.appliedAt)
        const deadline = prior && rounds(prior) === duration && Number.isSafeInteger(prior.explorationExpiresAtWorldSecond) &&
          prior.explorationExpiresAtWorldSecond! >= 0
          ? prior.explorationExpiresAtWorldSecond! : now + duration * 6
        return { ...effect, explorationExpiresAtWorldSecond: deadline }
      }) } }
    })
    const readRevisions = { ...options?.readRevisions }
    if (!clockWrite) readRevisions['campaign-time'] ??= storedClock?._sync?.revision ?? 0
    return gateway.saveResourcesAtomically(writes.map(entry => entry === write
      ? { ...entry, expectedRevision: entry.expectedRevision ?? previous?._sync?.revision ?? 0, data: { ...roster, characters } } : entry),
    { ...options, readRevisions })
  }
  return { ...gateway, saveResourcesAtomically: commit,
    saveResource: async (name, data, options) => {
      if (name !== 'characters' || !hasPhase(data)) return gateway.saveResource(name, data, options)
      await commit([{ name, data, expectedRevision: gateway.getRevisionWatermark(name) }], options)
    },
    saveResourceWithResult: async (name, data, options) => {
      if (name !== 'characters' || !hasPhase(data)) return gateway.saveResourceWithResult(name, data, options)
      const result = await commit([{ name, data, expectedRevision: gateway.getRevisionWatermark(name) }], options)
      return { status: 'saved', revision: result.revisions[name] }
    },
  }
}
