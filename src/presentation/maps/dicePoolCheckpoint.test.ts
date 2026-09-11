import {expect,it,vi} from 'vitest'
import {readDicePoolCheckpoint,writeDicePoolCheckpoint} from './dicePoolCheckpoint'
it('keeps confirmed dice when an old start event is replayed and validates pool shape',()=>{
 const store=new Map<string,string>();vi.stubGlobal('window',{sessionStorage:{getItem:(key:string)=>store.get(key),setItem:(key:string,v:string)=>store.set(key,v)}})
 writeDicePoolCheckpoint('action:0',20,[15,3])
 expect(readDicePoolCheckpoint('action:0',2,20)).toEqual({sides:20,values:[15,3],confirmed:false})
 writeDicePoolCheckpoint('action:0',20,[18,4],true)
 writeDicePoolCheckpoint('action:0',20,[15,3])
 expect(readDicePoolCheckpoint('action:0',2,20)?.values).toEqual([18,4])
 expect(readDicePoolCheckpoint('action:0',1,20)).toBeUndefined()
 expect(readDicePoolCheckpoint('action:0',2,12)).toBeUndefined()
 vi.unstubAllGlobals()
})

it('ignores malformed saved checkpoints instead of crashing restoration', () => {
 vi.stubGlobal('window', { sessionStorage: { getItem: () => JSON.stringify({ corrupt: { sides: 20 } }) } })
 expect(readDicePoolCheckpoint('corrupt', 1, 20)).toBeUndefined()
 vi.unstubAllGlobals()
})
it('retains a recently confirmed old transaction when the cache reaches its limit', () => {
 let data = '{}'
 vi.stubGlobal('window', { sessionStorage: { getItem: () => data, setItem: (_key:string, value:string) => { data = value } } })
 writeDicePoolCheckpoint('old-active',20,[15])
 for(let i=0;i<499;i++) writeDicePoolCheckpoint(`pool-${i}`,20,[1])
 writeDicePoolCheckpoint('old-active',20,[15],true)
 writeDicePoolCheckpoint('new-pool',20,[2])
 expect(JSON.parse(data)['old-active']).toEqual({sides:20,values:[15],confirmed:true})
 vi.unstubAllGlobals()
})