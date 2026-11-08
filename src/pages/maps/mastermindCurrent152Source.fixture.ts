import fs from'node:fs'
import{expect}from'vitest'
import{createHash}from'node:crypto'
import{readLegacyDnd5eStarMod}from'../../rulesets/dnd5e/starModAdapter'
import{dnd5eRulesPluginFromContentPackageV2}from'../../rulesets/dnd5e/contentPackageV2'
import{registerDnd5eRulesPlugin}from'../../rulesets/dnd5e/pluginApi'
export async function installCurrent152(){const path='.codex-temp/xge-next-feature/mastermind/formal-cumulative-base152-root-r2/sealed-r1/private-base152-mastermind-prospective153-round2.starmod',bytes=fs.readFileSync(path);expect(createHash('sha256').update(bytes).digest('hex')).toBe('2524b07fa79696f54b9e195cc7b9071faa5ebb6ef6f1899cf333511b5a059c56');const source=await readLegacyDnd5eStarMod(new Uint8Array(bytes).buffer);if(!source)throw Error('Actual standard current152 candidate required');return registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(source.package))}
