import { useEffect, useRef, useState } from 'react'
import { Crown, Download, Upload, User, UserPlus, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import CharacterSheet from '../components/character/CharacterSheet'
import DMRoster from '../components/character/DMRoster'
import { useCharacterStore } from '../store/characters'
import { modeFromPort, playerSlotLabel } from '../lib/appMode'
import {
  currentPlayerSlot,
  getAssignedPlayerCharacterId,
  playerViewCharacters,
  PLAYER_ASSIGNMENT_EVENT,
  setAssignedPlayerCharacterId,
} from '../lib/playerView'
import { characterExportFileName, makeCharacterExport, parseCharacterExport } from '../lib/characterTransfer'

type Mode = 'player' | 'dm'

export default function CharactersPage() {
  const forcedMode = modeFromPort()
  const [selectedMode, setSelectedMode] = useState<Mode>('player')
  const mode = forcedMode ?? selectedMode
  const [showCreate, setShowCreate] = useState(false)
  const [newCharName, setNewCharName] = useState('新冒险者')
  const createNameRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const characters = useCharacterStore((s) => s.characters)
  const selectedId = useCharacterStore((s) => s.selectedId)
  const select = useCharacterStore((s) => s.select)
  const add = useCharacterStore((s) => s.add)
  const importCharacter = useCharacterStore((s) => s.importCharacter)
  const update = useCharacterStore((s) => s.update)
  const [assignmentTick, setAssignmentTick] = useState(0)
  const isDM = mode === 'dm'
  const playerSlot = currentPlayerSlot()
  const assignedCharacterId = isDM ? null : getAssignedPlayerCharacterId(playerSlot)
  const assignableList = characters.filter((c) => c.visibleToPlayers !== false)

  const openCreateDialog = () => {
    setNewCharName('新冒险者')
    setShowCreate(true)
  }

  useEffect(() => {
    if (showCreate) createNameRef.current?.focus()
  }, [showCreate])

  useEffect(() => {
    const bump = () => setAssignmentTick((value) => value + 1)
    window.addEventListener(PLAYER_ASSIGNMENT_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(PLAYER_ASSIGNMENT_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const confirmCreate = () => {
    const id = add(newCharName.trim() || 'New Adventurer')
    if (!isDM) {
      setAssignedPlayerCharacterId(id, playerSlot)
      update(id, { player: playerSlotLabel(playerSlot), visibleToPlayers: true })
    }
    select(id)
    setShowCreate(false)
  }

  void assignmentTick
  const playerVisibleList = playerViewCharacters(characters, {
    slot: playerSlot,
    assignedCharacterId,
  })
  const visibleList = isDM
    ? characters
    : playerVisibleList
  const activeId =
    selectedId && visibleList.some((c) => c.id === selectedId) ? selectedId : visibleList[0]?.id ?? null
  const activeCharacter = activeId ? visibleList.find((c) => c.id === activeId) ?? null : null

  const exportCharacter = () => {
    if (!activeCharacter) return
    const blob = new Blob([JSON.stringify(makeCharacterExport(activeCharacter), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = characterExportFileName(activeCharacter)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const importCharacterFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      const character = parseCharacterExport(parsed)
      if (!character) throw new Error('Invalid character JSON')
      const id = importCharacter(character)
      if (!isDM) {
        setAssignedPlayerCharacterId(id, playerSlot)
        update(id, { player: playerSlotLabel(playerSlot), visibleToPlayers: true })
      }
      select(id)
    } catch (error) {
      console.error('[character-import-failed]', error)
      window.alert('无法载入角色 JSON。请确认文件是从本项目导出的角色文件。')
    }
  }

  useEffect(() => {
    if (!isDM && selectedId && !visibleList.some((c) => c.id === selectedId)) {
      select(visibleList[0]?.id ?? null)
    }
  }, [isDM, selectedId, select, visibleList])

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="角色"
        description={isDM ? '管理全部角色，拥有完整编辑与隐藏权限。' : '查看与编辑你的角色卡。'}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) void importCharacterFile(file)
                e.currentTarget.value = ''
              }}
            />

            <div className={`glass flex items-center rounded-xl p-1 ${forcedMode ? 'hidden' : ''}`}>
              <button
                onClick={() => setSelectedMode('player')}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === 'player' ? 'bg-arcane-500/25 text-arcane-100' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                <User className="h-4 w-4" />
                玩家版
              </button>
              <button
                onClick={() => setSelectedMode('dm')}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === 'dm' ? 'bg-ember-500/25 text-ember-400' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                <Crown className="h-4 w-4" />
                DM 版
              </button>
            </div>

            {!isDM && (
              <label className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300">
                <span className="text-xs font-semibold text-slate-500">{playerSlotLabel(playerSlot)}</span>
                <select
                  value={assignedCharacterId ?? ''}
                  onChange={(e) => {
                    setAssignedPlayerCharacterId(e.target.value || null, playerSlot)
                    if (e.target.value) select(e.target.value)
                  }}
                  className="min-w-36 rounded-lg border border-white/10 bg-void-900/70 px-2 py-1 text-sm text-slate-100 outline-none focus:border-arcane-500"
                  title="绑定本玩家端控制的角色"
                >
                  <option value="">未绑定角色</option>
                  {assignableList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(isDM || forcedMode === 'player') && (
              <>
                <button
                  onClick={() => importFileRef.current?.click()}
                  className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-arcane-400/60 hover:text-white"
                >
                  <Upload className="h-4 w-4" />
                  载入角色
                </button>
                <button
                  onClick={exportCharacter}
                  disabled={!activeCharacter}
                  className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-arcane-400/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-4 w-4" />
                  导出角色
                </button>
                <button
                  onClick={openCreateDialog}
                  className="glow-arcane flex items-center gap-2 rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600 px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                >
                  <UserPlus className="h-4 w-4" />
                  新建角色
                </button>
              </>
            )}
          </div>
        }
      />

      {isDM && (
        <div className="mb-5 space-y-4">
          <DMRoster />
        </div>
      )}

      {visibleList.length === 0 ? (
        <EmptyState
          icon={Users}
          title={isDM ? '还没有角色' : '没有可查看的角色'}
          description={
            isDM
              ? '点击右上角“新建角色”创建第一张角色卡。'
              : '请在右上角绑定本玩家端控制的角色，或让 DM 将角色玩家字段设为对应玩家。'
          }
        />
      ) : isDM ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {visibleList.map((c) => {
              const active = c.id === activeId
              return (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={[
                    'glass flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all',
                    active ? 'ring-1 ring-arcane-500/50' : 'hover:border-white/20',
                  ].join(' ')}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl ${c.accent}`}
                  >
                    {c.avatar}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-100">{c.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {c.charClass} / {c.level} 级 / HP {c.currentHp}/{c.maxHp}
                    </span>
                  </span>
                  {!c.visibleToPlayers && (
                    <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400">隐藏</span>
                  )}
                </button>
              )
            })}
          </div>
          <div>{activeId && <CharacterSheet id={activeId} isDM={isDM} />}</div>
        </div>
      ) : (
        <div>{activeId && <CharacterSheet id={activeId} isDM={false} />}</div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/70 p-4 backdrop-blur-sm"
          onClick={() => setShowCreate(false)}
        >
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-100">新建冒险者</h2>
            <p className="mt-1 text-sm text-slate-500">为角色取一个名字，创建后仍可在角色卡中修改。</p>
            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">角色名称</span>
              <input
                ref={createNameRef}
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmCreate()
                  if (e.key === 'Escape') setShowCreate(false)
                }}
                placeholder="输入冒险者名称"
                className="rounded-xl border border-white/10 bg-void-900/60 px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-arcane-500"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-xl px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
              >
                取消
              </button>
              <button
                onClick={confirmCreate}
                className="glow-arcane rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600 px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
