import {expect,it} from 'vitest'
import {dnd5eContentPackageAutomationCoverageV2,type Dnd5eContentPackageV2} from './contentPackageV2'
const namespace='test.passive-reference'
function fixture():Dnd5eContentPackageV2{return{format:'dndstars5e-content',schemaVersion:2,manifest:{id:namespace,name:'Passive reference',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',pluginKind:'content-package'},provenance:{edition:'2014',contentMode:'incremental',sourceTitle:'Synthetic'},assets:[],content:{races:[],backgrounds:[],feats:[],spells:[],items:[],abilityGenerationMethods:[],headlessActions:[],monsters:[],features:[{id:'mobility',name:'Mobility',description:'Synthetic',summary:'Synthetic',automation:'full',sourceClassId:'rogue',sourceSubclassId:namespace+':path',minimumLevel:9,grantedBySubclass:true,staticModifiers:{existingMovementSpeedBonuses:{walk:10,climb:10,swim:10}}},{id:'initiative',name:'Initiative',description:'Synthetic',summary:'Synthetic',automation:'full',sourceClassId:'rogue',sourceSubclassId:namespace+':path',minimumLevel:13,grantedBySubclass:true,staticModifiers:{initiativeAdvantage:true}}],subclasses:[{schemaVersion:1,id:'path',name:'Path',classId:'rogue',summary:'Synthetic',advancements:[{schemaVersion:1,id:'training',level:3,kind:'build-grant',grants:[{kind:'proficiency',category:'skill',id:'nature'},{kind:'tag',key:'skill-expertise',value:'nature'}]}],abilities:[{schemaVersion:1,id:'training',name:'Training',description:'Synthetic',level:3,automation:'manual',trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],passiveImplementationReferences:[{kind:'advancement',id:'training'}]},{schemaVersion:1,id:'mobility',name:'Mobility',description:'Synthetic',level:9,automation:'manual',trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],passiveImplementationReferences:[{kind:'feature',id:'mobility'}]},{schemaVersion:1,id:'initiative',name:'Initiative',description:'Synthetic',level:13,automation:'manual',trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],passiveImplementationReferences:[{kind:'feature',id:'initiative'}]}]}]}}}
it.each(['full','foreign-class','foreign-subclass','wrong-level','manual-feature','missing-feature','invalid-speed','unsupported-static','unknown-expertise']as const)('recognizes only executed and correctly owned passive reference capabilities: %s',mode=>{
 const value=fixture(),feature=value.content.features[0]
 if(mode==='foreign-class')feature.sourceClassId='fighter'
 if(mode==='foreign-subclass')feature.sourceSubclassId=namespace+':other'
 if(mode==='wrong-level')feature.minimumLevel=8
 if(mode==='manual-feature')feature.automation='manual'
 if(mode==='missing-feature')value.content.features=value.content.features.filter(row=>row.id!=='mobility')
 if(mode==='invalid-speed')feature.staticModifiers={existingMovementSpeedBonuses:{walk:0}}
 if(mode==='unsupported-static')feature.staticModifiers={canBreatheWater:true}
 if(mode==='unknown-expertise')value.content.subclasses[0].advancements=[{schemaVersion:1,id:'training',level:3,kind:'build-grant',grants:[{kind:'tag',key:'skill-expertise',value:'unknown-skill'}]}]
 const entries=dnd5eContentPackageAutomationCoverageV2(value).entries.filter(row=>row.category==='subclass-ability')
 expect(entries.find(row=>row.id==='path:training')?.status).toBe(mode==='unknown-expertise'?'manual':'full')
 expect(entries.find(row=>row.id==='path:mobility')?.status).toBe(mode==='full'||mode==='unknown-expertise'?'full':'manual')
 expect(entries.find(row=>row.id==='path:initiative')?.status).toBe('full')
})
