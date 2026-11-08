import {it,expect} from 'vitest'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {actualStormPreparedWireWitness as witness} from './stormSorcery.actualPreparedWire.fixture'
import {decodeSecondChanceParentWire,encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {restoreStormOriginalPreparedGraph} from './stormOriginalPreparedGraph'
import type {resolvePreparedDnd5eSpellCast} from './spellAction'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
function actual(){const json=gunzipSync(Buffer.from(witness.base64Gzip,'base64')).toString('utf8');expect(createHash('sha256').update(json).digest('hex')).toBe(witness.sourceSHA256);return(decodeSecondChanceParentWire(JSON.parse(json)) as Source).prepared}
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
it('preserves the exact reference graph from actual failed room Y956ZV while the old state-only restore demonstrably changes it',()=>{
 const original=actual(),live={...cloneDnd5eHostTransactionInput(original),state:structuredClone(original.state)},old={...cloneDnd5eHostTransactionInput(live),state:structuredClone(original.state)}
 expect(old).toEqual(original);expect(signature(old)).not.toBe(signature(original))
 const restored=restoreStormOriginalPreparedGraph(original,live)
 expect(signature(restored)).toBe(signature(original));expect(restored).not.toBe(original)
})
it('restores the original pre-cost state without writing through either actual input or the separate prefix preview',()=>{
 const original=actual(),originalWire=signature(original),preview=structuredClone(original.state);preview.combatants['foe-token'].currentHp=7
 const live={...cloneDnd5eHostTransactionInput(original),state:preview},liveWire=signature(live),restored=restoreStormOriginalPreparedGraph(original,live)
 expect(restored.state.combatants['foe-token'].currentHp).toBe(10);expect(live.state.combatants['foe-token'].currentHp).toBe(7);expect(signature(restored)).toBe(originalWire);expect(signature(original)).toBe(originalWire);expect(signature(live)).toBe(liveWire)
})
it('retains a genuinely changed late property so the unchanged strict prepared binding still rejects it',()=>{
 const original=actual(),live={...cloneDnd5eHostTransactionInput(original),state:structuredClone(original.state)}
 if(!live.savingThrow)throw Error('Actual retained Shatter saving throw required')
 live.savingThrow.dc++
 const restored=restoreStormOriginalPreparedGraph(original,live)
 expect(restored.savingThrow?.dc).toBe(live.savingThrow.dc);expect(signature(restored)).not.toBe(signature(original));expect(original.savingThrow?.dc).toBe(live.savingThrow.dc-1)
})
