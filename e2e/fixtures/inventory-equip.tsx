import '../../src/index.css'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import EquipmentTab from '../../src/components/character/EquipmentTab'
import { normalizeCharacter, useCharacterStore } from '../../src/store/characters'
import { applyDnd5eInventoryMutation } from '../../src/rulesets/dnd5e/items'
import type { Dnd5eInventoryMutation } from '../../src/types/inventory'

declare global {
  interface Window {
    equipRequests: Dnd5eInventoryMutation[]
    inventoryTestMutate: (mutation: Dnd5eInventoryMutation) => Promise<{ status: string; message: string }>
  }
}
window.equipRequests = []
let characters = [normalizeCharacter({ id: 'hero', name: '玩家战士', charClass: '战士', equipment: {},
  dnd5eInventory: { schemaVersion: 1, entries: [] } })]
for (const templateId of ['srd-5.1:equipment:dnd5e-longsword', 'srd-5.1:equipment:dnd5e-dagger', 'srd-5.1:equipment:dnd5e-shield', 'srd-5.1:item:arcane-focus']) {
  const result = applyDnd5eInventoryMutation(characters, { type: 'grant', characterId: 'hero', templateId, quantity: 1 })
  if (!result.ok) throw new Error(result.message)
  characters = result.characters
}
const entryId = (suffix: string) => characters[0].dnd5eInventory!.entries.find(entry => entry.templateId.endsWith(suffix))!.instanceId
for (const [suffix, slot] of [['dnd5e-longsword', 'mainWeapon'], ['dnd5e-shield', 'offHand']] as const) {
  const result = applyDnd5eInventoryMutation(characters, { type: 'equip', characterId: 'hero', instanceId: entryId(suffix), slot })
  if (!result.ok) throw new Error(result.message)
  characters = result.characters
}
useCharacterStore.setState({ characters })
window.inventoryTestMutate = async (mutation) => {
  window.equipRequests.push(mutation)
  const result = applyDnd5eInventoryMutation(useCharacterStore.getState().characters, mutation)
  if (result.ok) useCharacterStore.setState({ characters: result.characters })
  return { status: result.ok ? 'applied' : 'rejected', message: result.message ?? '' }
}
function Fixture() {
  const [locked, setLocked] = useState(false)
  return <><button onClick={() => setLocked(value => !value)}>切换只读</button>
    <EquipmentTab charId="hero" editable={!locked} /></>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
