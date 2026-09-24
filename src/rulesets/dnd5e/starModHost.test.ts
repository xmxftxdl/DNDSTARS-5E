import { afterEach, expect, it, vi } from 'vitest'
import { exposeDnd5eRulesPluginHost, loadInstalledDnd5eRulesPlugins } from './pluginLoader'
import { exportLegacyDnd5eStarMod } from './starModAdapter'
import { unregisterDnd5eRulesPlugin } from './pluginApi'
import { communityPackageRegistry } from '../../domain/packages/packageRegistry'
import type { Dnd5eContentPackageV2 } from './contentPackageV2'

const ids = ['community.host-base','community.host-dependent']
afterEach(() => { for(const id of [...ids].reverse()) unregisterDnd5eRulesPlugin(id); vi.unstubAllGlobals() })
function environment() {
  const storage = new Map<string,string>(), packages = new Map<string,Record<string,unknown>>()
  vi.stubGlobal('window', {crypto:globalThis.crypto,btoa:globalThis.btoa,
    localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)},
    astralTraceDesktop:{pluginPackages:{put:async (v:Record<string,unknown>)=>{packages.set(String(v.pluginId),v)},get:async(id:string)=>packages.get(id)??null,remove:async(id:string)=>{packages.delete(id)}}}})
  return exposeDnd5eRulesPluginHost()
}
function fixture(id: string, dependency?: string): Dnd5eContentPackageV2 {
  return {format:'dndstars5e-content',schemaVersion:2,manifest:{id,name:id,version:'1.0.0',publisher:'Tests',license:'CC0-1.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',pluginKind:'content-package',distributionPolicy:'local-only',dependencies:dependency?[{id:dependency,versionRange:'^1.0.0'}]:[]},
    provenance:{edition:'2014',contentMode:'incremental',sourceTitle:'Tests'},assets:[],content:{races:[],backgrounds:[],features:[{id:`${id}.feature`,name:'Test',summary:'Test',description:'Test',automation:'manual'}],feats:[],spells:[],items:[],abilityGenerationMethods:[],headlessActions:[],classes:[],subclasses:[],monsters:[]}}
}
it('installs, persists, disables, reloads dependencies, rolls back failed updates and removes neutral packages', async () => {
  const host=environment()
  const file=async(p:Dnd5eContentPackageV2)=>new File([await exportLegacyDnd5eStarMod(p)],`${p.manifest.id}.starmod`)
  await host.installFile(await file(fixture(ids[0])))
  await host.installFile(await file(fixture(ids[1],ids[0])))
  expect(communityPackageRegistry.list().some(p=>p.packageId===ids[1])).toBe(true)
  await expect(host.setEnabled(ids[0],false)).rejects.toThrow('依赖')
  // Updating the dependency changes storage order; reload must still resolve it first.
  await host.installFile(await file(fixture(ids[0])))
  ids.forEach(unregisterDnd5eRulesPlugin)
  expect(await loadInstalledDnd5eRulesPlugins()).toEqual([])
  const invalidUpdate=fixture(ids[0]); invalidUpdate.manifest.version='2.0.0'
  await expect(host.installFile(await file(invalidUpdate))).rejects.toThrow('dependency-in-use')
  expect(host.listActive().find(p=>p.id===ids[0])?.version).toBe('1.0.0')
  await host.setEnabled(ids[1],false)
  expect(host.listInstalled().find(p=>p.id===ids[1])?.enabled).toBe(false)
  expect(communityPackageRegistry.list().some(p=>p.packageId===ids[1])).toBe(false)
  await host.setEnabled(ids[1],true)
  for(const id of [...ids].reverse()) await host.remove(id)
  expect(host.listInstalled()).toEqual([])
})

it('does not re-enable a disabled package when an update fails dependency validation',async () => {
 const host=environment(), original=fixture(ids[0])
 await host.installFile(new File([await exportLegacyDnd5eStarMod(original)],'original.starmod'))
 await host.setEnabled(ids[0],false)
 const update=fixture(ids[0],'missing.dependency'); update.manifest.version='1.1.0'
 await expect(host.installFile(new File([await exportLegacyDnd5eStarMod(update)],'update.starmod'))).rejects.toThrow('dependency-unavailable')
 expect(host.listInstalled().find(p=>p.id===ids[0])?.enabled).toBe(false)
 expect(host.listActive().some(p=>p.id===ids[0])).toBe(false)
 await host.remove(ids[0])
})
