import {readFile, writeFile} from 'node:fs/promises'
import {parseDnd5eUnifiedContentBundleV1} from '../../src/rulesets/dnd5e/unifiedContent'
import {exportDnd5eStarMod, projectDnd5eStarModRuntime} from '../../src/rulesets/dnd5e/starModAdapter'
import {readStarModArchive,writeStarModArchive} from '../../src/domain/packages/starmodArchive'
export async function buildCommunityModule(source:string,output:string,script?:string) {
 const content = parseDnd5eUnifiedContentBundleV1(await readFile(source,'utf8'))
 if(!content) throw new Error('Expected a unified content JSON bundle')
 let bytes=await exportDnd5eStarMod(content)
 if(script) {
  const pkg=await readStarModArchive(bytes)
  pkg.manifest.script={apiVersion:1,entry:'scripts/main.mjs'}
  pkg.manifest.permissions=[...pkg.manifest.permissions,'automation.script']
  pkg.script=await readFile(script,'utf8')
  bytes=await writeStarModArchive(pkg)
  await projectDnd5eStarModRuntime(bytes)
 }
 await writeFile(output,new Uint8Array(bytes))
 process.stdout.write(`Created ${output}\n`)
}
