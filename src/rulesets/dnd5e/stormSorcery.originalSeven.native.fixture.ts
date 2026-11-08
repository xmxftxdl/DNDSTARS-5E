import {stormFurySource} from './stormSorcery.fury.native.fixture'
import {stormGuideWindSource} from './stormGuideWind.native.fixture'
import {automationCapabilityFromLegacyStatus as cap} from '../../domain/automation/automationCapability'
import {buildDnd5eCustomRulesContentPackageV2,parseDnd5eContentPackageV2,dnd5eContentPackageAutomationCoverageV2} from './contentPackageV2'
import {parseDnd5eUnifiedContentBundleV1} from './unifiedContent'

/** A prospective data composition, never a formal release or a Room proof. */
export async function buildStormOriginalSevenDraft(){
 const bundle:any=structuredClone(await stormFurySource()),weather=await stormGuideWindSource(),parent=bundle.definitions.find((d:any)=>d.kind==='subclass'),sub=parent.payload,originalAbilities=structuredClone(sub.abilities),ns=bundle.manifest.id
 const features=new Map<string,any>(bundle.definitions.filter((d:any)=>d.kind==='feature').map((d:any)=>[d.id,d]));for(const d of weather.definitions.filter(d=>d.kind==='feature'&&d.id.startsWith('storm-guide-')))features.set(d.id,structuredClone(d))
 const native:Record<string,string>={'tempestuous-magic':'tempestuous-spell-flight','heart-of-the-storm':'heart-casting-eruption','storms-fury':'storm-fury-native'},references:Record<string,{kind:'advancement'|'feature';id:string}[]>={'wind-speaker':[{kind:'advancement',id:'wind-speaker-language'}],'storm-guide-rain':[{kind:'feature',id:'storm-guide-rain-start'},{kind:'feature',id:'storm-guide-rain-end'}],'storm-guide-wind':[{kind:'feature',id:'storm-guide-wind-direction'}],'wind-soul':[{kind:'feature',id:'wind-immunity'},{kind:'feature',id:'wind-soul-sharing'}]}
 sub.abilities=originalAbilities.map((a:any)=>native[a.id]?{...structuredClone(features.get(native[a.id]).payload.declarativeAbility),id:a.id,name:a.name,description:a.description,level:a.level,automation:'full'}:{schemaVersion:1,id:a.id,name:a.name,description:a.description,level:a.level,automation:'manual',trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],passiveImplementationReferences:references[a.id]})
 sub.advancements=sub.advancements.filter((a:any)=>!['tempestuous-native','heart-casting-eruption-native','storm-fury-native-grant'].includes(a.id));sub.advancements.push({schemaVersion:1,id:'heart-of-the-storm-resistance-grant',level:6,kind:'build-grant',grants:[{kind:'feature',featureId:ns+':heart-resistance'}]})
 for(const id of Object.values(native))features.delete(id);bundle.definitions=[parent,...features.values()];bundle.manifest={...bundle.manifest,name:'姗娜萨·风暴术法原七能力整合候选',version:'0.0.2',distributionPolicy:'room-distributable'};for(const d of bundle.definitions)d.version='0.0.2'
 const draft:any={manifest:bundle.manifest,races:[],backgrounds:[],features:bundle.definitions.filter((d:any)=>d.kind==='feature').map((d:any)=>d.payload),feats:[],spells:[],items:[],abilityGenerationMethods:[],headlessActions:[],activities:bundle.definitions.flatMap((d:any)=>d.activities??[]),subclasses:[sub],classes:[],monsters:[]}
 return{draft,bundle,originalAbilities,namespace:ns}
}
export async function stormOriginalSevenSource(){
 const built=await buildStormOriginalSevenDraft(),pkg=parseDnd5eContentPackageV2(new TextEncoder().encode(buildDnd5eCustomRulesContentPackageV2(built.draft)).buffer)
 if(!pkg)throw Error('original-seven:canonical-package-required');const entries=dnd5eContentPackageAutomationCoverageV2(pkg).entries.filter(r=>r.category==='subclass-ability')
 if(entries.length!==7||entries.some(r=>r.status!=='full'))throw Error('original-seven:executed-implementations-required:'+entries.filter(r=>r.status!=='full').map(r=>r.id+':'+r.status).join(','))
 built.bundle.definitions.find((d:any)=>d.kind==='subclass').automation=cap('full');const bundle=parseDnd5eUnifiedContentBundleV1(JSON.stringify(built.bundle));if(!bundle)throw Error('original-seven:canonical-unified-required')
 return{...built,bundle,pkg,entries}
}
