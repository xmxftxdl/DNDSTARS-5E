import {expect,it,vi} from 'vitest'
import {recoverOrphanedLongCasting} from './useOrphanedLongCastingRecovery'
import {dnd5eLongCastingConcentrationId,dnd5eLongCastingBindingFromConcentrationId} from '../../rulesets/dnd5e/longCastingIdentity'
const binding={requestId:'request',spellId:'package:spell',mapId:'map',actorTokenId:'token',actorCharacterId:'character'}
const id=dnd5eLongCastingConcentrationId(binding)
function fixture(){
 const characters=[{id:'character',dnd5eCombatState:{concentrationSpellId:id}}]
 const end=vi.fn(async()=>{}),pending=vi.fn(async()=>false),locallyActive=vi.fn(()=>false)
 const request=vi.fn(async(_name:string,_options:unknown,run:(lock:object|null)=>boolean|Promise<boolean>)=>run({}))
 return{characters,end,pending,locallyActive,request,input:{mapId:'map',readCharacters:()=>characters,end,pending,locallyActive,locks:{request}}}
}
it('ends only an orphan process under the same lock used by live requests',async()=>{
 const f=fixture();expect(await recoverOrphanedLongCasting(f.input)).toBe(1)
 expect(f.request).toHaveBeenCalledWith('astral-trace:dm-player-action:map:request',{mode:'exclusive',ifAvailable:true},expect.any(Function))
 expect(f.end).toHaveBeenCalledWith(binding,id)
})
it.each(['live','pending','locked'] as const)('does not interrupt a %s cast',async state=>{
 const f=fixture()
 if(state==='live')f.locallyActive.mockReturnValue(true)
 if(state==='pending')f.pending.mockResolvedValue(true)
 if(state==='locked')f.request.mockImplementation(async(_n,_o,run)=>run(null))
 expect(await recoverOrphanedLongCasting(f.input)).toBe(0);expect(f.end).not.toHaveBeenCalled()
})
it('rechecks current concentration after asynchronous queue reads',async()=>{
 const f=fixture();f.pending.mockImplementation(async()=>{f.characters[0].dnd5eCombatState.concentrationSpellId='replacement-spell';return false})
 expect(await recoverOrphanedLongCasting(f.input)).toBe(0);expect(f.end).not.toHaveBeenCalled()
})
it.each(['malformed','different-map','different-owner','duplicate-owner'] as const)('refuses ambiguous or invalid %s identity',async state=>{
 const f=fixture()
 if(state==='malformed')f.characters[0].dnd5eCombatState.concentrationSpellId='casting:[]'
 if(state==='different-map')f.input.mapId='other-map'
 if(state==='different-owner')f.characters[0].id='other-owner'
 if(state==='duplicate-owner')f.characters.push({...f.characters[0]})
 expect(await recoverOrphanedLongCasting(f.input)).toBe(0);expect(f.end).not.toHaveBeenCalled()
})
it('parses identity without treating malformed serialization as casting permission',()=>{
 expect(dnd5eLongCastingBindingFromConcentrationId(id)).toEqual(binding)
 for(const bad of ['spell','casting:[1,2,3,4,5]','casting:["a","b","c","d",""]','casting:{','casting:null'])expect(dnd5eLongCastingBindingFromConcentrationId(bad)).toBeUndefined()
})
it('does not end a live owner in an independent browser storage context',async()=>{
 const f=fixture(),ownerActive=vi.fn(async()=>true)
 expect(await recoverOrphanedLongCasting({...f.input,ownerActive})).toBe(0)
 expect(ownerActive).toHaveBeenCalledWith(binding);expect(f.end).not.toHaveBeenCalled()
})
it('cleans up only after the server confirms no live owner',async()=>{
 const f=fixture(),ownerActive=vi.fn(async()=>false)
 expect(await recoverOrphanedLongCasting({...f.input,ownerActive})).toBe(1)
 expect(f.end).toHaveBeenCalledWith(binding,id)
})
it('server ownership failure cannot authorize orphan cleanup',async()=>{
 const f=fixture(),ownerActive=vi.fn(async()=>{throw Error('casting-owner-state-unavailable')})
 await expect(recoverOrphanedLongCasting({...f.input,ownerActive})).rejects.toThrow('casting-owner-state-unavailable')
 expect(f.end).not.toHaveBeenCalled()
})
it('replacement during the server ownership read cannot be cleaned up by the old identity',async()=>{
 const f=fixture(),ownerActive=vi.fn(async()=>{f.characters[0].dnd5eCombatState.concentrationSpellId='replacement';return false})
 expect(await recoverOrphanedLongCasting({...f.input,ownerActive})).toBe(0)
 expect(f.end).not.toHaveBeenCalled()
})
