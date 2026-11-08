import { isCharacterPortraitDataUrl } from './characterPortrait'

export interface NpcLibraryEntry {
  id: string
  label: string
  portrait?: string
  maxHp?: number
  createdAt: number
}

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('stars-npc-library', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('npcs', { keyPath: 'key' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('无法打开 NPC 库，请检查浏览器存储权限。'))
  })
}

export async function loadNpcLibrary(owner: string): Promise<NpcLibraryEntry[]> {
  const db = await openLibrary()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('npcs').objectStore('npcs').getAll()
      request.onsuccess = () => resolve(request.result.filter(row => row.owner === owner)
        .map(({ entry }) => entry as NpcLibraryEntry).sort((a, b) => b.createdAt - a.createdAt))
      request.onerror = () => reject(new Error('读取 NPC 库失败。'))
    })
  } finally { db.close() }
}

export async function saveNpcLibraryEntry(owner: string, entry: NpcLibraryEntry): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(entry.id) || !entry.label.trim() || entry.label.length > 80 ||
    (entry.portrait && !isCharacterPortraitDataUrl(entry.portrait))) throw new Error('NPC 资料无效。')
  const db = await openLibrary()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('npcs', 'readwrite')
      transaction.objectStore('npcs').put({ key: `${owner}:${entry.id}`, owner, entry })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(new Error('NPC 库保存失败，请检查浏览器剩余存储空间。'))
      transaction.onabort = () => reject(new Error('NPC 库保存失败，请重试。'))
    })
  } finally { db.close() }
}
