import {effectiveDnd5eActiveEffects, normalizeDnd5eActiveEffects, type Dnd5eActiveEffectInstance} from './activeEffects'

/** Recognition belongs to this live disguise, not the corpse identity or the next use. */
export function recognizeDnd5eGrantingDisguise(input: {
 effects: readonly Dnd5eActiveEffectInstance[] | undefined; effectId: string | undefined;
 packageId: string; activityId: string; actorId: string; observerId: string;
}): Dnd5eActiveEffectInstance[] | undefined {
 if (!input.observerId || input.observerId === input.actorId) return undefined
 const disguise=effectiveDnd5eActiveEffects(input.effects).find(effect => effect.id===input.effectId &&
   effect.source.pluginId===input.packageId && effect.source.actorId===input.actorId && effect.disguisedCreatureIdentity && effect.grantedActivities?.includes(input.activityId))
 if (!disguise || (disguise.disguiseRecognizedByActorIds?.length ?? 0)>=1000 && !disguise.disguiseRecognizedByActorIds?.includes(input.observerId)) return undefined
 return normalizeDnd5eActiveEffects((input.effects ?? []).map(effect=>effect.id===disguise.id
   ? {...effect,disguiseRecognizedByActorIds:[...new Set([...(effect.disguiseRecognizedByActorIds ?? []),input.observerId])]} : effect))
}
