import { dnd5eCombatantPairKey,dnd5eSourceLinkedRelations,type Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import type { Dnd5eActivityCapabilityProposal } from './dnd5eActivityExecutor'

/** Share creature effects, never duplicate summoned items or pay another casting cost. */
export function shareDnd5eSelfSpellProposals(state:Dnd5eHeadlessCombatState,actorId:string,proposals:readonly Dnd5eActivityCapabilityProposal[]):Dnd5eActivityCapabilityProposal[] {
  const mounts=Object.values(state.combatants).filter(candidate=>{
    const range=candidate.summonedShareSelfSpellsRangeFeet
    return candidate.summonedSourceCombatantId===actorId && candidate.currentHp>0 && !candidate.deathSaves.dead && range!=null &&
      (state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actorId,candidate.id)]??Infinity)<=range &&
      (!candidate.summonedShareSelfSpellsRequiresMounted || dnd5eSourceLinkedRelations(state,actorId).some(link=>link.target.id===candidate.id && link.effect.relation?.movement==='source-rides-target'))
  })
  const shared=proposals.flatMap(proposal=>{
    if(!('targetId' in proposal)||proposal.targetId!==actorId)return []
    if(proposal.kind==='apply-effect') {
      if(proposal.tags?.some(tag=>tag.startsWith('item-lease:')) || proposal.modifierGroups.some(group=>group.weaponEnchantment || group.armorEnchantment))return []
    } else if(!['heal','grant-temporary-hit-points','apply-standard-condition','remove-standard-condition','stabilize','remove-effect','remove-effects-by-tag','adjust-exhaustion','recover-ability-score','recover-hit-point-maximum','transform-creature','move'].includes(proposal.kind))return []
    return mounts.map(mount=>({...structuredClone(proposal),operationId:`${proposal.operationId}:shared:${mount.id}`,targetId:mount.id}))
  })
  return [...proposals,...shared]
}
