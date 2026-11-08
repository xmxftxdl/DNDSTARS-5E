/** Source-verified, pure Pact of the Blade state machine. Host facts and command
 * arguments are separate: commands name inventory instances, never permissions.
 * PHB local PDF pages 107–108; XGE local PDF page 58.
 */
export const PACT_WEAPON_CORE_RULES = Object.freeze({ bindingRitualSeconds: 3600, separationSeconds: 60, separationFeet: 5 })
const rangedForms = new Set(['shortbow', 'longbow', 'light-crossbow', 'heavy-crossbow'])
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 320
const time = value => Number.isSafeInteger(value) && value >= 0
const clone = value => structuredClone(value)

export function emptyPactWeaponState(ownerId) {
  if (!id(ownerId)) throw Error('invalid-owner')
  return { schemaVersion: 1, ownerId, revision: 0 }
}
export function normalizePactWeaponState(value) {
  if (!value || value.schemaVersion !== 1 || !id(value.ownerId) || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
    (value.lastHostSecond != null && !time(value.lastHostSecond))) return undefined
  const b = value.binding, r = value.ritual
  if (b && (!id(b.inventoryInstanceId) || !id(b.weaponBaseId) || !['summoned', 'ritually-bound-magic'].includes(b.origin) ||
    !['present', 'dismissed'].includes(b.status) || (b.awaySinceHostSecond != null && !time(b.awaySinceHostSecond)))) return undefined
  if (r && (!['binding', 'release'].includes(r.kind) || !id(r.inventoryInstanceId) || !id(r.ritualId) || !time(r.startedHostSecond))) return undefined
  return clone(value)
}
function inventoryWeapon(host, instanceId) {
  const matches = (host.inventory ?? []).filter(row => row.inventoryInstanceId === instanceId)
  return matches.length === 1 && matches[0].isWeapon === true ? matches[0] : undefined
}
function boundInstance(host, binding) {
  return inventoryWeapon(host, binding.inventoryInstanceId) ??
    (host.stowedPactInstances ?? []).find(row => row.ownerId === host.ownerId && row.inventoryInstanceId === binding.inventoryInstanceId && row.weaponBaseId === binding.weaponBaseId)
}
function canBindMagic(weapon, owner) {
  return weapon && weapon.isMagical === true && weapon.isArtifact === false && weapon.isSentient === false &&
    (weapon.boundOwnerId == null || weapon.boundOwnerId === owner)
}
export function authorizePactWeaponCreation(host, weaponBaseId) {
  const definition = host.weaponCatalog?.find(row => row.weaponBaseId === weaponBaseId)
  return host.hasBladePact === true && !!definition?.isWeapon && (definition.isMelee === true ||
    (host.hasImprovedPactWeapon === true && rangedForms.has(definition.weaponBaseId)))
}
function removeBinding(state, reason) {
  const binding = state.binding
  delete state.binding
  if (!binding) return []
  if (binding.origin === 'summoned') return [{ kind: 'destroy-summoned-instance', inventoryInstanceId: binding.inventoryInstanceId, reason }]
  return binding.status === 'dismissed'
    ? [{ kind: 'release-magic-instance-at-owner-feet', inventoryInstanceId: binding.inventoryInstanceId, reason }]
    : [{ kind: 'remove-pact-bond', inventoryInstanceId: binding.inventoryInstanceId, reason }]
}
function stowBinding(state, reason) {
  const b = state.binding
  b.status = 'dismissed'
  delete b.awaySinceHostSecond
  return [{ kind: b.origin === 'summoned' ? 'destroy-summoned-instance' : 'stow-bound-magic-instance', inventoryInstanceId: b.inventoryInstanceId, reason }]
}

