import { describe, expect, it } from 'vitest'
import { dnd5ePluginSpellDefinition } from './plugins/pluginContentCatalog'
import { dnd5ePluginSpellActivity } from './pluginSpellTransaction'
import { getDnd5eSrdCombatSpell } from './spells'
import { dnd5eSpellUsesNarrativeResolution } from './spellNarrativeResolution'
const spells = ['slow','spare-the-dying','speak-with-animals','speak-with-dead','speak-with-plants','spider-climb','spike-growth','spirit-guardians','spiritual-weapon','stinking-cloud','stone-shape']
describe('spell batch 100–110',()=>{
 it.each(spells)('%s has an automatic route without an Activity approval',id=>{
  const definition=dnd5ePluginSpellDefinition(id)
  const activity=definition&&dnd5ePluginSpellActivity(definition)
  expect(Boolean(getDnd5eSrdCombatSpell(id)||activity)).toBe(true)
  expect(activity?.outcomes.flatMap(o=>o.operations).filter(o=>o.kind==='manual-adjudication')??[]).toEqual([])
 })
 it.each(['speak-with-animals','speak-with-dead','speak-with-plants'])('%s retains a ten-minute status instead of taking the slot-only shortcut',id=>{
  const activity=dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition(id)!)!
  expect(dnd5eSpellUsesNarrativeResolution(id,activity)).toBe(false)
  expect(activity.effects?.[0]).toMatchObject({duration:{kind:'rounds',rounds:100},stacking:'replace'})
  expect(activity.outcomes[0].operations[0]).toMatchObject({kind:'apply-effect',target:'actor'})
 })
 it.each(['spike-growth','spirit-guardians','spiritual-weapon','stinking-cloud','slow'])('%s never uses resource-only narrative settlement',id=>expect(dnd5eSpellUsesNarrativeResolution(id)).toBe(false))
})
