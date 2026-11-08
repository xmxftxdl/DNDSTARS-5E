/// <reference types="node" />
import{it,expect}from'vitest';
import{buildActivityCumulativeScene}from'../../rulesets/dnd5e/testFixtures/bountifulActivityCumulative.scene.fixture';
import{genuineSpellFormalWard}from'./mastermindSpellFormalWardWorld.fixture';
import{mastermindSpellWindowRuleSignature}from'./mastermindSpellWindowParent';
import type{PreparedDnd5eSpellCast}from'../../rulesets/dnd5e/spellAction';
import{getDnd5eCoreSpellRuntimeDefinitionV1}from'../../rulesets/dnd5e/activities/dnd5eCoreSpellActivities';
import{registerDnd5eRulesPlugin,type Dnd5eRulesPlugin}from'../../rulesets/dnd5e/pluginApi';
import{registerContentDefinitionPackage}from'../../domain/content/contentDefinitionRegistry';
import{automationCapabilityFromLegacyStatus}from'../../domain/automation/automationCapability';
import{registeredDnd5ePluginFeatures,registeredDnd5ePluginResources,registeredDnd5ePluginSubclasses,registeredDnd5ePluginSpells,registeredDnd5ePluginItems,registeredDnd5ePluginMonsters,registeredDnd5ePluginFeats,registeredDnd5ePluginRaces,registeredDnd5ePluginBackgrounds,dnd5ePluginFeatureCurrentEnvelopeFullV1,dnd5ePluginSubclassCurrentEnvelopeFullV1}from'../../rulesets/dnd5e/plugins/pluginContentCatalog';
const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,ordered(x)])):v;
const signature=(v:unknown)=>JSON.stringify(ordered(v));
async function legacySignature(p:PreparedDnd5eSpellCast){
 const byId=<T extends{id:string}>(rows:readonly T[])=>[...rows].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),recipe=getDnd5eCoreSpellRuntimeDefinitionV1(p.spell.id)
 const raw=signature({recipe:recipe?.activity,prepared:p.activity,features:byId(registeredDnd5ePluginFeatures()).map(f=>({definition:f,currentFull:dnd5ePluginFeatureCurrentEnvelopeFullV1(f.id)})),subclasses:byId(registeredDnd5ePluginSubclasses()).map(s=>({definition:s,currentFull:dnd5ePluginSubclassCurrentEnvelopeFullV1(s.id)})),resources:byId(registeredDnd5ePluginResources()),spells:byId(registeredDnd5ePluginSpells()),items:byId(registeredDnd5ePluginItems()),monsters:byId(registeredDnd5ePluginMonsters()),feats:byId(registeredDnd5ePluginFeats()),races:byId(registeredDnd5ePluginRaces()),backgrounds:byId(registeredDnd5ePluginBackgrounds())})
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')
}
it('keeps the exact legacy SHA for a genuine prepared spell, live Full/content changes, unload/replacement and fresh prepared input',async()=>{
 const joint=await buildActivityCumulativeScene();const dispose:(()=>void)[]=[];
 try{const f=await genuineSpellFormalWard(),p=f.prepared,check=async()=>{const old=await legacySignature(p);expect(await mastermindSpellWindowRuleSignature(p)).toBe(old);return old};
 const original=await check();expect(await check()).toBe(original);
 const editable=registeredDnd5ePluginFeatures()[0];editable.description+=' caller copy';expect(await check()).toBe(original);
 const altered={...p,activity:{...p.activity,automation:automationCapabilityFromLegacyStatus('manual')}} as PreparedDnd5eSpellCast;expect(await mastermindSpellWindowRuleSignature(altered)).toBe(await legacySignature(altered));expect(await mastermindSpellWindowRuleSignature(altered)).not.toBe(original);
 const id='local.rule-feature-encoding';const plugin=(bonus:number):Dnd5eRulesPlugin=>({manifest:{id,name:'Signature fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerFeature({id:'guard',name:'Guard',summary:'Guard',description:'Guard',automation:'full',staticModifiers:{armorClassBonus:bonus}})}});
 const first=registerDnd5eRulesPlugin(plugin(1));dispose.push(first);const withFeature=await check();expect(withFeature).not.toBe(original);
 const content=registerContentDefinitionPackage({packageId:id,packageVersion:'1.0.0',definitions:[{schemaVersion:1,id:'guard',namespace:id,version:'1.0.0',kind:'feature',name:'Guard',payload:{id:'guard',automation:'manual'},automation:automationCapabilityFromLegacyStatus('manual')}]});dispose.push(()=>content.dispose());expect(await check()).not.toBe(withFeature);content.dispose();expect(await check()).toBe(withFeature);
 first();expect(await check()).toBe(original);dispose.push(registerDnd5eRulesPlugin(plugin(3)));expect(await check()).not.toBe(withFeature);
 }finally{for(const close of dispose.reverse())close();joint.dispose()}
},60000);
