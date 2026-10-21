import { expect, it, vi, beforeEach } from 'vitest'
vi.mock('./imageStore', () => ({ deleteImage: vi.fn(async () => {}), putImage: vi.fn(async () => true), getImage: vi.fn(), pruneOrphanImages: vi.fn(async () => []) }))
import { deleteImage } from './imageStore'
import { referencedMapImageIds } from './mapImageReferences'
import { migrateMapsState, useMapStore } from '../store/maps'
import { normalizeCharacter, useCharacterStore } from '../store/characters'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'

const presentation={emoji:'V',color:'#ffffff',size:1,tokenPortraitImageId:'captive-image'}
function fixture() {
  const effect={...createDnd5eMechanicalEffect({id:'cage',definitionId:'cage',label:'Cage',targetId:'caster',source:{kind:'spell'}}),
    linkedTargetSnapshots:[{actorId:'corpse',effectId:'blocked',name:'Captive',presentation}]}
  const character=normalizeCharacter({id:'caster-char',name:'Caster',dnd5eCombatState:{activeEffects:[effect]}})
  const maps=migrateMapsState({maps:[{id:'body-map',width:500,height:500,gridSize:50,tokens:[{id:'corpse',type:'enemy',x:25,y:25,size:1,label:'Corpse',emoji:'V',color:'#fff',tokenPortraitImageId:'captive-image'}]},
    {id:'sensor-map',width:500,height:500,gridSize:50,tokens:[]}]}).maps
  return {maps,character}
}
beforeEach(()=>{vi.clearAllMocks();useCharacterStore.setState({characters:[]});useMapStore.setState({maps:[],selectedId:null})})
it('retains portrait through a character controller, then a final-use projection, and releases it once neither exists',()=>{
  const {maps,character}=fixture(),withoutBody=maps.filter(map=>map.id!=='body-map')
  expect(referencedMapImageIds(withoutBody,[character]).has('captive-image')).toBe(true)
  const projected={...withoutBody[0],tokens:[{...maps[0].tokens[0],id:'sensor',tokenPortraitImageId:undefined,
    dnd5eSpellEffect:{schemaVersion:1 as const,spellId:'eyes',sourceCharacterId:'caster-char',sourceTokenId:'caster',createdRound:1,expiresAfterRound:100,linkedTargetProjection:{name:'Captive',presentation}}}]}
  expect(referencedMapImageIds([projected],[]).has('captive-image')).toBe(true)
  expect(referencedMapImageIds(withoutBody,[]).has('captive-image')).toBe(false)
})
it.each(['token','map'] as const)('does not delete shared corpse portrait while a cage references it when deleting %s',kind=>{
  const {maps,character}=fixture()
  useCharacterStore.setState({characters:[character]});useMapStore.setState({maps,selectedId:'body-map'})
  if(kind==='token')useMapStore.getState().removeToken('body-map','corpse')
  else useMapStore.getState().removeMap('body-map')
  expect(deleteImage).not.toHaveBeenCalledWith('captive-image')
  if(kind==='map')expect(deleteImage).toHaveBeenCalledWith('body-map')
})
it('still deletes an unreferenced portrait with its last token',()=>{
  const {maps}=fixture();useMapStore.setState({maps,selectedId:'body-map'})
  useMapStore.getState().removeToken('body-map','corpse')
  expect(deleteImage).toHaveBeenCalledWith('captive-image')
})
