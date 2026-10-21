import { describe, expect, it } from 'vitest'
import { RoomAuthorityScheduler } from './roomAuthorityScheduler'

describe('RoomAuthorityScheduler', () => {
  it('keeps player settlement and an overlapping DM edit in one authority lane', async () => {
    const scheduler = new RoomAuthorityScheduler()
    const order: string[] = []
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    const settlement = scheduler.run('player-action-1', async () => {
      order.push('settlement-start')
      await barrier
      order.push('settlement-commit')
    })
    const dmEdit = scheduler.run('dm-hp-edit-1', async () => {
      order.push('dm-edit')
    })
    await Promise.resolve()
    expect(order).toEqual(['settlement-start'])
    release()
    await Promise.all([settlement, dmEdit])
    expect(order).toEqual(['settlement-start', 'settlement-commit', 'dm-edit'])
  })

  it('coalesces duplicate in-flight transaction IDs', async () => {
    const scheduler = new RoomAuthorityScheduler()
    let runs = 0
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    const first = scheduler.run('same-id', async () => {
      runs += 1
      await barrier
      return 7
    })
    const replay = scheduler.run('same-id', async () => {
      runs += 1
      return 8
    })
    expect(replay).toBe(first)
    release()
    await expect(replay).resolves.toBe(7)
    expect(runs).toBe(1)
  })
})

it('reads recovery after the pending action commits so spent economy is not restored',async()=>{
 const scheduler=new RoomAuthorityScheduler()
 let serverAction=1,localAction=1,release!:()=>void
 const gate=new Promise<void>(resolve=>{release=resolve})
 const action=scheduler.run('companion-order',async()=>{localAction=0;await gate;serverAction=localAction})
 await Promise.resolve()
 const recovery=scheduler.run('combat-publication-recovery',async()=>{localAction=serverAction})
 await Promise.resolve()
 expect(localAction).toBe(0)
 release();await Promise.all([action,recovery])
 expect(serverAction).toBe(0);expect(localAction).toBe(0)
})
