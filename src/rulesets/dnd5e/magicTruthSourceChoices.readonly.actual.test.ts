import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {it,expect,vi} from 'vitest'
import * as api from './pluginApi'
import * as catalog from './plugins/pluginContentCatalog'
import {readLegacyDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,validateDnd5eUnifiedContentBundleV1} from './unifiedContent'
import {featureDiagnosticBundle,growWizard} from '../../pages/maps/mastermindMagicFamilies.fixture'
import {mastermindNativeMagicSourceChoices} from '../../components/map/MastermindNativeMagicTruthCastPanel'
import type {Character} from '../../types/character'

it('genuine557 plus real Wizard4 feat and prepared registered spell retain editable source DTOs without whole feature copies',async()=>{
 const bytes=fs.readFileSync('.codex-temp/xge-next-feature/root-merge-preparation/prospective155-package-r305-r1/private-base152-prospective155-round2.starmod')
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('b62851790a2e421b04fc42bf64c77372d7d3a7931c2ffbce62f9705c269a02f9')
 const imported=await readLegacyDnd5eStarMod(new Uint8Array(bytes).buffer);if(!imported)throw Error('Genuine original557 import required')
 const disposeFull=api.registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(imported.package)),bundle=featureDiagnosticBundle()
 expect(validateDnd5eUnifiedContentBundleV1(bundle)).toEqual([])
 const disposeDiagnostic=api.registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
 try{
  const feat=bundle.manifest.id+':truth-assay-feat',spell=bundle.manifest.id+':truth-assay',beforeFeat=growWizard(16,'evocation',3,undefined,spell),reader=growWizard(16,'evocation',4,feat,spell)
  expect(beforeFeat.dnd5eFeatIds??[]).not.toContain(feat);expect(reader.dnd5eFeatIds).toContain(feat);expect(reader.dnd5ePluginFeatureIds??[]).toEqual([])
  const read=()=>mastermindNativeMagicSourceChoices(reader)
  const reference=vi.spyOn(api,'dnd5eRuntimePluginFeaturesAvailableForCharacter').mockImplementation(api.dnd5ePluginFeaturesAvailableForCharacter)
  let expected:ReturnType<typeof read>,oldBeforeFeat:ReturnType<typeof read>
  try{expected=read();oldBeforeFeat=mastermindNativeMagicSourceChoices(beforeFeat)}finally{reference.mockRestore()}
  const featFeature=api.dnd5ePluginFeaturesAvailableForCharacter(reader).find(feature=>feature.sourceFeatId===feat)
  if(!featFeature)throw Error('Genuine acquired diagnostic feat feature required')
  const beforeGranted=api.dnd5eCharacterHasPluginFeature(beforeFeat,featFeature.id),afterGranted=api.dnd5eCharacterHasPluginFeature(reader,featFeature.id)
  expect(beforeGranted).toBe(false);expect(afterGranted).toBe(true)
  // The historical picker offers eligible sources; actual dispatch separately
  // requires acquisition. Preserve that original distinction in this change.
  expect(oldBeforeFeat!.some(value=>value.source.kind==='feature'&&value.source.featureId===featFeature.id)).toBe(true)
  const currentBeforeFeat=mastermindNativeMagicSourceChoices(beforeFeat)
  expect(currentBeforeFeat).toEqual(oldBeforeFeat!)
  if(process.env.C41_PRIVATE_EVIDENCE_ROOT)fs.writeFileSync(process.env.C41_PRIVATE_EVIDENCE_ROOT+'/before-feat-eligibility.json',JSON.stringify({wizard3FeatIds:beforeFeat.dnd5eFeatIds??[],wizard4FeatIds:reader.dnd5eFeatIds??[],featId:feat,featureId:featFeature.id,beforeGranted,afterGranted,oldPublicBeforeFeat:oldBeforeFeat!,currentBeforeFeat,eligiblePickerIsNotDispatchAuthority:true},null,2),{flag:'wx'})
  expect(expected!.some(value=>value.source.kind==='spell'&&value.source.spellId===spell)).toBe(true)
  expect(expected!.some(value=>value.source.kind==='feature'&&value.source.selectedActivityId==='truth-assay-feature')).toBe(true)
  read() // Warm immutable feature classification only; no choices or actor result is cached.
  const originalClone=globalThis.structuredClone;let wholeFeatureCopies=0
  const clones=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{if(value&&typeof value==='object'&&'ownerPluginId'in value&&'automation'in value)wholeFeatureCopies++;return originalClone(value,options)})
  try{expect(read()).toEqual(expected!);expect(read()).toEqual(expected!);expect(wholeFeatureCopies).toBe(0)}finally{clones.mockRestore()}
  const editable=read();expect(Object.isFrozen(editable)).toBe(false);expect(Object.isFrozen(editable[0])).toBe(false);expect(Object.isFrozen(editable[0].source)).toBe(false)
  editable[0].label='caller edit';Object.assign(editable[0].source,{spellId:'caller edit',featureId:'caller edit'});editable.pop()
  expect(read()).toEqual(expected!)
  expect(mastermindNativeMagicSourceChoices(beforeFeat)).toEqual(oldBeforeFeat!)
  disposeDiagnostic();expect(mastermindNativeMagicSourceChoices(reader)).toEqual([])
 }finally{disposeDiagnostic();disposeFull()}
},60000)

