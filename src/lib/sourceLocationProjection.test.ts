import { expect, it } from 'vitest'
import { projectMapsForPlayer } from '../../scripts/shared-server-core.mjs'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'
import { playerVisibleCanvasTokens } from '../components/map/playerTokenVisibility'
import type { BattleMap } from '../store/maps'

function fixture() {
  const effect=createDnd5eMechanicalEffect({definitionId:'test:locate',label:'Locate',targetId:'target',
    source:{kind:'spell',actorId:'old-caster-token',characterId:'caster'},modifiers:{locationKnownToSource:true}})
  const map=(id:string,tokens:any[])=>({id,name:id,width:2000,height:2000,gridSize:50,feetPerCell:5,
    gridOffsetX:0,gridOffsetY:0,showGrid:true,dnd5ePlane:'material',tokens})
  const maps=[map('a',[{id:'new-caster-token',characterId:'caster',type:'player',x:25,y:25,size:1},
    {id:'other-token',characterId:'other',type:'player',x:75,y:25,size:1}]),
    map('b',[{id:'target',type:'enemy',x:1500,y:1500,size:2,label:'Secret name',hp:99,maxHp:100,poolId:'secret-monster',imageUrl:'secret-image',
      dnd5eCombatState:{activeEffects:[effect],hiddenCheckTotal:30}}])]
  const geometry={maps:maps.map(map=>({mapId:map.id,walls:[],doors:[],windows:[],obstacles:[],lights:[],
    vision:{enabled:true,defaultRangeFeet:30,sharePartyVision:true,ambientLight:'bright'},updatedAt:0}))}
  const characters={characters:[{id:'caster',roomMemberId:'owner'},{id:'other',roomMemberId:'other-owner'}]}
  return {maps,geometry,characters}
}

it('sends only a position to the owning caster across same-plane maps, without party-vision leakage',()=>{
  const input=fixture()
  const project=(character:string,member:string)=>projectMapsForPlayer({maps:input.maps},input.geometry,character,input.characters,{memberId:member})
  const own=project('caster','owner').maps[1].tokens
  expect(own).toHaveLength(1)
  expect(own[0]).toMatchObject({id:'target',x:1500,y:1500,size:1,label:'已定位生物',sourceLocationKnown:true,perceptionVisibility:'detected-unseen'})
  for(const key of ['hp','maxHp','poolId','imageUrl','dnd5eCombatState'])expect(own[0]).not.toHaveProperty(key)
  expect(project('other','other-owner').maps[1].tokens).toEqual([])
  expect(project('caster','other-owner').maps[1].tokens).toEqual([])
  expect(playerVisibleCanvasTokens({map:{...input.maps[1],tokens:own} as BattleMap,geometry:input.geometry.maps[1] as any,
    viewerCharacterId:'caster',visionSourceTokenIds:[],worldMinute:0})).toHaveLength(1)
})

it.each(['unknown','different','suspended','ended','forged'] as const)('withholds private location when %s',mode=>{
  const input=fixture(),target=input.maps[1].tokens[0]
  if(mode==='unknown')delete (input.maps[1] as any).dnd5ePlane
  if(mode==='different')input.maps[1].dnd5ePlane='shadow'
  if(mode==='suspended')target.dnd5eCombatState.activeEffects[0].suspendedBy=['suppression']
  if(mode==='ended'||mode==='forged')target.dnd5eCombatState.activeEffects=[]
  if(mode==='forged'){target.sourceLocationKnown=true;target.perceptionVisibility='detected-unseen'}
  expect(projectMapsForPlayer({maps:input.maps},input.geometry,'caster',input.characters,{memberId:'owner'}).maps[1].tokens).toEqual([])
})

it('does not revive an ended character effect from a stale map token snapshot',()=>{
  const input=fixture(),target=input.maps[1].tokens[0]
  target.characterId='victim'
  const victim:any={id:'victim',roomMemberId:'victim-owner',dnd5eCombatState:{activeEffects:target.dnd5eCombatState.activeEffects}}
  input.characters.characters.push(victim)
  const project=()=>projectMapsForPlayer({maps:input.maps},input.geometry,'caster',input.characters,{memberId:'owner'}).maps[1].tokens
  expect(project()[0]).toMatchObject({sourceLocationKnown:true})
  victim.dnd5eCombatState.activeEffects=[]
  expect(project()).toEqual([])
  input.characters.characters.pop()
  expect(project()).toEqual([])
})

it.each(['fog','darknessFog'])('retains only the known position under manually drawn %s',field=>{
  const input=fixture(),target=input.maps[1].tokens[0]
  target.x=125;target.y=25;target.size=1
  delete target.dnd5eCombatState.hiddenCheckTotal
  input.maps[0].tokens.push(target)
  input.maps.pop()
  input.geometry.maps[0].vision.enabled=false
  const fog={mapId:'a',filled:false,shapes:[
    {id:'cover',kind:'circle',operation:'cover',createdAt:1,x:125,y:25,radius:20}]}
  if(field==='darknessFog')(input.geometry.maps[0] as any).darknessFog=fog
  const tokens=projectMapsForPlayer({maps:input.maps},input.geometry,'caster',input.characters,{memberId:'owner'},field==='fog'?{maps:[fog]}:null).maps[0].tokens
  const located=tokens.find((token:any)=>token.id==='target')
  expect(located).toMatchObject({sourceLocationKnown:true,perceptionVisibility:'detected-unseen',x:125,y:25})
  expect(located).not.toHaveProperty('hp')
  expect(located).not.toHaveProperty('imageUrl')
})
