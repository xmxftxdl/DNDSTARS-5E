import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {it,expect,vi} from 'vitest'
import {readLegacyDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin,dnd5eSpellAttackRangeMultiplierForCharacter,dnd5eSpellWithRangeForCharacter} from './pluginApi'
import * as catalog from './plugins/pluginContentCatalog'
import {genuineSpellFormalWard} from '../../pages/maps/mastermindSpellFormalWardWorld.fixture'
import {dnd5eCombatantCoverRedirectFeatureIds,dnd5eMaximizesSpellHealingAtZeroHp,dnd5eSpellRangeMinimum} from './headlessCombatEngine'
import {dnd5eUtilityProjectionAttackAdvantageApplies} from './utilityProjection'
import {dnd5eCombatantEnvironmentalImmunities,dnd5eCharacterEnvironmentalImmunities} from './environmentalProtection'

it('actual single557 scalar reads retain public-copy results without whole-catalog cloning; editable snapshots and unload remain isolated',async()=>{
 const bytes=fs.readFileSync('.codex-temp/xge-next-feature/root-merge-preparation/prospective155-package-r305-r1/private-base152-prospective155-round2.starmod')
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('b62851790a2e421b04fc42bf64c77372d7d3a7931c2ffbce62f9705c269a02f9')
 const imported=await readLegacyDnd5eStarMod(new Uint8Array(bytes).buffer);if(!imported)throw Error('Actual package import required')
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(imported.package))
 try{
  const f=await genuineSpellFormalWard(),state=f.prepared.state,actor=state.combatants['mage-token'],target=state.combatants['second-owner-token'],owner=state.combatants['owner-token']??state.combatants['second-owner-token'],character=f.prepared.actor
  expect(actor).toBeDefined();expect(target).toBeDefined();const runtime=catalog.runtimeDnd5ePluginFeatures();expect(runtime.length).toBeGreaterThan(100);expect(Object.isFrozen(runtime)).toBe(true)
  const spell={id:'fire-bolt',rangeFeet:120},read=()=>({advantage:dnd5eUtilityProjectionAttackAdvantageApplies(state,actor,target),multiplier:dnd5eSpellAttackRangeMultiplierForCharacter(character),spell:dnd5eSpellWithRangeForCharacter(spell,character),cover:dnd5eCombatantCoverRedirectFeatureIds(owner),healing:dnd5eMaximizesSpellHealingAtZeroHp(actor),range:dnd5eSpellRangeMinimum(actor,'fire-bolt',120),environment:dnd5eCombatantEnvironmentalImmunities(actor),characterEnvironment:dnd5eCharacterEnvironmentalImmunities(character)})
  const originalClone=globalThis.structuredClone;let copies=0
  const clone=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{if(value&&typeof value==='object'&&'ownerPluginId'in value&&'automation'in value)copies++;return originalClone(value,options)})
  try{
   const publicReader=vi.spyOn(catalog,'runtimeDnd5ePluginFeatures').mockImplementation(()=>catalog.registeredDnd5ePluginFeatures())
   let reference:ReturnType<typeof read>,referenceCopies:number
   try{copies=0;reference=read();referenceCopies=copies}finally{publicReader.mockRestore()}
   copies=0;const result=read(),runtimeCopies=copies;expect(result).toEqual(reference!);expect(referenceCopies!).toBeGreaterThan(runtime.length);expect(runtimeCopies).toBeLessThan(referenceCopies!);expect(runtimeCopies).toBe(0)
  }finally{clone.mockRestore()}
  const editable=catalog.registeredDnd5ePluginFeatures(),first=editable[0],originalName=runtime.find(row=>row.id===first.id)!.name;first.name='caller-edited';expect(catalog.runtimeDnd5ePluginFeatures().find(row=>row.id===first.id)!.name).toBe(originalName)
  const nested=editable.find(row=>row.declarativeAbility);expect(nested).toBeDefined();expect(Reflect.set(nested!.declarativeAbility!,'__callerMarker',true)).toBe(true);expect(Object.hasOwn(catalog.runtimeDnd5ePluginFeatures().find(row=>row.id===nested!.id)!.declarativeAbility!,'__callerMarker')).toBe(false)
  dispose();expect(catalog.runtimeDnd5ePluginFeatures().some(row=>row.ownerPluginId==='local.xge.repaired.archer93')).toBe(false);expect(catalog.runtimeDnd5ePluginFeatures()).not.toBe(runtime)
 }finally{dispose()}
})
