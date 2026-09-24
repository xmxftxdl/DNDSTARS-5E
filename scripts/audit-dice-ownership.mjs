import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import ts from 'typescript'
const sourcePath = 'src/pages/MapsWorkspacePage.tsx'
const text = readFileSync(sourcePath, 'utf8')
const source = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const callSites = [], errors = []
function walk(node) {
 if (ts.isCallExpression(node) && ['rollDiceBoxD20','rollDiceBoxValues'].includes(node.expression.getText(source))) {
  const index = node.expression.getText(source) === 'rollDiceBoxD20' ? 2 : 4
  const owner = node.arguments[index]
  const ownerText = owner?.getText(source) ?? ''
  const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
  if (!owner || (ts.isObjectLiteralExpression(owner) && !/rollerTokenId|rollerCharacterId|freeRoll|\.\.\./.test(ownerText))) errors.push(`缺少归属参数：${sourcePath}:${line}`)
  callSites.push({line, kind: node.expression.getText(source), ownership: ownerText})
 }
 ts.forEachChild(node, walk)
}
walk(source)
const modules = {
 catalog: 'spellCatalog', core: 'spells',
 audited: 'activities/dnd5eSrdAuditedSpellActivities',
 recipes: 'activities/dnd5eActivityHeadlessCompiler',
 planner: 'activities/dnd5eActivityPerTargetRolls',
}
const cache = 'node_modules/.cache/dice-ownership-audit'
mkdirSync(cache, { recursive: true })
const entry = `${cache}/entry.mjs`
writeFileSync(entry, Object.entries(modules).map(([name, path]) =>
 `export * as ${name} from ${JSON.stringify(resolve('src/rulesets/dnd5e', path + '.ts').replaceAll('\\', '/'))};`).join('\n'))
const bundle = await rolldown({input: entry, platform: 'node',
 external: id => !id.startsWith('.') && !isAbsolute(id), logLevel: 'silent'})
const runtime = `${cache}/runtime.mjs`
await bundle.write({file: runtime, format: 'esm'})
await bundle.close()
const { catalog, core, audited, recipes, planner } = await import(pathToFileURL(resolve(runtime)).href)
let spells
{
 const content = [...audited.dnd5eSrdAuditedFullContentDefinitionsV1(),...audited.dnd5eSrdAuditedPartialContentDefinitionsV1(),...audited.dnd5eSrdAuditedManualContentDefinitionsV1()]
 const coreMap = new Map(core.DND5E_SRD_COMBAT_SPELLS.map(s=>[s.id,s]))
 spells = catalog.DND5E_SRD_SPELL_CATALOG.map(spell=>{
   const native = coreMap.get(spell.id)
   const definition = content.find(d=>d.id===spell.id)
   const activity = audited.dnd5eSrdAuditedCoreOverrideSpellActivityV1(spell.id) ?? audited.dnd5eSrdAuditedSpellActivityV1(spell.id)
   const activities = definition?.activities?.length ? definition.activities : activity ? [activity] : []
   let declarations = 0
   for(const a of activities) {
     const checks = a.checks ?? []
     const rolls = recipes.collectDnd5eActivityFormulaRollDeclarationsV1(a, false)
     for(const check of checks.filter(c=>c.scope==='per-target')) {
       if(!rolls.some(r=>r.id===check.rollId)) rolls.push({id:check.rollId,count:check.count??1,sides:check.sides??20,label:check.id})
       if(check.kind==='opposed-ability-check'&&!rolls.some(r=>r.id===check.opposedRollId)) rolls.push({id:check.opposedRollId,count:1,sides:20,label:check.id})
     }
     const choices = Object.fromEntries((a.choices??[]).map(c=>[c.id,c.options[0]?.id]))
     for(const check of checks) if(check.appliesWhenChoice) choices[check.appliesWhenChoice.choiceId]=check.appliesWhenChoice.optionIds[0]
     const planned = planner.dnd5eActivityPerTargetRollDeclarationsV1({activity:a,declarations:rolls,
       actor:{id:'caster',controller:'players'},targets:[{id:'player-target',controller:'players'},{id:'monster-target',controller:'dm'}],
       choices,hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal',hostAbilityCheckMode:()=> 'normal'})
     for(const roll of planned) {
       const targetId = roll.id.endsWith(':player-target')?'player-target':'monster-target'
       const baseId = roll.id.slice(0,-targetId.length-1)
       const check = checks.find(c=>c.scope==='per-target'&&(c.rollId===baseId||c.opposedRollId===baseId))
       const expected = check?.kind==='saving-throw'||(check?.kind==='opposed-ability-check'&&check.opposedRollId===baseId)?targetId:'caster'
       if(roll.rollerTokenId!==expected) errors.push(`${spell.id}/${a.id}/${roll.id}: 应归 ${expected}，实际 ${roll.rollerTokenId}`)
       declarations++
     }
   }
   return {id:spell.id,name:spell.name,route:native?'core-spell':activities.length?'activity':'manual-no-generated-dice',
     attackOwner:'caster',damageOwner:'caster',savingThrowOwner:'saving-character',activities:activities.length,testedDeclarations:declarations,
     nativeDice:native?{effect:native.effect,dice:native.dice,delayedDamage:native.delayedDamage}:undefined}
 })
}
const summary={spells:spells.length,callSites:callSites.length,freeRollExceptions:callSites.filter(c=>c.ownership.includes('freeRoll: true')).length,
 testedDeclarations:spells.reduce((n,s)=>n+s.testedDeclarations,0),routes:Object.fromEntries(['core-spell','activity','manual-no-generated-dice'].map(r=>[r,spells.filter(s=>s.route===r).length])),errors:errors.length}
writeFileSync('docs/dice-ownership-audit.json',JSON.stringify({summary,errors,spells,callSites},null,2)+'\n')
console.log(JSON.stringify(summary,null,2))
if(errors.length){ console.error(errors.join('\n'));process.exitCode=1 }
