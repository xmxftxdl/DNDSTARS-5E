import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import NpcCreateDialog, { type NpcCreationDetails } from '../../src/components/map/NpcCreateDialog'

declare global {
  interface Window { createdNpcs: NpcCreationDetails[] }
}
window.createdNpcs = []

function Fixture() {
  const [open, setOpen] = useState(true)
  return <>
    <button onClick={() => setOpen(true)}>添加 NPC</button>
    {open && <NpcCreateDialog onClose={() => setOpen(false)} onCreate={(details) => {
      window.createdNpcs.push(details)
      return `npc-${window.createdNpcs.length}`
    }} />}
  </>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
