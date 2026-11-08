import {it,expect,vi} from 'vitest'
import type{Character}from'../../types/character'
import {automationCapabilityFromLegacyStatus}from'../../domain/automation/automationCapability'
import {registerContentDefinitionPackage}from'../../domain/content/contentDefinitionRegistry'
import * as api from './pluginApi'
import * as catalog from './plugins/pluginContentCatalog'

const id='local.readonly-presentation',featureId=id+':guard'
const actor={level:4,charClass:'',race:'',dnd5ePluginFeatureIds:[featureId]}as Character
function plugin(extra:Record<string,unknown>={},available?: (character:Character)=>boolean):api.Dnd5eRulesPlugin{return{manifest:{id,name:'Readonly presentation',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(host){host.registerFeature({id:'guard',name:'Guard',summary:'Guard',description:'Guard',automation:'full',staticModifiers:{armorClassBonus:1},...extra,...(available?{isAvailable:available}:{})})}}}
const read=()=>api.dnd5eRuntimePluginFeaturesAvailableForCharacter(actor)
const reference=()=>api.dnd5ePluginFeaturesAvailableForCharacter(actor)
it('current registry, same-byte replacement, unified content and editable public results retain original semantics',()=>{
 let dispose=api.registerDnd5eRulesPlugin(plugin())
 try{
  expect(read()).toEqual(reference());const first=read().find(f=>f.id===featureId)!;expect(Object.isFrozen(first)).toBe(true);expect(Object.isFrozen(first.staticModifiers)).toBe(true)
  const editable=reference().find(f=>f.id===featureId)!;editable.name='caller';editable.staticModifiers!.armorClassBonus=9;expect(read().find(f=>f.id===featureId)?.name).toBe('Guard');expect(read().find(f=>f.id===featureId)?.staticModifiers?.armorClassBonus).toBe(1)
  dispose();expect(read().some(f=>f.id===featureId)).toBe(false);dispose=api.registerDnd5eRulesPlugin(plugin());expect(read()).toEqual(reference());expect(read().find(f=>f.id===featureId)).not.toBe(first)
  const content=registerContentDefinitionPackage({packageId:id,packageVersion:'1.0.0',definitions:[{schemaVersion:1,id:'guard',namespace:id,version:'1.0.0',kind:'feature',name:'Guard',payload:{id:'guard',automation:'manual'},automation:automationCapabilityFromLegacyStatus('manual')}]})
  try{expect(read()).toEqual(reference());expect(read().find(f=>f.id===featureId)?.automation).toBe('manual')}finally{content.dispose()}
  expect(read().find(f=>f.id===featureId)?.automation).toBe('full')
 }finally{dispose()}
},60000)
it('executable availability is evaluated fresh with the original editable receiver and original exceptions',()=>{
 const failure=Error('original predicate failure');let fail=false
 const predicate=function(this:Record<string,unknown>,current:Character){if(fail)throw failure;this.__receiverEdit=true;return current.level>=5}
 const dispose=api.registerDnd5eRulesPlugin(plugin({},predicate))
 try{actor.level=4;expect(read()).toEqual(reference());expect(read().some(f=>f.id===featureId)).toBe(false);actor.level=5;expect(read()).toEqual(reference());expect(read().some(f=>f.id===featureId)).toBe(true);fail=true;expect(()=>read()).toThrow(failure);try{read()}catch(error){expect(error).toBe(failure)}}finally{actor.level=4;dispose()}
},60000)
it('SAB and nonplain extra data remain the original fresh editable public fallback without freezing external input',()=>{
 const buffer=new SharedArrayBuffer(1),view=new Uint8Array(buffer);view[0]=3
 const date=new Date(10),map=new Map([['value',1]]),set=new Set([2]);const dispose=api.registerDnd5eRulesPlugin(plugin({extraData:{buffer,date,map,set}}))
 try{
  const first=read().find(f=>f.id===featureId)as unknown as{extraData:{buffer:SharedArrayBuffer;date:Date;map:Map<string,number>;set:Set<number>}}
  expect(read()).toEqual(reference());expect(Object.isFrozen(first)).toBe(false);expect(Object.isFrozen(buffer)).toBe(false)
  view[0]=9;const current=read().find(f=>f.id===featureId)as unknown as typeof first;expect(new Uint8Array(current.extraData.buffer)[0]).toBe(9);expect(read()).toEqual(reference());current.extraData.date.setTime(80);expect((read().find(f=>f.id===featureId)as unknown as typeof first).extraData.date.getTime()).toBe(10)
 }finally{dispose()}
},60000)
it('optional classification failures fall back without replacing original public getter behavior',()=>{
 const dispose=api.registerDnd5eRulesPlugin(plugin());const runtime=catalog.runtimeDnd5ePluginFeatures();const original=Object.getPrototypeOf
 const inspect=vi.spyOn(Object,'getPrototypeOf').mockImplementation(value=>{if(value===runtime)throw Error('diagnostic classifier failure');return original(value)})
 try{expect(read()).toEqual(reference());expect(Object.isFrozen(read().find(f=>f.id===featureId)!)).toBe(false)}finally{inspect.mockRestore();dispose()}
},60000)