export function transitionPactWeapon(before, command, host) {
  const state = normalizePactWeaponState(before)
  const fail = reason => ({ ok: false, reason, state: clone(before), inventoryOperations: [] })
  if (!state || !host || host.ownerId !== state.ownerId || !time(host.worldSecond) ||
    (state.lastHostSecond != null && host.worldSecond < state.lastHostSecond)) return fail('untrusted-or-stale-host-facts')
  if (!command || command.ownerId !== state.ownerId || command.expectedRevision !== state.revision) return fail('owner-or-revision-mismatch')
  const finish = (inventoryOperations = [], extra = {}) => ({ ok: true,
    state: { ...state, revision: before.revision + 1, lastHostSecond: host.worldSecond }, inventoryOperations, ...extra })
  if (host.ownerDead === true) {
    const operations = removeBinding(state, 'owner-died')
    delete state.ritual
    return finish(operations)
  }
  if (host.hasBladePact !== true) return fail('blade-pact-required')

  if (command.kind === 'summon') {
    if (host.hasFreeHand !== true) return fail('free-hand-required')
    // A magic bond remains until death, a new completed binding ritual, or the
    // completed release ritual. Creating a new form cannot silently break it.
    if (state.binding?.origin === 'ritually-bound-magic') {
      const weapon = boundInstance(host, state.binding)
      if (!weapon) return fail('bound-magic-instance-unavailable')
      if (command.inventoryInstanceId != null && command.inventoryInstanceId !== state.binding.inventoryInstanceId)
        return fail('must-summon-existing-magic-bond')
      state.binding.status = 'present'
      delete state.binding.awaySinceHostSecond
      return finish([{ kind: 'summon-bound-magic-instance-to-hand', inventoryInstanceId: state.binding.inventoryInstanceId }])
    }
    const weapon = inventoryWeapon(host, command.inventoryInstanceId)
    if (!weapon || weapon.pactCreationOwnerId !== state.ownerId || weapon.pactCreationTransactionId !== host.transactionId ||
      !authorizePactWeaponCreation(host, weapon.weaponBaseId)) return fail('unissued-or-illegal-weapon-instance')
    const operations = removeBinding(state, 'new-weapon-created')
    state.binding = { inventoryInstanceId: weapon.inventoryInstanceId, weaponBaseId: weapon.weaponBaseId, origin: 'summoned', status: 'present' }
    return finish([...operations, { kind: 'place-new-pact-instance-in-hand', inventoryInstanceId: weapon.inventoryInstanceId }])
  }
  if (command.kind === 'start-binding-ritual') {
    const weapon = inventoryWeapon(host, command.inventoryInstanceId)
    if (!canBindMagic(weapon, state.ownerId) || weapon.heldByActorId !== state.ownerId || !id(host.ritualId)) return fail('invalid-ritual-instance')
    state.ritual = { kind: 'binding', inventoryInstanceId: weapon.inventoryInstanceId, ritualId: host.ritualId, startedHostSecond: host.worldSecond }
    return finish()
  }
  if (command.kind === 'start-release-ritual') {
    if (state.binding?.origin !== 'ritually-bound-magic' || !id(host.ritualId)) return fail('no-magic-bond')
    state.ritual = { kind: 'release', inventoryInstanceId: state.binding.inventoryInstanceId, ritualId: host.ritualId, startedHostSecond: host.worldSecond }
    return finish()
  }
  if (command.kind === 'complete-ritual' || command.kind === 'advance') {
    if (state.ritual) {
      const r = state.ritual, continuity = host.ritualContinuity?.find(row => row.ritualId === r.ritualId)
      const weapon = r.kind === 'binding' ? inventoryWeapon(host, r.inventoryInstanceId) : undefined
      const invalidBinding = r.kind === 'binding' && (!canBindMagic(weapon, state.ownerId) || weapon.heldByActorId !== state.ownerId)
      const invalidRelease = r.kind === 'release' && (state.binding?.origin !== 'ritually-bound-magic' || state.binding.inventoryInstanceId !== r.inventoryInstanceId)
      if (continuity?.uninterrupted !== true || invalidBinding || invalidRelease) {
        delete state.ritual
        return finish([], { ritualInterrupted: true })
      }
      if (command.kind === 'complete-ritual') {
        if (host.worldSecond - r.startedHostSecond < PACT_WEAPON_CORE_RULES.bindingRitualSeconds) return fail('ritual-not-complete')
        const operations = removeBinding(state, r.kind === 'release' ? 'release-ritual-completed' : 'new-magic-bond-completed')
        if (r.kind === 'binding') state.binding = { inventoryInstanceId: weapon.inventoryInstanceId, weaponBaseId: weapon.weaponBaseId, origin: 'ritually-bound-magic', status: 'present' }
        delete state.ritual
        return finish(operations)
      }
    } else if (command.kind === 'complete-ritual') return fail('no-active-ritual')

    if (state.binding?.status === 'present') {
      const location = host.bindingLocations?.find(row => row.inventoryInstanceId === state.binding.inventoryInstanceId)
      if (typeof location?.distanceFromOwnerFeet !== 'number' || !Number.isFinite(location.distanceFromOwnerFeet) || location.distanceFromOwnerFeet < 0) {
        delete state.binding.awaySinceHostSecond
        return finish([], { lifecycleUnknown: true })
      }
      if (location.distanceFromOwnerFeet <= PACT_WEAPON_CORE_RULES.separationFeet) delete state.binding.awaySinceHostSecond
      else if (state.binding.awaySinceHostSecond == null) state.binding.awaySinceHostSecond = host.worldSecond
      else if (host.worldSecond - state.binding.awaySinceHostSecond >= PACT_WEAPON_CORE_RULES.separationSeconds)
        return finish(stowBinding(state, 'one-minute-outside-five-feet'))
    }
    return finish()
  }
  if (command.kind === 'dismiss') {
    if (!state.binding) return fail('no-bound-weapon')
    if (state.binding.status === 'dismissed') return finish()
    return finish(stowBinding(state, 'owner-dismissed'))
  }
  return fail('unsupported-command')
}

