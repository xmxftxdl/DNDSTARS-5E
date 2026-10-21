import {expect,it,vi} from 'vitest'
import {getTempleExpiryInteraction,registerTempleExpiryInteraction,registerTempleExpiryInteractionActivation,requireTempleExpiryInteraction,type TempleExpiryInteraction} from './templeExpiryInteraction'
const owner=():TempleExpiryInteraction=>({chooseFeatherFall:async()=>undefined,rollFalls:async()=>({})})
it('waits for the navigated workspace to register and returns its real interaction',async()=>{
 const open=vi.fn(),releaseActivation=registerTempleExpiryInteractionActivation(open)
 let releaseOwner=()=>{}
 try{
  const waiting=requireTempleExpiryInteraction()
  expect(open).toHaveBeenCalledOnce()
  expect(getTempleExpiryInteraction()).toBeUndefined()
  const interaction=owner();releaseOwner=registerTempleExpiryInteraction(interaction)
  expect(await waiting).toBe(interaction)
  expect(await requireTempleExpiryInteraction()).toBe(interaction)
  expect(open).toHaveBeenCalledOnce()
 }finally{releaseOwner();releaseActivation()}
})
it('aborts a pending activation when the room owner is removed',async()=>{
 const release=registerTempleExpiryInteractionActivation(()=>{})
 const waiting=requireTempleExpiryInteraction()
 const rejected=expect(waiting).rejects.toThrow('temple-expiry-host-interaction-unavailable')
 release();await rejected
})
it('uses the surviving owner after a React mount setup-cleanup-setup cycle',async()=>{
 const releaseActivation=registerTempleExpiryInteractionActivation(()=>{})
 let releaseOwner=()=>{}
 try{
  const waiting=requireTempleExpiryInteraction()
  registerTempleExpiryInteraction(owner())()
  const surviving=owner();releaseOwner=registerTempleExpiryInteraction(surviving)
  expect(await waiting).toBe(surviving)
 }finally{releaseOwner();releaseActivation()}
})
it('times out without accepting an implicit declined reaction',async()=>{
 vi.useFakeTimers()
 const release=registerTempleExpiryInteractionActivation(()=>{})
 try{
  const waiting=requireTempleExpiryInteraction()
  const rejected=expect(waiting).rejects.toThrow('temple-expiry-host-interaction-unavailable')
  await vi.advanceTimersByTimeAsync(60_000);await rejected
 }finally{release();vi.useRealTimers()}
})
