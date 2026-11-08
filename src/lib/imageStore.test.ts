import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const shared = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), delete: vi.fn(),
  session: { roomId: 'room-a', memberId: 'dm-a', role: 'dm' as string },
}))
vi.mock('./sharedApi', () => ({ getSharedImage: shared.get, putSharedImage: shared.put, deleteSharedImage: shared.delete }))
vi.mock('./roomSession', () => ({ getRoomSession: () => shared.session }))
vi.mock('./appMode', () => ({ modeFromPort: () => shared.session.role }))

import { getImage, getMapImage } from './imageStore'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function localImages(images: Map<string, Blob>, blocked = false) {
  return { open: () => {
    const request = {} as IDBOpenDBRequest
    if (blocked) return request
    const db = { transaction: () => {
      const tx = { objectStore: () => ({
        get: (id: string) => {
          const read = {} as IDBRequest
          queueMicrotask(() => { Object.assign(read, { result: images.get(id) }); read.onsuccess?.call(read, {} as Event) })
          return read
        },
        put: (blob: Blob, id: string) => {
          images.set(id, blob)
          queueMicrotask(() => tx.oncomplete?.())
        },
      }), oncomplete: undefined as (() => void) | undefined }
      return tx
    } }
    queueMicrotask(() => { Object.assign(request, { result: db }); request.onsuccess?.call(request, {} as Event) })
    return request
  } }
}

describe('map image loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shared.session = { roomId: 'room-a', memberId: 'dm-a', role: 'dm' }
    shared.put.mockResolvedValue(true)
    vi.stubGlobal('indexedDB', localImages(new Map()))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('shows a DM local map while its cloud request is still pending', async () => {
    const local = new Blob(['local'])
    const network = deferred<Blob>()
    vi.stubGlobal('indexedDB', localImages(new Map([['dm-warm', local]])))
    shared.get.mockReturnValue(network.promise)
    await expect(getMapImage('dm-warm')).resolves.toBe(local)
    expect(shared.get).toHaveBeenCalledTimes(1)
    network.resolve(new Blob(['cloud']))
    await getImage('dm-warm')
  })

  it('still downloads a map that has never been cached', async () => {
    const cloud = new Blob(['new-map'])
    shared.get.mockResolvedValue(cloud)
    await expect(getMapImage('cold-map')).resolves.toBe(cloud)
  })

  it('does not wait for blocked IndexedDB when the cloud succeeds', async () => {
    const cloud = new Blob(['cloud'])
    vi.stubGlobal('indexedDB', localImages(new Map(), true))
    shared.get.mockResolvedValue(cloud)
    await expect(getMapImage('blocked-db')).resolves.toBe(cloud)
  })

  it('does not hide downloaded maps if local storage is unavailable', async () => {
    const cloud = new Blob(['cloud'])
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('storage-disabled') } })
    shared.get.mockResolvedValue(cloud)
    await expect(getMapImage('unavailable-db')).resolves.toBe(cloud)
  })

  it.each(['player', 'spectator'])('retains server-first reads for %s', async (role) => {
    shared.session.role = role
    vi.stubGlobal('indexedDB', localImages(new Map([['private-map', new Blob(['local'])]])))
    const network = deferred<Blob>()
    shared.get.mockReturnValue(network.promise)
    let settled = false
    const result = getMapImage('private-map').then(blob => { settled = true; return blob })
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    const cloud = new Blob(['authorized'])
    network.resolve(cloud)
    await expect(result).resolves.toBe(cloud)
  })

  it('shares one download across map selection, canvas and other image consumers', async () => {
    const network = deferred<Blob>()
    shared.get.mockReturnValue(network.promise)
    const results = [getMapImage('parallel-map'), getMapImage('parallel-map'), getImage('parallel-map')]
    expect(shared.get).toHaveBeenCalledTimes(1)
    const cloud = new Blob(['one-download'])
    network.resolve(cloud)
    expect(await Promise.all(results)).toEqual([cloud, cloud, cloud])
  })

  it('does not join requests across rooms or members', async () => {
    const first = deferred<Blob>()
    const second = deferred<Blob>()
    shared.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const previousRoom = getImage('same-id')
    shared.session = { roomId: 'room-b', memberId: 'dm-b', role: 'dm' }
    const nextRoom = getImage('same-id')
    expect(shared.get).toHaveBeenCalledTimes(2)
    first.resolve(new Blob(['a']))
    second.resolve(new Blob(['b']))
    expect(await (await previousRoom)!.text()).toBe('a')
    expect(await (await nextRoom)!.text()).toBe('b')
  })

  it('retries missing images instead of retaining an empty result', async () => {
    shared.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce(new Blob(['now-available']))
    await expect(getMapImage('missing-map')).resolves.toBeUndefined()
    expect(await (await getMapImage('missing-map'))!.text()).toBe('now-available')
    expect(shared.get).toHaveBeenCalledTimes(2)
  })

  it('continues restoring a reused DM map without blocking its display on the upload', async () => {
    const local = new Blob(['reused-map'])
    const upload = deferred<boolean>()
    vi.stubGlobal('indexedDB', localImages(new Map([['restore-map', local]])))
    shared.get.mockResolvedValue(undefined)
    shared.put.mockReturnValue(upload.promise)
    await expect(getMapImage('restore-map')).resolves.toBe(local)
    const restore = getImage('restore-map')
    upload.resolve(true)
    await expect(restore).resolves.toBe(local)
    expect(shared.put).toHaveBeenCalledWith('restore-map', local)
  })
})
