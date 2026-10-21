import { planDnd5eMapResultApplication } from '../../rulesets/dnd5e/mapBridge'
import { projectDnd5eCreatureSensorCastingTarget, refreshDnd5eCreatureSensorCasting } from '../../rulesets/dnd5e/creatureSensorCasting'
import { planDnd5eCreatureSensorCastingPublication } from '../../rulesets/dnd5e/creatureSensorResolution'
import type { Dnd5eCreatureSensorTargetReceipt } from '../../rulesets/dnd5e/creatureSensorTarget'
import { createRoomLongCastingOwner } from './roomLongCastingOwner'
import { armDnd5eLongCasting, invalidateDnd5eLongCasting, prepareDnd5eLongCastingCombatTurn, armDnd5eLongCastingCombatTurn, dnd5eLongCastingCanComplete, continueDnd5eLongCastingOutsideCombat, continueDnd5eLongCastingInsideCombat } from '../../rulesets/dnd5e/longCastingContinuity'
import { prepareDnd5ePluginRestFeatureCasting, refreshDnd5ePluginRestFeatureCasting,
  type PreparedDnd5ePluginFeatureAction } from '../../rulesets/dnd5e/pluginFeatureAction'

type Start = Extract<ReturnType<typeof prepareDnd5ePluginRestFeatureCasting>, { ok: true }>
type Current = Omit<Parameters<typeof refreshDnd5ePluginRestFeatureCasting>[0], 'prepared' | 'castingReceipt' | 'binding'>

/** The publisher must confirm the authoritative start transaction before a
 * local receipt is armed. Removing a session never reconstructs one from JSON. */
export async function startRestFeatureCastingSession(input: {
  prepared: PreparedDnd5ePluginFeatureAction;
  start: Start;
  creatureSensor?: Dnd5eCreatureSensorTargetReceipt;
  createOwner?: typeof createRoomLongCastingOwner;
  publish: (application: Start['application']) => Promise<boolean>;
  read: () => Current;
  subscribe: (observe: () => void) => () => void;
}) {
  const { start, prepared } = input
  let owner: ReturnType<typeof createRoomLongCastingOwner> | undefined
  let closed = false
  let unsubscribe: (() => void) | undefined
  const close = () => {
    if (closed) return
    closed = true
    invalidateDnd5eLongCasting(start.castingReceipt)
    const stop = unsubscribe
    unsubscribe = undefined
    stop?.()
    if (owner) void owner.close().catch(() => undefined)
  }
  const current = () => {
    if (closed) return { ok: false as const, reason: 'rest-casting-interrupted' }
    const read = input.read()
    const common = { ...read, prepared, castingReceipt: start.castingReceipt, binding: start.castingContinuation.binding.casting }
    const refreshed = input.creatureSensor
      ? refreshDnd5eCreatureSensorCasting({ ...common, room: { maps: read.maps, characters: read.characters }, receipt: input.creatureSensor })
      : { ...refreshDnd5ePluginRestFeatureCasting(common), projection: undefined }
    if (!refreshed.ok) close()
    return refreshed
  }
  const ready = async () => {
    if (closed || !owner || !await owner.assertOwned()) {
      close()
      return { ok: false as const, reason: 'casting-owner-lost' }
    }
    return current()
  }
  let maintaining = false
  let mode = { active: start.state.active, combatId: start.state.combatId }
  const maintain = async (publishTurn: (application: Start['application'], state: Start['state']) => Promise<boolean>) => {
    if (maintaining || closed) return false
    maintaining = true
    try {
      const before = await ready()
      if (!before.ok) return false
      const proposal = prepareDnd5eLongCastingCombatTurn(start.castingReceipt,
        start.castingContinuation.binding.casting, before.prepared.state)
      if (!proposal) { current(); return false }
      let application = planDnd5eMapResultApplication({ map: before.prepared.map, characters: before.prepared.characters,
        state: proposal.state, characterIdByCombatantId: before.prepared.characterIdByCombatantId })
      if (before.projection) {
        const read = input.read()
        const projected = planDnd5eCreatureSensorCastingPublication({ projection: before.projection,
          room: { maps: read.maps, characters: read.characters }, application })
        if (!projected.ok) { close(); return false }
        application = projected.application
      }
      if (!await publishTurn(application, proposal.state)) { close(); return false }
      const after = await ready()
      if (!after.ok || !armDnd5eLongCastingCombatTurn(proposal, start.castingContinuation.binding.casting, after.prepared.state)) {
        close(); return false
      }
      return true
    } catch (error) { close(); throw error }
    finally { maintaining = false }
  }
  const transition = async () => {
    if (maintaining || closed) return false
    maintaining = true
    try {
      const fresh = await ready()
      if (!fresh.ok) return false
      const state = fresh.prepared.state
      if (state.active === mode.active) {
        if (!state.active || state.combatId === mode.combatId) return true
        close(); return false
      }
      const minute = state.combatants[prepared.actorToken.id]?.campaignWorldMinute
      const moved = minute == null ? undefined : state.active
        ? continueDnd5eLongCastingInsideCombat(start.castingReceipt, start.castingContinuation.binding.casting, state, minute)
        : continueDnd5eLongCastingOutsideCombat(start.castingReceipt, start.castingContinuation.binding.casting, state, minute)
      if (!moved) { close(); return false }
      mode = { active: state.active, combatId: state.combatId }
      return true
    } catch (error) { close(); throw error }
    finally { maintaining = false }
  }
  const completion = async () => {
    const fresh = await ready()
    if (!fresh.ok) return fresh
    return dnd5eLongCastingCanComplete(start.castingReceipt, start.castingContinuation.binding.casting, fresh.prepared.state)
      ? fresh : { ok: false as const, reason: 'casting-incomplete' }
  }
  const prepareCommit = async () => {
    if (!(await completion()).ok) return false
    const stop = unsubscribe
    unsubscribe = undefined
    stop?.()
    return true
  }
  try {
    // The server grants ownership only for the durable casting marker. Publish
    // with the caller's revision guard first; acquire before arming continuity.
    owner = (input.createOwner ?? createRoomLongCastingOwner)(start.castingContinuation.binding.casting, () => close())
    let application = start.application
    if (input.creatureSensor) {
      const read = input.read(), room = { maps: read.maps, characters: read.characters }
      const projected = projectDnd5eCreatureSensorCastingTarget({ prepared, room, receipt: input.creatureSensor })
      if (!projected.ok) { close(); return undefined }
      const publication = planDnd5eCreatureSensorCastingPublication({ projection: projected.projection, room, application })
      if (!publication.ok) { close(); return undefined }
      application = publication.application
    }
    if (!await input.publish(application)) { close(); return undefined }
    if (closed || !await owner.start() || closed) { close(); return undefined }
    const fresh = await ready()
    if (!fresh.ok || !armDnd5eLongCasting(start.castingReceipt, start.castingContinuation.binding.casting,
      fresh.prepared.state.combatants[prepared.actorToken.id])) { close(); return undefined }
    const stop = input.subscribe(() => { current() })
    // A subscription may synchronously report an already interrupted state.
    if (closed) { stop(); return undefined }
    unsubscribe = stop
    if (!current().ok) return undefined
    return { current, ready, completion, maintain, transition, prepareCommit, close, castingContinuation: start.castingContinuation }
  } catch (error) {
    close()
    throw error
  }
}
