import type { Character } from '../../types/character'
import { normalizePactWeaponState } from './pactWeaponBinding.mjs'

/** Host-private binding identity, never a template id or a player-supplied flag.
 * The shared server must protect this field before exposing the command in UI. */
export function pactWeaponHasPhysicalIdentity(owner: Character, instanceId: string): boolean {
  const record = (owner as Character & { dnd5ePactWeaponAuthority?: {
    schemaVersion?: unknown; state?: unknown; inventory?: { ownerId?: unknown; schemaVersion?: unknown }
  } }).dnd5ePactWeaponAuthority
  const state = normalizePactWeaponState(record?.state)
  return record?.schemaVersion === 1 && record.inventory?.schemaVersion === 1 && record.inventory.ownerId === owner.id &&
    state?.ownerId === owner.id && state.binding?.status === 'present' && state.binding.inventoryInstanceId === instanceId
}