/** Baseline bonuses exclude this feature's previous projection. The projection
 * is attached to a physical item; it does not authorize every weapon an actor uses.
 */
export function projectImprovedPactWeapon(value, host, instanceId) {
  const state = normalizePactWeaponState(value), weapon = inventoryWeapon(host, instanceId)
  if (!state || host.ownerId !== state.ownerId || !host.hasBladePact || !host.hasImprovedPactWeapon || !weapon ||
    state.binding?.status !== 'present' || state.binding.inventoryInstanceId !== instanceId || state.binding.weaponBaseId !== weapon.weaponBaseId)
    return { eligible: false }
  const attack = weapon.baselineMagicAttackBonus, damage = weapon.baselineMagicDamageBonus
  if (![attack, damage].every(n => Number.isInteger(n) && n >= 0 && n <= 10) || attack !== damage)
    return { eligible: false, reason: 'unknown-or-asymmetric-existing-weapon-bonus' }
  return { eligible: true, inventoryInstanceId: instanceId, additionalAttackAndDamageBonus: attack === 0 ? 1 : 0,
    sourceOwnerId: state.ownerId }
}

/** Item property follows the bound instance regardless of the current wielder.
 * Proficiency and focus are personal benefits and must be queried separately.
 */
export function pactWeaponMagicalResistanceProperty(value, ownerHost, instanceId) {
  const state = normalizePactWeaponState(value)
  return state?.ownerId === ownerHost.ownerId && ownerHost.hasBladePact === true && state.binding?.status === 'present' &&
    state.binding.inventoryInstanceId === instanceId && !!inventoryWeapon(ownerHost, instanceId)
}

export function pactWeaponWielderBenefits(value, ownerHost, { inventoryInstanceId, wielderId, castingClassId }) {
  const state = normalizePactWeaponState(value)
  const weapon = inventoryWeapon(ownerHost, inventoryInstanceId)
  const ownerWielding = !!state && ownerHost.ownerId === state.ownerId && wielderId === state.ownerId &&
    ownerHost.hasBladePact === true && state.binding?.status === 'present' &&
    state.binding.inventoryInstanceId === inventoryInstanceId && !!weapon && weapon.heldByActorId === wielderId
  return { proficientWithPactWeapon: ownerWielding,
    warlockSpellcastingFocus: ownerWielding && ownerHost.hasImprovedPactWeapon === true && castingClassId === 'warlock' }
}

/** Compatibility shape; callers must pass the actual wielder. Magical resistance
 * is deliberately independent of whether that wielder is the source owner.
 */
export function pactWeaponBaseCombatQualification(value, ownerHost, instanceId, wielderId) {
  return { proficientForOwner: pactWeaponWielderBenefits(value, ownerHost, { inventoryInstanceId: instanceId, wielderId }).proficientWithPactWeapon,
    countsAsMagicalAgainstResistanceAndImmunity: pactWeaponMagicalResistanceProperty(value, ownerHost, instanceId) }
}
