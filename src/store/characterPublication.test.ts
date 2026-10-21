import { beforeEach, expect, it, vi } from 'vitest'

const io = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), revision: vi.fn() }))
vi.mock('../composition/browserSharedRoomResources', () => ({
  loadSharedResource: io.load,
  saveSharedResourceWithResult: io.save,
  getSharedResourceRevisionWatermark: io.revision,
}))
vi.mock('../lib/appMode', () => ({ isPlayerPort: () => true, isDmPort: () => false }))

import {
  clearCharacterTombstonesForTest,
  normalizeCharacter,
  recordCharacterTombstone,
  useCharacterStore,
} from './characters'

function character(id: string) {
  return normalizeCharacter({
    id, name: id, charClass: '战士', level: 1, conditions: [], equipment: {},
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  })
}

beforeEach(() => {
  io.load.mockReset()
  io.revision.mockReset().mockReturnValue(0)
  io.save.mockReset().mockResolvedValue({ status: 'saved', revision: 3 })
  clearCharacterTombstonesForTest()
  useCharacterStore.setState({ characters: [], selectedId: null })
})

it('preserves a remote character before its snapshot has reached the local store', async () => {
  const remote = character('remote-character')
  io.load.mockResolvedValue({ characters: [remote], selectedId: remote.id, updatedAt: 1 })
  await useCharacterStore.getState().saveSharedNow()
  expect(io.save).toHaveBeenCalledWith('characters', expect.objectContaining({
    characters: [expect.objectContaining({ id: remote.id })],
    selectedId: remote.id,
  }))
})

it('reads edits after the fetch and does not revive explicitly deleted characters', async () => {
  const remote = character('current-edit')
  const deleted = character('explicitly-deleted')
  let finish!: (value: unknown) => void
  io.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  useCharacterStore.setState({ characters: [remote], selectedId: remote.id })
  recordCharacterTombstone(deleted.id)
  try {
    const saving = useCharacterStore.getState().saveSharedNow()
    useCharacterStore.setState({ characters: [{ ...remote, name: 'Edited during fetch' }] })
    finish({ characters: [remote, deleted], selectedId: remote.id, updatedAt: 1 })
    await saving
    const payload = io.save.mock.calls[0][1]
    expect(payload.characters).toEqual([
      expect.objectContaining({ id: remote.id, name: 'Edited during fetch' }),
    ])
  } finally {
    clearCharacterTombstonesForTest()
  }
})

it('does not write when the rebase fetch fails', async () => {
  io.load.mockRejectedValue(new Error('offline'))
  await expect(useCharacterStore.getState().saveSharedNow()).rejects.toThrow('offline')
  expect(io.save).not.toHaveBeenCalled()
})

it('does not initialize over an unreadable resource with an existing revision', async () => {
  io.load.mockResolvedValue(null)
  io.revision.mockReturnValue(7)
  await useCharacterStore.getState().loadShared()
  await Promise.resolve()
  await Promise.resolve()
  expect(io.save).not.toHaveBeenCalled()
})

it('refuses immediate publication when an existing resource could not be read', async () => {
  io.load.mockResolvedValue(null)
  io.revision.mockReturnValue(7)
  await expect(useCharacterStore.getState().saveSharedNow()).rejects.toThrow('characters-save-unreadable')
  expect(io.save).not.toHaveBeenCalled()
})

it('allows an empty snapshot when the resource is genuinely new', async () => {
  io.load.mockResolvedValue(null)
  io.revision.mockReturnValue(0)
  await useCharacterStore.getState().saveSharedNow()
  expect(io.save).toHaveBeenCalledWith('characters', expect.objectContaining({ characters: [] }))
})
