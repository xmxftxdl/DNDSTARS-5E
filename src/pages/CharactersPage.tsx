import { useEffect, useRef, useState } from 'react'
import { Crown, Download, FileSpreadsheet, LoaderCircle, Trash2, Upload, User, UserPlus, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import CharacterSheet from '../components/character/CharacterSheet'
import CharacterSetupDialog, { type CharacterSetupResult } from '../components/character/CharacterSetupDialog'
import CharacterCreationAdvancementFlow from '../components/character/CharacterCreationAdvancementFlow'
import CharacterExcelImportDialog from '../components/character/CharacterExcelImportDialog'
import DMRoster from '../components/character/DMRoster'
import AccountCharacterVaultPanel from '../components/character/AccountCharacterVaultPanel'
import { useCharacterStore } from '../store/characters'
import { useMapStore } from '../store/maps'
import { modeFromPort, playerSlotLabel } from '../lib/appMode'
import {
  currentPlayerSlot,
  getAssignedPlayerCharacterId,
  getRoomCharacterAssignment,
  playerViewCharacters,
  playerCharacterPageActiveId,
  PLAYER_ASSIGNMENT_EVENT,
  setAssignedPlayerCharacterId,
} from '../lib/playerView'
import { getRoomSession } from '../lib/roomSession'
import { characterCreationDraftKey, clearCharacterCreationDraft, copyCharacterCreationDraft, hasCharacterCreationDraft, readCharacterCreationDraft, writeCharacterCreationDraft } from '../lib/characterCreationDraft'
import type { Character } from '../types/character'
import { characterExportFileName, makeCharacterExport, parseCharacterExport } from '../lib/characterTransfer'
import { dnd5eClassDefinition } from '../rulesets/dnd5e/classes'
import { declarativeClassContentBindingV1 } from '../rulesets/dnd5e/declarativeClass'
import { dnd5eRaceSpeed } from '../rulesets/dnd5e/characterSetup'
import { dnd5eStartingEquipmentPlan, resolveDnd5eStartingEquipment } from '../rulesets/dnd5e/startingEquipment'
import { showAppAlert, showAppConfirm } from '../lib/appDialog'
import { createCharacterPortraitDataUrl } from '../lib/characterPortrait'
import {
  buildCharacterExcelImportDraft,
  characterExcelImageFile,
  parseCharacterExcelFile,
  type CharacterExcelImportDraft,
  type CharacterExcelWorkbook,
} from '../lib/characterExcelImport'

type Mode = 'player' | 'dm'

export default function CharactersPage() {
  const forcedMode = modeFromPort()
  const [selectedMode, setSelectedMode] = useState<Mode>('player')
  const mode = forcedMode ?? selectedMode
  const [showCreate, setShowCreate] = useState(false)
  const [editingCreationId, setEditingCreationId] = useState<string | null>(null)
  const [pendingCreation, setPendingCreation] = useState<{
    characterId: string
    targetLevel: number
  } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const excelImportFileRef = useRef<HTMLInputElement>(null)
  const [excelImportBusy, setExcelImportBusy] = useState(false)
  const [excelImportPreview, setExcelImportPreview] = useState<{
    workbook: CharacterExcelWorkbook
    draft: CharacterExcelImportDraft
    portraitDataUrl?: string
  } | null>(null)
  const characters = useCharacterStore((s) => s.characters)
  const selectedId = useCharacterStore((s) => s.selectedId)
  const select = useCharacterStore((s) => s.select)
  const add = useCharacterStore((s) => s.add)
  const update = useCharacterStore((s) => s.update)
  const remove = useCharacterStore((s) => s.remove)
  const importCharacter = useCharacterStore((s) => s.importCharacter)
  const [assignmentTick, setAssignmentTick] = useState(0)
  const isDM = mode === 'dm'
  const roomSession = getRoomSession()
  const playerSlot = currentPlayerSlot()
  const assignedCharacterId = isDM ? null : getAssignedPlayerCharacterId(playerSlot)

  const openCreateDialog = () => {
    setEditingCreationId(null)
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
    const classContentBinding = definition ? declarativeClassContentBindingV1(definition.id) : undefined
    const existing = editingCreationId ? useCharacterStore.getState().characters.find((character) => character.id === editingCreationId) : undefined
    const baseline = editingCreationId ? readCharacterCreationDraft(characterCreationDraftKey(`base:${editingCreationId}`), { character: undefined as Character | undefined }).character : undefined
    if (editingCreationId && (!existing?.dnd5eCreationTargetLevel || !baseline)) return
    const id = editingCreationId ?? add(setup.name)
    const startingEquipment = resolveDnd5eStartingEquipment(
      id,
      dnd5eStartingEquipmentPlan(setup.charClass, setup.background),
      setup.startingEquipment,
    )
    update(id, {
      ...(existing && baseline ? {
        ...Object.fromEntries(Object.keys(existing).filter((key) => !(key in baseline)).map((key) => [key, undefined])),
        ...baseline,
        dnd5eLevelAdvancements: [],
      } : {}),
      name: setup.name,
      charClass: setup.charClass,
      race: setup.race,
      dnd5eRaceId: setup.dnd5eRaceId,
      dnd5eRacialChoices: setup.dragonbornAncestry ? { dragonbornAncestry: setup.dragonbornAncestry } : undefined,
      alignment: setup.alignment,
      background: setup.background,
      dnd5eBackgroundId: setup.dnd5eBackgroundId,
      dnd5eBackgroundSkillProficiencies: setup.backgroundSkillProficiencies,
      dnd5eBackgroundToolProficiencies: setup.backgroundToolProficiencies,
      dnd5eBackgroundLanguages: setup.backgroundLanguages,
      dnd5eBackgroundVariantId: setup.backgroundVariantId,
      level: 1,
      ...(definition ? { dnd5eClassLevels: { [definition.id]: 1 } } : {}),
      dnd5eClassContentBindings: classContentBinding ? { [classContentBinding.classId]: classContentBinding } : undefined,
      abilities: setup.abilities,
      skills: [...new Set([
        ...setup.classSkillProficiencies,
        ...(setup.backgroundSkillProficiencies ?? []),
        ...(setup.racialSkillProficiencies ?? []),
      ])],
      dnd5eFeatIds: setup.racialFeatIds ? [...setup.racialFeatIds] : [],
      savingThrows: definition ? [...definition.savingThrows] : [],
      speed: dnd5eRaceSpeed(setup.dnd5eRaceId ?? setup.race),
      hitPointMaximumMode: 'fixed',
      equipment: startingEquipment.equipment,
      dnd5eInventory: startingEquipment.inventory,
      dnd5eClassChoices: setup.initialClassChoices,
      dnd5eCreationTargetLevel: setup.targetLevel > 1 ? setup.targetLevel : undefined,
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
    if (setup.targetLevel > 1) {
      const baseCharacter = useCharacterStore.getState().characters.find((character) => character.id === id)
      if (baseCharacter) writeCharacterCreationDraft(characterCreationDraftKey(`base:${id}`), { character: baseCharacter })
      if (!editingCreationId) copyCharacterCreationDraft(characterCreationDraftKey(), characterCreationDraftKey(`setup:${id}`))
    }
    setEditingCreationId(null)
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
  const roomCharacterAssignment = isDM ? null : getRoomCharacterAssignment()
  const playerVisibleList = playerViewCharacters(characters, {
    slot: playerSlot,
    assignedCharacterId,
  })
  const visibleList = playerVisibleList
  const assignableList = playerVisibleList
  const activeId = playerCharacterPageActiveId(visibleList, {
    isDM,
    assignedCharacterId,
    selectedCharacterId: selectedId,
  })
  const activeCharacter = activeId ? visibleList.find((c) => c.id === activeId) ?? null : null
  const unfinishedCreations = visibleList.filter((character) => (character.dnd5eCreationTargetLevel ?? 0) > 1)
  const effectivePendingCreation = pendingCreation

  const finishPendingCreation = async () => {
    if (!effectivePendingCreation) return
    const character = useCharacterStore.getState().characters.find((entry) => entry.id === effectivePendingCreation.characterId)
    if (!character || character.level < effectivePendingCreation.targetLevel) return
    update(character.id, { dnd5eCreationTargetLevel: undefined })
    try {
      await useCharacterStore.getState().saveSharedNow()
      clearCharacterCreationDraft(characterCreationDraftKey(`base:${character.id}`))
      clearCharacterCreationDraft(characterCreationDraftKey(`setup:${character.id}`))
      setPendingCreation(null)
    } catch (error) {
      update(character.id, { dnd5eCreationTargetLevel: effectivePendingCreation.targetLevel })
      throw error
    }
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
      await showAppAlert('无法载入角色 JSON。请确认文件是从本项目导出的角色文件。')
    }
  }

  const deleteActiveCharacter = async () => {
    if (!activeCharacter) return
    if (
      roomCharacterAssignment?.enforced === true &&
      roomCharacterAssignment.characterId === activeCharacter.id
    ) {
      await showAppAlert({
        title: '角色由 DM 锁定',
        message: '这个角色当前由 DM 指定给你。请先让 DM 解除分配或由 DM 删除。',
        tone: 'danger',
      })
      return
    }
    const linkedTokens = useMapStore.getState().maps.flatMap((map) =>
      map.tokens.filter((token) => token.characterId === activeCharacter.id).map((token) => ({
        mapName: map.name,
        tokenName: token.label,
      })))
    if (linkedTokens.length > 0) {
      await showAppAlert({
        title: '角色仍在地图上',
        message: `该角色仍关联 ${linkedTokens.length} 个地图 Token。请让 DM 从角色名册删除，系统会同时清理这些 Token。`,
        tone: 'danger',
      })
      return
    }
    const confirmed = await showAppConfirm({
      title: '删除角色',
      message: `确定从当前房间删除“${activeCharacter.name}”吗？角色的账号角色库备份仍会保留，可稍后重新带入房间。`,
      confirmLabel: '确认删除',
      tone: 'danger',
    })
    if (!confirmed) return
    if (assignedCharacterId === activeCharacter.id) {
      setAssignedPlayerCharacterId(null, playerSlot)
    }
    remove(activeCharacter.id)
  }

  const importCharacterExcelFile = async (file: File) => {
    if (excelImportBusy) return
    setExcelImportBusy(true)
    try {
      const workbook = await parseCharacterExcelFile(file)
      const draft = buildCharacterExcelImportDraft(workbook)
      let portraitDataUrl: string | undefined
      const portraitCandidate = workbook.images[0]
      if (portraitCandidate) {
        try {
          portraitDataUrl = await createCharacterPortraitDataUrl(characterExcelImageFile(portraitCandidate))
        } catch (error) {
          console.warn('[character-excel-portrait-skipped]', error)
          draft.warnings = [...draft.warnings, '读取到内嵌图片，但无法将其转换为角色立绘。']
        }
      }
      setExcelImportPreview({ workbook, draft, ...(portraitDataUrl ? { portraitDataUrl } : {}) })
    } catch (error) {
      console.error('[character-excel-import-failed]', error)
      await showAppAlert({
        title: '无法读取人物卡 Excel',
        message: error instanceof Error ? error.message : '请确认文件是有效的 .xlsx 或 .xlsm 人物卡。',
        tone: 'danger',
      })
    } finally {
      setExcelImportBusy(false)
    }
  }

  const confirmExcelImport = (character: Parameters<typeof importCharacter>[0]) => {
    const id = importCharacter(isDM && roomSession?.role === 'dm'
      ? {
          ...character,
          roomId: roomSession.roomId,
          roomMemberId: undefined,
          ownerAccountId: undefined,
          player: 'DM 待分配',
          visibleToPlayers: true,
        }
      : character)
    if (!isDM) setAssignedPlayerCharacterId(id, playerSlot)
    select(id)
    setExcelImportPreview(null)
  }

  useEffect(() => {
    if (!isDM && selectedId && !visibleList.some((c) => c.id === selectedId)) {
      select(visibleList[0]?.id ?? null)
    }
  }, [isDM, selectedId, select, visibleList])

  return (
    <div className="mx-auto w-full max-w-[1800px]">
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
                <input
                  ref={excelImportFileRef}
                  type="file"
                  accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,.xlsx,.xlsm"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (file) void importCharacterExcelFile(file)
                    event.currentTarget.value = ''
                  }}
                />
                <label className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300">
                  <span className="text-xs font-semibold text-slate-500">{playerSlotLabel(playerSlot)}</span>
                  <select
                    value={assignedCharacterId ?? ''}
                    disabled={roomCharacterAssignment?.enforced === true}
                    onChange={(e) => {
                      setAssignedPlayerCharacterId(e.target.value || null, playerSlot)
                      if (e.target.value) select(e.target.value)
                    }}
                    className="min-w-36 rounded-lg border border-white/10 bg-void-900/70 px-2 py-1 text-sm text-slate-100 outline-none focus:border-arcane-500"
                    title={roomCharacterAssignment?.enforced ? '该角色由 DM 指定' : '选择当前控制的角色'}
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
                  onClick={() => excelImportFileRef.current?.click()}
                  disabled={excelImportBusy}
                  className="glass flex items-center gap-2 rounded-xl border-violet-400/20 px-4 py-2.5 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {excelImportBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  {excelImportBusy ? '解析人物卡…' : 'Excel / AI 填卡'}
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
                  type="button"
                  onClick={() => void deleteActiveCharacter()}
                  disabled={!activeCharacter}
                  className="glass flex items-center gap-2 rounded-xl border-red-400/20 px-4 py-2.5 text-sm font-semibold text-red-200 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  删除角色
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
            {isDM && (
              <>
                <input
                  ref={excelImportFileRef}
                  type="file"
                  accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,.xlsx,.xlsm"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (file) void importCharacterExcelFile(file)
                    event.currentTarget.value = ''
                  }}
                />
                <button
                  onClick={() => excelImportFileRef.current?.click()}
                  disabled={excelImportBusy}
                  className="glass flex items-center gap-2 rounded-xl border-violet-400/20 px-4 py-2.5 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {excelImportBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  {excelImportBusy ? '解析人物卡…' : 'Excel / AI 填卡并待分配'}
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

      {!isDM && !showCreate && !effectivePendingCreation && <div className="space-y-2">
        {hasCharacterCreationDraft(characterCreationDraftKey()) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-300/20 bg-violet-500/10 p-4 text-sm text-violet-100"><span>你有一份尚未完成的建卡草稿。</span><button type="button" onClick={openCreateDialog} className="rounded-lg bg-violet-500/25 px-4 py-2 font-semibold">继续建卡草稿</button></div>}
        {unfinishedCreations.map((character) => <div key={character.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100"><span>{character.name} · 建卡进度 {character.level}/{character.dnd5eCreationTargetLevel} 级，尚未最终确认</span><button type="button" onClick={() => { select(character.id); setPendingCreation({ characterId: character.id, targetLevel: character.dnd5eCreationTargetLevel! }) }} className="rounded-lg bg-amber-500/25 px-4 py-2 font-semibold">继续创建 {character.name}</button></div>)}
      </div>}

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
        <CharacterSetupDialog
          key={editingCreationId ?? 'new'}
          draftKey={editingCreationId ? characterCreationDraftKey(`setup:${editingCreationId}`) : characterCreationDraftKey()}
          clearOnComplete={!editingCreationId}
          onCancel={() => { setShowCreate(false); setEditingCreationId(null) }}
          onComplete={confirmCreate}
        />
      )}
      {!isDM && effectivePendingCreation && (
        <CharacterCreationAdvancementFlow
          key={effectivePendingCreation.characterId}
          characterId={effectivePendingCreation.characterId}
          targetLevel={effectivePendingCreation.targetLevel}
          onComplete={finishPendingCreation}
          onPause={() => setPendingCreation(null)}
          onEditBase={hasCharacterCreationDraft(characterCreationDraftKey(`base:${effectivePendingCreation.characterId}`)) && hasCharacterCreationDraft(characterCreationDraftKey(`setup:${effectivePendingCreation.characterId}`)) ? async () => {
            if (!await showAppConfirm({ title: '修改起始选择', message: '将保留当前角色。修改并确认起始职业、属性或种族后，需要从 2 级起重新选择后续等级；关闭编辑不会更改当前角色。', confirmLabel: '编辑起始选择' })) return
            setEditingCreationId(effectivePendingCreation.characterId)
            setPendingCreation(null)
            setShowCreate(true)
          } : undefined}
        />
      )}
      {excelImportPreview && (
        <CharacterExcelImportDialog
          workbook={excelImportPreview.workbook}
          initialDraft={excelImportPreview.draft}
          portraitDataUrl={excelImportPreview.portraitDataUrl}
          existingNames={characters.map((character) => character.name)}
          usePlayerAi={!isDM}
          onCancel={() => setExcelImportPreview(null)}
          onImport={confirmExcelImport}
        />
      )}
    </div>
  )
}