const controlId='test.magic-source-readonly',featureId=controlId+':guard'
function install(extra:Record<string,unknown>={},available?:(actor:Character)=>boolean){return api.registerDnd5eRulesPlugin({manifest:{id:controlId,name:'Source reader boundary diagnostic',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(host){host.registerFeature({id:'guard',name:'Guard',summary:'Boundary only',description:'Boundary only',automation:'full',...extra,...(available?{isAvailable:available}:{})})}})}
function controlActor(){return {...growWizard(16,'evocation',3),dnd5ePluginFeatureIds:[featureId]}}
function oldChoices(actor:Character){const old=vi.spyOn(api,'dnd5eRuntimePluginFeaturesAvailableForCharacter').mockImplementation(api.dnd5ePluginFeaturesAvailableForCharacter);try{return mastermindNativeMagicSourceChoices(actor)}finally{old.mockRestore()}}

it('availability callback uses its original editable receiver and runs for each current actor or original exception',()=>{
 const actor=controlActor(),failure=Error('original source availability failure');let fail=false,calls=0
 const available=function(this:Record<string,unknown>,current:Character){calls++;this.__receiverEdit=true;if(fail)throw failure;return current.level>=4}
 const dispose=install({},available)
 try{
  expect(mastermindNativeMagicSourceChoices(actor)).toEqual(oldChoices(actor));expect(calls).toBeGreaterThanOrEqual(2)
  actor.level=4;const before=calls;expect(mastermindNativeMagicSourceChoices(actor)).toEqual(oldChoices(actor));expect(calls).toBeGreaterThanOrEqual(before+2)
  fail=true;expect(()=>mastermindNativeMagicSourceChoices(actor)).toThrow(failure)
  try{mastermindNativeMagicSourceChoices(actor)}catch(error){expect(error).toBe(failure)}
 }finally{dispose()}
},60000)

it.each([new Map(),new Set(),new Date(0),new Uint8Array([1]),...(typeof SharedArrayBuffer==='function'?[new SharedArrayBuffer(4)]:[])])('unknown or special feature data retains original public clone/freeze behavior: %s',extraData=>{
 const actor=controlActor(),dispose=install({extraData})
 try{
  let raw:{extraData:unknown}|undefined,initialError:unknown
  try{raw=catalog.runtimeDnd5ePluginFeatures().find(v=>v.id===featureId) as unknown as {extraData:unknown}}catch(error){initialError=error}
  if(initialError){expect(()=>mastermindNativeMagicSourceChoices(actor)).toThrow((initialError as Error).message);return}
  if(!raw)throw Error('Actual diagnostic source required')
  if(raw.extraData instanceof Map)raw.extraData.set('uncloneable',new Proxy({value:1},{}))
  if(raw.extraData instanceof Set)raw.extraData.add(()=>1)
  let reference:ReturnType<typeof mastermindNativeMagicSourceChoices>|undefined,originalError:unknown
  try{reference=oldChoices(actor)}catch(error){originalError=error}
  if(originalError)expect(()=>mastermindNativeMagicSourceChoices(actor)).toThrow((originalError as Error).message)
  else expect(mastermindNativeMagicSourceChoices(actor)).toEqual(reference)
 }finally{dispose()}
},60000)

it('optional plain graph inspection errors preserve the old SourceChoices result',()=>{
 const actor=controlActor(),dispose=install()
 try{
  const runtime=catalog.runtimeDnd5ePluginFeatures(),original=Object.getPrototypeOf
  const inspect=vi.spyOn(Object,'getPrototypeOf').mockImplementation(value=>{if(value===runtime)throw Error('diagnostic source classifier failure');return original(value)})
  try{expect(mastermindNativeMagicSourceChoices(actor)).toEqual(oldChoices(actor))}finally{inspect.mockRestore()}
 }finally{dispose()}
},60000)
