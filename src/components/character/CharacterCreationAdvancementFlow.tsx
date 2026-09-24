import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, GraduationCap, LockKeyhole, X } from 'lucide-react'
import { availableDnd5eClassDefinitions, type Dnd5eClassId } from '../../rulesets/dnd5e/classes'
import {
  dnd5eCharacterClassLevel,
  dnd5eTotalCharacterLevel,
  validateDnd5eMulticlassLevelGain,
} from '../../rulesets/dnd5e/multiclass'
import { useCharacterStore } from '../../store/characters'
import CharacterLevelUpDialog from './CharacterLevelUpDialog'
import { characterCreationDraftKey } from '../../lib/characterCreationDraft'
import type { Character, Dnd5eLevelAdvancementRecordV1 } from '../../types/character'

interface CharacterCreationAdvancementFlowProps {
  characterId: string
  targetLevel: number
  onComplete(): void | Promise<void>
  onPause(): void
  onEditBase?: () => void
}

const VALIDATION_MESSAGES = {
  'maximum-level': '角色已经达到 20 级。',
  'current-class-prerequisite': '角色不满足现有职业的兼职属性前提，不能开始新的兼职。',
  'target-class-prerequisite': '当前属性不满足该职业的兼职前提。',
} as const

export default function CharacterCreationAdvancementFlow({
  characterId,
  targetLevel,
  onComplete,
  onPause,
  onEditBase,
}: CharacterCreationAdvancementFlowProps) {
  const character = useCharacterStore((state) =>
    state.characters.find((candidate) => candidate.id === characterId),
  )
  const update = useCharacterStore((state) => state.update)
  const saveSharedNow = useCharacterStore((state) => state.saveSharedNow)
  const classDefinitions = availableDnd5eClassDefinitions()
  const primaryClassId = classDefinitions.find(
    (definition) => definition.name === character?.charClass,
  )?.id
  const [selectedClassId, setSelectedClassId] = useState<Dnd5eClassId>(primaryClassId ?? 'fighter')
  const [settling, setSettling] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<Character>()
  const [revisionRecord, setRevisionRecord] = useState<Dnd5eLevelAdvancementRecordV1>()
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')
  const currentLevel = character ? dnd5eTotalCharacterLevel(character) : 0
  const validation = useMemo(
    () => character ? validateDnd5eMulticlassLevelGain(character, selectedClassId) : undefined,
    [character, selectedClassId],
  )

  if (!character) return null
  const ready = currentLevel >= targetLevel

  if (settling || revisionRecord) {
    return (
      <CharacterLevelUpDialog
        key={revisionRecord?.id ?? `${editingCharacter?.level ?? currentLevel}:${selectedClassId}`}
        character={editingCharacter ?? character}
        classId={revisionRecord?.classId ?? selectedClassId}
        levelsGained={1}
        revisionRecord={revisionRecord}
        creationDraftKey={characterCreationDraftKey(`level:${characterId}:${revisionRecord?.id ?? `${editingCharacter?.level ?? currentLevel}:${selectedClassId}`}`)}
        onCancel={() => { setSettling(false); setRevisionRecord(undefined) }}
        onConfirm={async (nextCharacter) => {
          const previous = useCharacterStore.getState().characters.find((entry) => entry.id === characterId)
          if (!previous?.dnd5eCreationTargetLevel) throw new Error('这张角色卡已结束建卡，请关闭面板查看最新状态。')
          update(characterId, nextCharacter)
          try { await saveSharedNow() } catch (cause) { update(characterId, previous); throw cause }
          setSettling(false)
          setRevisionRecord(undefined)
        }}
      />
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="creation-advancement-title"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-violet-300/20 bg-void-950 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
              <GraduationCap className="h-4 w-4" /> 高等级角色逐级创建
            </div>
            <h2 id="creation-advancement-title" className="mt-1 text-xl font-bold text-slate-50">
              {ready ? '检查并完成角色' : `处理角色总等级 ${currentLevel + 1}`}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              目标 {targetLevel} 级 · 已完成的等级可返回修改 · 关闭后保留建卡进度
            </p>
          </div>
          <button
            type="button"
            onClick={onPause}
            aria-label="保存并关闭角色创建" disabled={finishing}
            className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-rose-200"
            title="保存草稿，下次继续"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <section className="mb-4 rounded-xl border border-white/10 p-4">
            <h3 className="text-sm font-semibold text-slate-100">{character.name} · 当前 {currentLevel} 级</h3>
            <p className="mt-1 text-xs text-slate-400">{character.race} · {character.charClass} · 生命值 {character.maxHp}</p>
            <p className="mt-2 text-xs text-slate-400">点击已完成的等级可修改选择；后续等级会重新检查，不再满足条件的等级需要重新选择。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {onEditBase && <button type="button" onClick={onEditBase} className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">修改 1 级与起始选择</button>}
              {(character.dnd5eLevelAdvancements ?? []).map((record) => <button key={record.id} type="button" onClick={() => { setEditingCharacter(structuredClone(character)); setRevisionRecord(record) }} className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">修改 {record.toLevel} 级 · {classDefinitions.find((entry) => entry.id === record.classId)?.name ?? record.classId}</button>)}
            </div>
          </section>
          {!ready && <>
          <div className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.05] p-4 text-xs leading-5 text-amber-100">
            选择本级提升的职业。选择兼职时会检查属性是否满足要求。
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classDefinitions.map((definition) => {
              const candidateValidation = validateDnd5eMulticlassLevelGain(character, definition.id)
              const classLevel = dnd5eCharacterClassLevel(character, definition.id)
              const selected = selectedClassId === definition.id
              return (
                <button
                  key={definition.id}
                  type="button"
                  disabled={!candidateValidation.ok}
                  aria-pressed={selected}
                  onClick={() => setSelectedClassId(definition.id)}
                  className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${
                    selected
                      ? 'border-violet-300/45 bg-violet-500/12 text-violet-50'
                      : 'border-white/8 bg-black/15 text-slate-400 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{definition.name}</span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px]">
                      {classLevel > 0 ? `当前 ${classLevel} 级` : '兼职'}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 opacity-70">
                    生命骰 d{definition.hitDie} · 主属性 {definition.primaryAbilities.map((ability) => ability.toUpperCase()).join('／')}
                  </p>
                  {!candidateValidation.ok && (
                    <p className="mt-2 flex items-center gap-1.5 text-[10px] text-rose-300">
                      <LockKeyhole className="h-3 w-3" />
                      {VALIDATION_MESSAGES[candidateValidation.reason]}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
          </>}
          {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-4 sm:px-7">
          <p className="text-xs text-slate-500">
            {ready ? '确认后完成建卡。之后的升级修改由 DM 处理。' : `已完成 ${currentLevel - 1}/${targetLevel - 1} 次升级。`}
          </p>
          <button
            type="button"
            disabled={finishing || (!ready && !validation?.ok)}
            onClick={async () => {
              if (!ready) { setEditingCharacter(structuredClone(character)); setSettling(true); return }
              setFinishing(true)
              setError('')
              try { await onComplete() } catch (cause) { setError(cause instanceof Error ? cause.message : '未能保存，请重试。') } finally { setFinishing(false) }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {ready ? finishing ? '正在保存…' : '完成角色创建' : '结算本级'} <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
