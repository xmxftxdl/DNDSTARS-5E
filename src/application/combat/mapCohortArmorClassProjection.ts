import type {Character} from '../../types/character'
import {createDnd5eMapCombatSnapshot} from '../../rulesets/dnd5e/mapBridge'
import {dnd5eActiveArmorClassBonus} from '../../rulesets/dnd5e/activeEffects'
import {dnd5eCombatantPairKey} from '../../rulesets/dnd5e/headlessCombatPrimitives'

type BattleMap = Parameters<typeof createDnd5eMapCombatSnapshot>[0]['map']

/** Display only the spatial cohort component; ordinary AC remains in its existing projection. */
export function projectDnd5eMapCohortArmorClassBonus(input:{map:BattleMap;characters:readonly Character[];tokenId:string}):number {
  const tokens=input.map.tokens.filter(token=>token.id===input.tokenId)
  if(tokens.length!==1)return 0
  const token=tokens[0],linked=input.characters.filter(character=>character.id===token.characterId)
  if(linked.length>1)return 0
  const raw=[...(linked[0]?.dnd5eCombatState?.activeEffects??[]),...(token.dnd5eCombatState?.activeEffects??[])]
  if(!raw.some(effect=>effect.modifiers?.cohortArmorClass))return 0
  const {state}=createDnd5eMapCombatSnapshot({combatId:'map-cohort-ac-display',map:input.map,characters:input.characters,
    initiativeOrder:input.map.tokens.filter(t=>t.type==='player'||t.type==='enemy').map(t=>({tokenId:t.id,label:t.label,color:t.color,emoji:t.emoji,roll:0}))})
  const bearer=state.combatants[input.tokenId]
  if(!bearer)return 0
  const effects=bearer.classState.activeEffects
  return dnd5eActiveArmorClassBonus(effects,{
    bearer:{actorId:bearer.id,characterId:bearer.classState.wardingBondParticipantCharacterId},
    distanceTo(member){
      const peers=member.characterId?Object.values(state.combatants).filter(peer=>peer.classState.wardingBondParticipantCharacterId===member.characterId)
        :[state.combatants[member.actorId]].filter(Boolean)
      if(peers.length!==1)return undefined
      return state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(bearer.id,peers[0].id)]
    },
  })-dnd5eActiveArmorClassBonus(effects)
}
