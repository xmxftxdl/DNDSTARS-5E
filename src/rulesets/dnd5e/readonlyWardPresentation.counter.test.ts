import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {it,expect,vi} from 'vitest'
import * as api from './pluginApi'
import * as catalog from './plugins/pluginContentCatalog'
import {readLegacyDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {genuineSpellRedirectChainWorld} from '../../pages/maps/mastermindSpellRedirectChain.fixture'
import {captureMastermindObservationSource} from './mastermindObservation'
import Panel from '../../components/map/MastermindNativeSpellWindowPanel'

it('actual557 two readonly presentation consumers match old outputs without whole feature catalog copies',async()=>{
 const bytes=fs.readFileSync('.codex-temp/xge-next-feature/root-merge-preparation/prospective155-package-r305-r1/private-base152-prospective155-round2.starmod')
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('b62851790a2e421b04fc42bf64c77372d7d3a7931c2ffbce62f9705c269a02f9')
 const imported=await readLegacyDnd5eStarMod(new Uint8Array(bytes).buffer);if(!imported)throw Error('Actual557 package required')
 const dispose=api.registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(imported.package))
 try{
  const f=genuineSpellRedirectChainWorld(),characters=f.characters.map(actor=>actor.id===f.mage.id?{...actor,roomMemberId:'dm'}:actor)
  const read=()=>({source:captureMastermindObservationSource(f.first,'comparison').signature,panel:renderToStaticMarkup(createElement(Panel,{isDM:true,map:f.map,characters,session:{roomId:'room',memberId:'dm'},currentTokenId:'mage-token',paused:false,pending:false,pendingParents:[],onCast:()=>{},onResume:()=>{}}))})
  expect(catalog.runtimeDnd5ePluginFeatures().length).toBeGreaterThan(100)
  read() // Warm current immutable definitions and classification, never a result cache.
  const originalClone=globalThis.structuredClone;let copies=0
  const clone=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{if(value&&typeof value==='object'&&'ownerPluginId'in value&&'automation'in value)copies++;return originalClone(value,options)})
  try{
   // Existing API only on the old baseline: no import or call of a missing new export.
   const hasRuntime=typeof api.dnd5eRuntimePluginFeaturesAvailableForCharacter==='function'
   const oldReader=hasRuntime?vi.spyOn(api,'dnd5eRuntimePluginFeaturesAvailableForCharacter').mockImplementation(api.dnd5ePluginFeaturesAvailableForCharacter):undefined
   let reference:ReturnType<typeof read>,referenceCopies=0
   try{copies=0;reference=read();referenceCopies=copies}finally{oldReader?.mockRestore()}
   copies=0;const actual=read();expect(actual).toEqual(reference!);expect(referenceCopies).toBeGreaterThan(100);expect(copies).toBe(0)
  }finally{clone.mockRestore()}
  const source=captureMastermindObservationSource(f.first,'comparison');expect(source.isCurrent()).toBe(true);dispose();expect(source.isCurrent()).toBe(false)
 }finally{dispose()}
},60000)
