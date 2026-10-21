import {beforeEach,expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import type {BattleMap} from '../../store/maps'
import {setMapGeometryRuntime} from '../../lib/mapGeometry'
import {getEffectiveAc} from '../../lib/combatStats'
import {createDnd5eMechanicalEffect} from '../../rulesets/dnd5e/activeEffects'
import {advanceDnd5eCampaignTimedActiveEffects} from '../../rulesets/dnd5e/campaignTimeRules'
import {createDnd5eMapCombatSnapshot} from '../../rulesets/dnd5e/mapBridge'
import {dnd5eTargetArmorClassForAttack} from '../../rulesets/dnd5e/headlessCombatEngine'
import {projectDnd5eMapCohortArmorClassBonus} from './mapCohortArmorClassProjection'
function fixture(){
 const effect=createDnd5eMechanicalEffect({id:'wedding',definitionId:'test:ceremony-wedding',label:'Wedding',targetId:'a',
  source:{kind:'spell',actorId:'cleric',rulesId:'ceremony'},duration:{type:'rounds',remainingRounds:100800,tickOn:'source-turn-end'},
  modifiers:{cohortArmorClass:{bonus:2,maximumFeet:30,match:'all',recipients:[{actorId:'a',characterId:'char-a'},{actorId:'b',characterId:'char-b'}]}}})
 const characters=['a','b','attacker'].map(id=>normalizeCharacter({id:'char-'+id,name:id,charClass:'战士',currentHp:10,maxHp:10,
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},equipment:{},dnd5eCombatState:{schemaVersion:2,activeEffects:id==='a'?[effect]:[]}}))
 const map:BattleMap={id:'cohort-map',name:'Map',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:characters.map((character,index)=>({id:['a','b','attacker'][index],label:character.name,type:'player',characterId:character.id,x:index===1?325:25,y:index===2?75:25,size:1,color:'',emoji:'',hp:10,maxHp:10}))}
 return {map,characters}
}
const bonus=(input:ReturnType<typeof fixture>)=>projectDnd5eMapCohortArmorClassBonus({...input,tokenId:'a'})
beforeEach(()=>setMapGeometryRuntime([]))
it('matches Host attack AC at the boundary, outside range and after returning without modifying base AC',()=>{
 const input=fixture(),base=getEffectiveAc(input.characters[0]);expect(base).toBe(10)
 for(const [x,expected] of [[325,2],[375,0],[75,2]]){
  input.map.tokens[1].x=x
  expect(bonus(input)).toBe(expected)
  const {state}=createDnd5eMapCombatSnapshot({combatId:'parity',...input,initiativeOrder:input.map.tokens.map(token=>({tokenId:token.id,label:token.label,color:token.color,emoji:token.emoji,roll:0}))})
  expect(base+bonus(input)).toBe(dnd5eTargetArmorClassForAttack(state,'attacker','a'))
  expect(getEffectiveAc(input.characters[0])).toBe(base)
 }
})
it('retains stable character identity after a token remap and JSON reload; duplicate peers refuse',()=>{
 const input=JSON.parse(JSON.stringify(fixture())) as ReturnType<typeof fixture>
 input.map.tokens[1].id='new-token'
 expect(bonus(input)).toBe(2)
 input.map.tokens.push({...input.map.tokens[1],id:'duplicate'})
 expect(bonus(input)).toBe(0)
})
it('loses the bonus when the peer leaves the map, is vertically distant, or the effect expires',()=>{
 const input=fixture();input.map.tokens[1].elevationFeet=50;expect(bonus(input)).toBe(0)
 input.map.tokens[1].elevationFeet=0;expect(bonus(input)).toBe(2)
 input.map.tokens=input.map.tokens.filter(t=>t.id!=='b');expect(bonus(input)).toBe(0)
 const expired=fixture();expired.characters[0]=advanceDnd5eCampaignTimedActiveEffects(expired.characters[0],10080)
 expect(bonus(expired)).toBe(0)
})
it('does not count a suspended effect or add the unconditional bonus twice',()=>{
 const input=fixture(),effect=input.characters[0].dnd5eCombatState!.activeEffects![0]
 effect.modifiers!.armorClassBonus=3
 expect(getEffectiveAc(input.characters[0])).toBe(13);expect(bonus(input)).toBe(2)
 effect.suspendedBy=['antimagic-field'];expect(bonus(input)).toBe(0)
})
it('projects the same map-only humanoid recipient and refuses unknown or ambiguous bearer identities',()=>{
 const input=fixture(),effect=input.characters[0].dnd5eCombatState!.activeEffects![0]
 effect.modifiers!.cohortArmorClass={...effect.modifiers!.cohortArmorClass!,recipients:[{actorId:'a'},{actorId:'b',characterId:'char-b'}]}
 input.map.tokens[0]={...input.map.tokens[0],type:'enemy',characterId:undefined,poolId:'srd-5.1:commoner',
  dnd5eCombatState:{schemaVersion:2,activeEffects:[effect]}}
 expect(bonus(input)).toBe(2)
 expect(projectDnd5eMapCohortArmorClassBonus({...input,tokenId:'unknown'})).toBe(0)
 input.map.tokens.push({...input.map.tokens[0]});expect(bonus(input)).toBe(0)
})
