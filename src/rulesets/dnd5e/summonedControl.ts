import type { Token } from '../../store/maps'
import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eActiveEffectInstance } from './activeEffects'

export { isDnd5eSummonLingerPolicy, detachDnd5eUncontrolledSummon, type Dnd5eSummonLingerPolicy } from '../../../shared/summon-linger.mjs'

export interface Dnd5eSummonControlSave {
  ability: AbilityKey
  dc: number
  disadvantage?: boolean
  /** A lost-control creature lingers for this die after early concentration loss. */
  lingerDieSides?: number
}

export function isDnd5eSummonControlSave(value: unknown): value is Dnd5eSummonControlSave {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const save = value as Dnd5eSummonControlSave
  return ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(save.ability) &&
    Number.isInteger(save.dc) && save.dc > 0 && save.dc <= 100 &&
    (save.disadvantage == null || typeof save.disadvantage === 'boolean') &&
    (save.lingerDieSides == null || [4, 6, 8, 10, 12, 20].includes(save.lingerDieSides))
}

export function createDnd5eSummonControlEffect(token: Token, save: Dnd5eSummonControlSave): Dnd5eActiveEffectInstance {
  const summon=token.dnd5eSummon!
  return {
    schemaVersion:1,id:`${token.id}:control`,definitionId:'summon-control',label:'召唤控制',kind:'custom',
    source:{kind:'spell',actorId:summon.sourceTokenId,rulesId:summon.featureId,magical:true},
    appliedAt:0,appliedRound:summon.createdRound,duration:{type:'permanent'},
    stackingKey:`${token.id}:control`,stackingPolicy:'replace',
    repeatSave:{ability:save.ability,dc:save.dc,timing:'target-turn-end',onSuccess:'remove',disadvantage:save.disadvantage},
  }
}

