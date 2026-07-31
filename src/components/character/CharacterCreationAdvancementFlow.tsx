import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, GraduationCap, LockKeyhole, X } from 'lucide-react'
import { DND5E_SRD_CLASS_DEFINITIONS, type Dnd5eClassId } from '../../rulesets/dnd5e/classes'
import {
  dnd5eCharacterClassLevel,
  dnd5eTotalCharacterLevel,
  validateDnd5eMulticlassLevelGain,
} from '../../rulesets/dnd5e/multiclass'
import { useCharacterStore } from '../../store/characters'
import CharacterLevelUpDialog from './CharacterLevelUpDialog'

interface CharacterCreationAdvancementFlowProps {
  characterId: string
  targetLevel: number
  onComplete(): void
  onAbandon(): void
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
  onAbandon,
}: CharacterCreationAdvancementFlowProps) {
  const character = useCharacterStore((state) =>
    state.characters.find((candidate) => candidate.id === characterId),
  )
  const update = useCharacterStore((state) => state.update)
  const primaryClassId = DND5E_SRD_CLASS_DEFINITIONS.find(
    (definition) => definition.name === character?.charClass,
  )?.id
  const [selectedClassId, setSelectedClassId] = useState<Dnd5eClassId>(primaryClassId ?? 'fighter')
  const [settling, setSettling] = useState(false)
  const currentLevel = character ? dnd5eTotalCharacterLevel(character) : 0
  const validation = useMemo(
    () => character ? validateDnd5eMulticlassLevelGain(character, selectedClassId) : undefined,
    [character, selectedClassId],
  )

  if (!character || currentLevel >= targetLevel) return null

  if (settling) {
    return (
      <CharacterLevelUpDialog
        character={character}
        classId={selectedClassId}
        levelsGained={1}
        onCancel={() => setSettling(false)}
        onConfirm={(nextCharacter) => {
          update(characterId, nextCharacter)
          if (nextCharacter.level >= targetLevel) onComplete()
          else setSettling(false)
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
              处理角色总等级 {currentLevel + 1}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              目标 {targetLevel} 级 · 本次只能获得 1 个职业等级 · 确认后不能返回修改
            </p>
          </div>
          <button
            type="button"
            onClick={onAbandon}
            aria-label="放弃角色创建"
            className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-rose-200"
            title="放弃并删除这张尚未完成的角色卡"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.05] p-4 text-xs leading-5 text-amber-100">
            选择本级提升的职业。继续原职业不需要兼职检定；选择新职业时，Host 会重新检查现有职业和目标职业的属性前提。
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DND5E_SRD_CLASS_DEFINITIONS.map((definition) => {
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
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-4 sm:px-7">
          <p className="text-xs text-slate-500">
            已完成 {currentLevel - 1}/{targetLevel - 1} 次升级；后续仍会逐级处理子职、专长、战斗风格和职业选项。
          </p>
          <button
            type="button"
            disabled={!validation?.ok}
            onClick={() => setSettling(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            结算本级 <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
