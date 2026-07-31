import { useEffect, useRef, useState } from 'react'
import { Crown, Download, Upload, User, UserPlus, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import CharacterSheet from '../components/character/CharacterSheet'
import CharacterSetupDialog, { type CharacterSetupResult } from '../components/character/CharacterSetupDialog'
import CharacterCreationAdvancementFlow from '../components/character/CharacterCreationAdvancementFlow'
import DMRoster from '../components/character/DMRoster'
import AccountCharacterVaultPanel from '../components/character/AccountCharacterVaultPanel'
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
import { dnd5eClassDefinition } from '../rulesets/dnd5e/classes'
import { dnd5eRaceSpeed } from '../rulesets/dnd5e/characterSetup'
import { dnd5eStartingEquipmentPlan, resolveDnd5eStartingEquipment } from '../rulesets/dnd5e/startingEquipment'

type Mode = 'player' | 'dm'

export default function CharactersPage() {
  const forcedMode = modeFromPort()
  const [selectedMode, setSelectedMode] = useState<Mode>('player')
  const mode = forcedMode ?? selectedMode
  const [showCreate, setShowCreate] = useState(false)
  const [pendingCreation, setPendingCreation] = useState<{
    characterId: string
    targetLevel: number
  } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const characters = useCharacterStore((s) => s.characters)
  const selectedId = useCharacterStore((s) => s.selectedId)
  const select = useCharacterStore((s) => s.select)
  const add = useCharacterStore((s) => s.add)
  const update = useCharacterStore((s) => s.update)
  const remove = useCharacterStore((s) => s.remove)
  const importCharacter = useCharacterStore((s) => s.importCharacter)
  const [assignmentTick, setAssignmentTick] = useState(0)
  const isDM = mode === 'dm'
  const playerSlot = currentPlayerSlot()
  const assignedCharacterId = isDM ? null : getAssignedPlayerCharacterId(playerSlot)

  const openCreateDialog = () => {
    setShowCreate(true)
  }

  useEffect(() => {
    const bump = () => setAssignmentTick((value) => value + 1)
    window.addEventListener(PLAYER_ASSIGNMENT_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(PLAYER_ASSIGNMENT_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const confirmCreate = (setup: CharacterSetupResult) => {
    const definition = dnd5eClassDefinition(setup.charClass)
    const id = add(setup.name)
    const startingEquipment = resolveDnd5eStartingEquipment(
      id,
      dnd5eStartingEquipmentPlan(setup.charClass, setup.background),
      setup.startingEquipment,
    )
    update(id, {
      charClass: setup.charClass,
      race: setup.race,
      dnd5eRaceId: setup.dnd5eRaceId,
      ...(setup.dragonbornAncestry ? {
        dnd5eRacialChoices: { dragonbornAncestry: setup.dragonbornAncestry },
      } : {}),
      alignment: setup.alignment,
      background: setup.background,
      dnd5eBackgroundId: setup.dnd5eBackgroundId,
      dnd5eBackgroundSkillProficiencies: setup.backgroundSkillProficiencies,
      level: 1,
      ...(definition ? { dnd5eClassLevels: { [definition.id]: 1 } } : {}),
      abilities: setup.abilities,
      skills: [...new Set([
        ...setup.classSkillProficiencies,
        ...(setup.backgroundSkillProficiencies ?? []),
        ...(setup.racialSkillProficiencies ?? []),
      ])],
      ...(setup.racialFeatIds?.length ? { dnd5eFeatIds: [...setup.racialFeatIds] } : {}),
      savingThrows: definition ? [...definition.savingThrows] : [],
      speed: dnd5eRaceSpeed(setup.dnd5eRaceId ?? setup.race),
      hitPointMaximumMode: 'fixed',
      equipment: startingEquipment.equipment,
      dnd5eInventory: startingEquipment.inventory,
      dnd5eClassChoices: setup.initialClassChoices,
      ...(setup.targetLevel > 1 ? { dnd5eCreationTargetLevel: setup.targetLevel } : {}),
      dnd5eAbilityGeneration: {
        method: setup.method,
        baseScores: setup.baseAbilities,
        racialBonuses: setup.racialBonuses,
        ...(setup.race === '半精灵' && setup.racialBonusChoices.length > 0 ? { halfElfChoices: setup.racialBonusChoices } : {}),
        ...(setup.racialBonusChoices.length > 0 ? { racialBonusChoices: setup.racialBonusChoices } : {}),
        ...(setup.rolls ? { rolls: setup.rolls.map((roll) => ({
          ...roll,
          dice: [...roll.dice],
          discardedIndices: [...roll.discardedIndices],
        })) } : {}),
      },
    })
    if (!isDM) {
      setAssignedPlayerCharacterId(id, playerSlot)
    }
    select(id)
    setShowCreate(false)
    if (setup.targetLevel > 1) {
      setPendingCreation({ characterId: id, targetLevel: setup.targetLevel })
    }
  }

  void assignmentTick
  const playerVisibleList = playerViewCharacters(characters, {
    slot: playerSlot,
    assignedCharacterId,
  })
  const visibleList = playerVisibleList
  const assignableList = playerVisibleList
  const activeId =
    selectedId && visibleList.some((c) => c.id === selectedId) ? selectedId : visibleList[0]?.id ?? null
  const activeCharacter = activeId ? visibleList.find((c) => c.id === activeId) ?? null : null
  const unfinishedCreation = !isDM && !showCreate
    ? visibleList.find((character) =>
        (character.dnd5eCreationTargetLevel ?? 0) > character.level)
    : undefined
  const effectivePendingCreation = pendingCreation ?? (
    unfinishedCreation?.dnd5eCreationTargetLevel
      ? {
          characterId: unfinishedCreation.id,
          targetLevel: unfinishedCreation.dnd5eCreationTargetLevel,
        }
      : null
  )

  const finishPendingCreation = () => {
    if (effectivePendingCreation) {
      update(effectivePendingCreation.characterId, { dnd5eCreationTargetLevel: undefined })
    }
    setPendingCreation(null)
  }

  const abandonPendingCreation = () => {
    if (!effectivePendingCreation) return
    remove(effectivePendingCreation.characterId)
    setPendingCreation(null)
  }

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
        description={isDM ? '查看本房间玩家与他们创建的角色。' : '创建、导入并编辑你自己的角色卡。'}
        actions={
          <div className="flex flex-wrap items-center gap-3">
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
              <>
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
                <label className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300">
                  <span className="text-xs font-semibold text-slate-500">{playerSlotLabel(playerSlot)}</span>
                  <select
                    value={assignedCharacterId ?? ''}
                    onChange={(e) => {
                      setAssignedPlayerCharacterId(e.target.value || null, playerSlot)
                      if (e.target.value) select(e.target.value)
                    }}
                    className="min-w-36 rounded-lg border border-white/10 bg-void-900/70 px-2 py-1 text-sm text-slate-100 outline-none focus:border-arcane-500"
                    title="选择当前控制的角色"
                  >
                    <option value="">未选择角色</option>
                    {assignableList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
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
        <div className="space-y-4">
          <DMRoster />
        </div>
      )}

      {!isDM && <AccountCharacterVaultPanel />}

      {!isDM && visibleList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="还没有创建角色"
          description="点击右上角“新建角色”创建角色，或载入已有的角色 JSON。"
        />
      ) : !isDM ? (
        <div>{activeId && <CharacterSheet id={activeId} isDM={false} />}</div>
      ) : null}

      {!isDM && showCreate && (
        <CharacterSetupDialog onCancel={() => setShowCreate(false)} onComplete={confirmCreate} />
      )}
      {!isDM && effectivePendingCreation && (
        <CharacterCreationAdvancementFlow
          characterId={effectivePendingCreation.characterId}
          targetLevel={effectivePendingCreation.targetLevel}
          onComplete={finishPendingCreation}
          onAbandon={abandonPendingCreation}
        />
      )}
    </div>
  )
}
