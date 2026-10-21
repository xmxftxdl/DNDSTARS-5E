import {normalizeDnd5eMapObjectStateV1} from './mapObjectState'
import {expect,it} from 'vitest'
import type {Token} from '../../store/maps'
import {dnd5eAnimatedObjectSnapshot} from './animatedObjectSnapshot'
import {dnd5eRestoredSummonedOriginalObject} from './summonedCreatures'
const object=():Token=>({id:'cup',type:'obstacle',label:'Cup',x:75,y:75,size:1,color:'#aaa',emoji:'',hp:5,maxHp:5,
 dnd5eObjectState:{schemaVersion:1,magical:false,wornOrCarried:false,animateObjects:{size:'tiny',mobility:'walk',damageType:'bludgeoning'}}})
it('preserves an independent original object snapshot and restores at current position with overflow damage',()=>{
 const target=object(),snapshot=dnd5eAnimatedObjectSnapshot(target,'tiny')!
 expect(snapshot).toBeDefined();target.dnd5eObjectState!.magical=true
 expect(snapshot.dnd5eObjectState?.magical).toBe(false)
 const creature={...object(),id:'animated',type:'enemy',x:225,y:125,elevationFeet:10,dnd5eSummon:{truePolymorphOriginalObject:snapshot}} as Token
 expect(dnd5eRestoredSummonedOriginalObject(creature,3)).toMatchObject({id:'cup',type:'obstacle',x:225,y:125,elevationFeet:10,hp:2})
 expect(dnd5eRestoredSummonedOriginalObject(creature)).toMatchObject({hp:5})
})
it.each(['magic','carried','fixed','unknown','wrong-size','creature'])('rejects %s target',mode=>{
 const target=object()
 if(mode==='magic')target.dnd5eObjectState!.magical=true
 if(mode==='carried')target.dnd5eObjectState!.wornOrCarried=true
 if(mode==='fixed')target.dnd5eObjectState!.animateObjects!.mobility='fixed'
 if(mode==='unknown')target.dnd5eObjectState=undefined
 if(mode==='wrong-size')target.dnd5eObjectState!.animateObjects!.size='small'
 if(mode==='creature')target.type='enemy'
 expect(dnd5eAnimatedObjectSnapshot(target,'tiny')).toBeUndefined()
})

it('distinguishes attachment from locomotion and preserves explicit facts across reload',()=>{
 const target=object();target.dnd5eObjectState!.animateObjects!.mobility='fixed';target.dnd5eObjectState!.attached=false
 const restored=JSON.parse(JSON.stringify(target))
 expect(dnd5eAnimatedObjectSnapshot(restored,'tiny')).toBeDefined()
 restored.dnd5eObjectState.attached=true;restored.dnd5eObjectState.animateObjects.mobility='walk'
 expect(dnd5eAnimatedObjectSnapshot(restored,'tiny')).toBeUndefined()
})
it('allows the declared caster carrier only and releases carrying on activation',()=>{
 const target=object();target.dnd5eObjectState={...target.dnd5eObjectState!,wornOrCarried:true,carrierTokenId:'caster'}
 expect(dnd5eAnimatedObjectSnapshot(target,'tiny','other')).toBeUndefined()
 expect(dnd5eAnimatedObjectSnapshot(target,'tiny')).toBeUndefined()
 const original=dnd5eAnimatedObjectSnapshot(target,'tiny','caster')!
 expect(original.dnd5eObjectState).toMatchObject({wornOrCarried:false})
 expect(original.dnd5eObjectState?.carrierTokenId).toBeUndefined()
 expect(target.dnd5eObjectState.carrierTokenId).toBe('caster')
})
it.each([{attached:'yes'},{wornOrCarried:false,carrierTokenId:'caster'},{wornOrCarried:true,carrierTokenId:'invalid owner'}])('rejects malformed physical facts %j',patch=>{
 expect(normalizeDnd5eMapObjectStateV1({...object().dnd5eObjectState,...patch})).toBeUndefined()
})
