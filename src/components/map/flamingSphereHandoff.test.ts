import { describe, expect, it, vi } from 'vitest'
import {
  retainPendingPersistentAreaEntrances,
  retainPendingFlamingSphereEntrances,
  scheduleFlamingSphereVisualReady,
} from './flamingSphereHandoff'

describe('Flaming Sphere visual handoff', () => {
  it('retains the entrance until the exact persistent area reports ready', () => {
    const sphere = {
      id: 'sphere-entrance',
      kind: 'flaming-sphere',
      handoffAreaId: 'core-spell-area:cast-1',
    }
    const other = { id: 'other', kind: 'fireball' }

    expect(retainPendingFlamingSphereEntrances([sphere, other], new Set()))
      .toEqual([sphere, other])
    expect(retainPendingFlamingSphereEntrances(
      [sphere, other],
      new Set(['core-spell-area:another-cast']),
    )).toEqual([sphere, other])
    expect(retainPendingFlamingSphereEntrances(
      [sphere, other],
      new Set([sphere.handoffAreaId]),
    )).toEqual([other])
  })

  it('uses the same paint-complete handoff for Wall of Fire', () => {
    const wall = { kind: 'wall-of-fire', handoffAreaId: 'core-spell-area:wall-1' }
    expect(retainPendingFlamingSphereEntrances([wall], new Set())).toEqual([wall])
    expect(retainPendingFlamingSphereEntrances([wall], new Set([wall.handoffAreaId]))).toEqual([])
  })

  it('releases any declared persistent-area entrance after the exact area paints', () => {
    const cloud = { kind: 'cloudkill', handoffAreaId: 'core-spell-area:cloud-1' }
    const transient = { kind: 'shatter' }
    expect(retainPendingPersistentAreaEntrances([cloud, transient], new Set()))
      .toEqual([cloud, transient])
    expect(retainPendingPersistentAreaEntrances(
      [cloud, transient],
      new Set([cloud.handoffAreaId]),
    )).toEqual([transient])
  })

  it('reports ready only after two requested frames and two layer draws', () => {
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextFrameId = 1
    const drawLayer = vi.fn(() => true)
    const onReady = vi.fn()
    const cancel = scheduleFlamingSphereVisualReady({
      requestFrame: (callback) => {
        const id = nextFrameId++
        callbacks.set(id, callback)
        return id
      },
      cancelFrame: (id) => { callbacks.delete(id) },
      drawLayer,
      onReady,
    })

    expect(onReady).not.toHaveBeenCalled()
    const first = callbacks.get(1)!
    callbacks.delete(1)
    first(16)
    expect(drawLayer).toHaveBeenCalledTimes(1)
    expect(onReady).not.toHaveBeenCalled()

    const second = callbacks.get(2)!
    callbacks.delete(2)
    second(32)
    expect(drawLayer).toHaveBeenCalledTimes(2)
    expect(onReady).toHaveBeenCalledTimes(1)

    cancel()
  })

  it('does not report ready after the atlas unmounts', () => {
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextFrameId = 1
    const drawLayer = vi.fn(() => true)
    const onReady = vi.fn()
    const cancel = scheduleFlamingSphereVisualReady({
      requestFrame: (callback) => {
        const id = nextFrameId++
        callbacks.set(id, callback)
        return id
      },
      cancelFrame: (id) => { callbacks.delete(id) },
      drawLayer,
      onReady,
    })

    cancel()
    expect(callbacks.size).toBe(0)
    expect(drawLayer).not.toHaveBeenCalled()
    expect(onReady).not.toHaveBeenCalled()
  })
})
