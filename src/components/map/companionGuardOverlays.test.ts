import {expect,it} from 'vitest'
import type {BattleMap,Token} from '../../store/maps'
import {companionGuardOverlays} from './companionGuardOverlays'
function fixture(){
 const token={id:'guard',dnd5eSummon:{commandPolicy:'persistent-order',sourceCharacterId:'owner',sourceTokenId:'caster',featureId:'spell'},
  dnd5eCombatState:{companionCommand:{command:'attack',sourceOwnerId:'caster',sourceFeatureId:'spell',guardArea:{mapId:'map',minX:0,minY:0,maxX:100,maxY:100}}}} as Token
 return {id:'map',width:500,height:500,tokens:[token,{...structuredClone(token),id:'second'}]} as BattleMap
}
it('deduplicates a group region for DM and owner without exposing it to other viewers',()=>{
 const map=fixture()
 expect(companionGuardOverlays(map,true)).toHaveLength(1)
 expect(companionGuardOverlays(map,false,'owner')).toHaveLength(1)
 expect(companionGuardOverlays(map,false,'other')).toEqual([])
 expect(companionGuardOverlays(map,false)).toEqual([])
})
it.each(['ended','replaced','wrong-owner','wrong-map'] as const)('removes stale %s regions',kind=>{
 const map=fixture()
 for(const token of map.tokens){
  if(kind==='ended')token.dnd5eSummon!.controlEnded=true
  if(kind==='replaced')token.dnd5eCombatState!.companionCommand!.command='dodge'
  if(kind==='wrong-owner')token.dnd5eCombatState!.companionCommand!.sourceOwnerId='other'
  if(kind==='wrong-map')token.dnd5eCombatState!.companionCommand!.guardArea!.mapId='other'
 }
 expect(companionGuardOverlays(map,true)).toEqual([])
})
