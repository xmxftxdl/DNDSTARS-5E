import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDnd5ePluginSandbox } from './pluginSandbox'
import { createDnd5eCombatant } from './headlessCombatEngine'

class FakeWorker {
  static last: FakeWorker | undefined
  static operations: unknown[] = []
  readonly sent: unknown[] = []
  private readonly messageListeners: Array<(event: MessageEvent) => void> = []
  private readonly errorListeners: Array<(event: ErrorEvent) => void> = []
  terminated = false

  constructor() {
    FakeWorker.last = this
  }

  addEventListener(type: string, listener: (event: never) => void) {
    if (type === 'message') this.messageListeners.push(listener as (event: MessageEvent) => void)
    if (type === 'error') this.errorListeners.push(listener as (event: ErrorEvent) => void)
  }

  postMessage(value: unknown) {
    this.sent.push(value)
    const message = value as { type?: string; requestId?: string; fromVersion?: number; state?: unknown }
    queueMicrotask(() => {
      if (message.type === 'init') {
        this.emit({
          type: 'initialized',
          contributions: {
            manifest: {
              id: 'com.example.migration-test',
              name: 'Migration Test',
              version: '2.0.0',
              apiVersion: 2,
              rulesetId: 'dnd5e-2014-srd-5.1',
              publisher: 'Tests',
              license: 'CC0-1.0',
              stateSchemaVersion: 2,
            },
            features: [],
            actions: [],
            races: [],
            backgrounds: [{ id: 'observer', name: '观察者', skillProficiencies: ['perception'] }],
            abilityGenerationMethods: [],
            items: [{
              id: 'test-item', name: '测试物品', category: 'adventuring-gear', icon: 'generic',
              description: '测试。', rulesText: '由 DM 裁定。', stackable: true,
            }],
            migrations: [{ fromVersion: 1, toVersion: 2 }],
          },
        })
      } else if (message.type === 'resolve') {
        this.emit({type:'resolved',requestId:message.requestId,ok:true,operations:FakeWorker.operations})
      } else if (message.type === 'migrate') {
        this.emit({
          type: 'migrated',
          requestId: message.requestId,
          fromVersion: message.fromVersion,
          toVersion: 2,
          state: { ...(message.state as Record<string, unknown>), migrated: true },
        })
      }
    })
  }

  terminate() {
    this.terminated = true
  }

  private emit(data: unknown) {
    for (const listener of this.messageListeners) listener({ data } as MessageEvent)
  }
}

describe('D&D 5e plugin state migration sandbox protocol', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeWorker.last = undefined
  })

  it('keeps migration data in the Worker request/response boundary', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    })
    const session = await createDnd5ePluginSandbox(new TextEncoder().encode('plugin').buffer)
    expect(session.migrations).toEqual([{ fromVersion: 1, toVersion: 2 }])
    expect(session.items).toEqual([expect.objectContaining({ id: 'test-item' })])
    expect(session.backgrounds).toEqual([expect.objectContaining({ id: 'observer' })])

    const result = await session.migrateState(1, { counter: 3 })
    expect(result).toEqual({
      fromVersion: 1,
      toVersion: 2,
      state: { counter: 3, migrated: true },
    })
    expect(FakeWorker.last?.sent).toContainEqual({
      type: 'migrate',
      requestId: expect.any(String),
      fromVersion: 1,
      state: { counter: 3 },
    })
    session.terminate()
    expect(FakeWorker.last?.terminated).toBe(true)
  })
})


describe('Worker rolled damage response boundary', () => {
  afterEach(() => { vi.unstubAllGlobals(); FakeWorker.operations=[] })
  it.each([1, 0.5, 2, 3, NaN])('validates multiplier %s at the message boundary', async multiplier => {
    vi.stubGlobal('Worker',FakeWorker)
    vi.stubGlobal('window',{setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout})
    const session=await createDnd5ePluginSandbox(new TextEncoder().encode('plugin').buffer)
    try {
      FakeWorker.operations=[{kind:'deal-rolled-damage',targetId:'target',rollId:'damage',multiplier}]
      const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:10,
        abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
        currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
      const pending=session.resolve({actor,action:{type:'plugin',pluginId:session.manifest.id,actionId:'damage',actorId:actor.id}})
      if ([0.5,1,2].includes(multiplier)) await expect(pending).resolves.toEqual({ok:true,operations:FakeWorker.operations})
      else await expect(pending).rejects.toThrow('Headless capability')
    } finally {session.terminate()}
  })
})
