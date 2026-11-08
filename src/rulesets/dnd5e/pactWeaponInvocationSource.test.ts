// Self-contained registered source fixture; no package/ledger/temp file reads.
const pactSource={name:'Improved Pact Weapon',text:'Registered full Pact Blade invocation source fixture.'}
function improvedPactWeaponSource(namespace:string){return{
 id:'improved-pact-weapon',name:pactSource.name,summary:'刃之魔契武器可作邪术师法器；无固有攻伤魔法加值时获得+1，并允许塑造四类远程武器。',description:pactSource.text,automation:'full' as const,
 classRequirements:[{classId:'warlock',minimumLevel:3}],classChoiceRequirements:[{classId:'warlock',groupId:'pact-boon',anyOf:['blade']},{classId:'warlock',groupId:'eldritch-invocations',anyOf:[namespace+':improved-pact-weapon']}],
 declarativeAbility:{schemaVersion:1 as const,id:'improved-pact-weapon',name:pactSource.name,description:pactSource.text,level:3,trigger:{kind:'passive' as const},cost:{economy:'none' as const},targeting:{kind:'self' as const},effects:[],mechanic:{kind:'improved-pact-weapon' as const},automation:'full' as const}
}}

import{it,expect}from'vitest'
import{normalizeCharacter}from'../../store/characters'
import{registerDnd5eRulesPlugin,dnd5eCharacterHasPluginFeature}from'./pluginApi'
import{dnd5eClassDefinition,dnd5eClassChoiceOptionAvailable}from'./classes'
import{applyDnd5eLevelAdvancement}from'./levelAdvancement'
import{pactWeaponHasImprovedInvocation}from'./pactWeaponEntitlement'

const ns='test.pact-source-choice',id=ns+':improved-pact-weapon'
function install(outer:'full'|'manual'|'partial'='full',inner:'full'|'manual'|'partial'='full'){
 return registerDnd5eRulesPlugin({manifest:{id:ns,name:'Source choice fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'Private'},setup(api){const source=improvedPactWeaponSource(ns);api.registerFeature({...source,automation:outer,declarativeAbility:{...source.declarativeAbility,automation:inner}})}})
}
const before=()=>normalizeCharacter({id:'owner',name:'Owner',charClass:'邪术师',level:2,dnd5eClassLevels:{warlock:2},currentHp:20,maxHp:20,abilities:{str:10,dex:14,con:12,int:10,wis:10,cha:16},dnd5eClassChoices:{classes:{warlock:{subclass:'fiend',selections:{'eldritch-invocations':['armor-of-shadows','devils-sight'],'spell-cantrips':['eldritch-blast','mage-hand'],'spell-known':['charm-person','comprehend-languages','expeditious-retreat']}}}}})
it('real class-choice list and actual 2→3 advancement acquire the invocation in an existing legal slot, without copied feature IDs',()=>{
 const dispose=install();try{
  const group=dnd5eClassDefinition('warlock')!.choiceGroups!.find(row=>row.id==='eldritch-invocations')!,option=group.options.find(row=>row.id===id);expect(option).toBeTruthy()
  expect(dnd5eClassChoiceOptionAvailable({...before(),level:3},'warlock',option!)).toBe(false)
  const result=applyDnd5eLevelAdvancement(before(),{schemaVersion:1,classId:'warlock',subclassId:'fiend',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],spellSelections:{cantrips:['eldritch-blast','mage-hand'],knownSpells:['charm-person','comprehend-languages','expeditious-retreat','hold-person']},classChoiceSelections:{'pact-boon':['blade'],'eldritch-invocations':['armor-of-shadows',id]}})
  expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
  expect(result.character.dnd5ePluginFeatureIds??[]).not.toContain(id);expect(result.character.dnd5eClassChoices?.classes?.warlock?.selections?.['eldritch-invocations']).toEqual(['armor-of-shadows',id]);expect(dnd5eCharacterHasPluginFeature(result.character,id)).toBe(true);expect(pactWeaponHasImprovedInvocation(result.character)).toBe(true)
  const unowned={...result.character,dnd5eClassChoices:{classes:{warlock:{selections:{'pact-boon':['blade'],'eldritch-invocations':['armor-of-shadows','devils-sight']}}}}};expect(pactWeaponHasImprovedInvocation(unowned)).toBe(false)
 }finally{dispose()}
 expect(dnd5eClassDefinition('warlock')!.choiceGroups!.find(row=>row.id==='eldritch-invocations')!.options.some(row=>row.id===id)).toBe(false)
})
it.each([['manual','full'],['partial','full'],['full','manual'],['full','partial']]as const)('manual/partial source %s/%s never becomes an automatic invocation option',(outer,inner)=>{const dispose=install(outer,inner);try{expect(dnd5eClassDefinition('warlock')!.choiceGroups!.find(row=>row.id==='eldritch-invocations')!.options.some(row=>row.id===id)).toBe(false)}finally{dispose()}})
