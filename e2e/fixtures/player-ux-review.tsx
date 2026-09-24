import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import CharacterSetupDialog from '../../src/components/character/CharacterSetupDialog'
import CharacterCreationAdvancementFlow from '../../src/components/character/CharacterCreationAdvancementFlow'
import PlayerCombatHotbar from '../../src/components/map/PlayerCombatHotbar'
import { serializeDnd5eCharacterSnapshot, useCharacterStore } from '../../src/store/characters'
import type { Character } from '../../src/types/character'

const base: Character = {
  rulesetId: 'dnd5e-2014-srd-5.1',
  id: 'ux-draft', name: '验收战士', player: '验收', avatar: '🧝', accent: 'from-violet-500 to-indigo-500',
  race: '人类', charClass: '战士', level: 1, dnd5eClassLevels: { fighter: 1 }, dnd5eCreationTargetLevel: 4,
  background: '侍僧', experience: 0, reputation: 0,
  abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 12 }, skills: ['athletics', 'history'], savingThrows: ['str', 'con'],
  maxHp: 12, currentHp: 12, tempHp: 0, hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 2, saveDC: 10, passivePerception: 10,
  inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  dnd5eClassChoices: { fighter: { fightingStyles: ['defense'] } },
}
const stored = localStorage.getItem('ux-review-character')
useCharacterStore.setState({
  characters: [stored ? { ...JSON.parse(stored), rulesetId: base.rulesetId } : base], selectedId: base.id,
  update: (id, patch) => {
    const current = useCharacterStore.getState().characters.find((character) => character.id === id)!
    const next = serializeDnd5eCharacterSnapshot({ ...current, ...patch })
    useCharacterStore.setState({ characters: [next] })
    localStorage.setItem('ux-review-character', JSON.stringify(next))
  },
  saveSharedNow: async () => 1,
})

const wizard: Character = {
  ...base, id: 'ux-wizard', name: '艾拉', charClass: '法师', level: 9,
  dnd5eCreationTargetLevel: undefined, dnd5eClassLevels: { wizard: 9 },
  dnd5eClassChoices: { classes: { wizard: { subclass: 'evocation', selections: { 'spell-prepared': ['fire-bolt', 'ray-of-frost', 'magic-missile', 'shield', 'misty-step', 'mirror-image', 'fireball', 'fly', 'rope-trick'] } } } },
  classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 }, 'dnd5e-spell-slot-2': { current: 2, max: 3 }, 'dnd5e-spell-slot-3': { current: 1, max: 3 }, 'dnd5e-spell-slot-4': { current: 2, max: 3 } },
}
function Review() {
  const [mode, setMode] = useState('hotbar')
  const [notice, setNotice] = useState('')
  const character = useCharacterStore((state) => state.characters[0])
  return <main className="min-h-screen bg-slate-950 p-4 text-white">
    <p className="mb-3 text-sm text-sky-200">隔离验收页 · 不连接正式战役</p>
    <nav className="flex flex-wrap gap-3">{[['hotbar', '战斗栏'], ['setup', '普通建卡'], ['high', '继续高等级建卡']].map(([id, label]) => <button key={id} onClick={() => setMode(id)} className="rounded border border-white/20 px-3 py-2">{label}</button>)}</nav>
    <p className="mt-3" role="status">{notice || `保存的角色：${character.name}，等级 ${character.level}，生命 ${character.maxHp}，${character.dnd5eCreationTargetLevel ? '未完成' : '已完成'}`}</p>
    {mode === 'hotbar' && <div className="absolute bottom-3 left-3 right-3"><PlayerCombatHotbar character={wizard} canAct pending={false} turnEconomy={{ action: { current: 0 }, bonusAction: { current: 1 }, movement: { current: 30 } }} onCommand={(command) => setNotice(`已选择 ${command.kind}`)} onUnavailable={(entry) => setNotice(entry.disabledReason ?? '不可用')} /></div>}
    {mode === 'setup' && <CharacterSetupDialog onCancel={() => setMode('none')} onComplete={(result) => { setNotice(`已创建 ${result.name}，目标 ${result.targetLevel} 级`); setMode('none') }} />}
    {mode === 'high' && <CharacterCreationAdvancementFlow characterId={base.id} targetLevel={4} onPause={() => setMode('none')} onComplete={() => { useCharacterStore.getState().update(base.id, { dnd5eCreationTargetLevel: undefined }); setMode('none') }} />}
  </main>
}
createRoot(document.getElementById('root')!).render(<Review />)
