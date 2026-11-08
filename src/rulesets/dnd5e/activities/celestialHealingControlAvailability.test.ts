import {expect,it} from 'vitest'
import {celestialBundle,growCelestial,HEALING_LIGHT} from '../celestialNative.fixture'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {dnd5eRulesPluginFromUnifiedContentBundleV1} from '../unifiedContent'
import {dnd5eActivityControlUnavailableReason as reason} from './dnd5eActivityControlAvailability'
it('actual Celestial1 pool enables the selected Healing Light count rather than summing all ten mutually exclusive costs',()=>{
 const bundle=celestialBundle(),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle));try{
 const actor=growCelestial(1),feature=bundle.definitions.find(d=>d.kind==='feature'&&bundle.manifest.id+':'+d.id===HEALING_LIGHT);if(!feature||feature.kind!=='feature'||!feature.activities?.[0])throw Error('Actual source activity required');const activity=feature.activities[0];expect(actor.classResources!['local.xge-celestial:healing-light'].current).toBe(2);
 expect(reason(activity,actor)).toBeUndefined();expect(reason(activity,actor,{dice:'2'})).toBeUndefined();expect(reason(activity,actor,{dice:'3'})).toBe('资源不足');
 const exhausted={...actor,classResources:{...actor.classResources,'local.xge-celestial:healing-light':{current:0,max:2}}};expect(reason(activity,exhausted,{dice:'1'})).toBe('资源不足');
 const extra={kind:'resource' as const,resourceId:'local.xge-celestial:healing-light',amount:{kind:'constant' as const,value:1},consumeOn:'resolve' as const};expect(reason({...activity,consumption:[...activity.consumption!,extra]},actor,{dice:'2'})).toBe('资源不足');
 }finally{dispose()}
})
