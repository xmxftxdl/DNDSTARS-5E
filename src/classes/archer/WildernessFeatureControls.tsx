import { useState } from 'react'
import { useCharacterStore } from '../../store/characters'
import { hasDarkvision, rollSkillCheck, wildernessPassiveAdvantage } from '../../lib/archerBaseFeatures'
import type { ClassFeatureKey } from '../../types/character'

export default function WildernessFeatureControls({
  charId,
  battleMode,
  onActivateFeature,
}: {
  charId: string
  battleMode: boolean
  onActivateFeature?: (key: ClassFeatureKey) => void | Promise<void>
}) {
  const character = useCharacterStore((state) => state.characters.find((item) => item.id === charId))
  const activateClassFeature = useCharacterStore((state) => state.useClassFeature)
  const spendAP = useCharacterStore((state) => state.spendAP)
  const updateCharacter = useCharacterStore((state) => state.update)
  const [lastCheckLabel, setLastCheckLabel] = useState<string | null>(null)
  if (!character) return null

  const runCheck = (skillKey: 'survival' | 'perception') => {
    const isDaytime = skillKey === 'survival' ? window.confirm('当前是否为白天？\n确定 = 白天，取消 = 夜晚') : undefined
    const inWilderness = skillKey === 'perception' ? window.confirm('当前是否处于野外环境？') : undefined
    const passiveAdvantage = wildernessPassiveAdvantage(character, skillKey, {
      isDaytime: skillKey === 'survival' ? isDaytime : undefined,
      inWilderness: skillKey === 'perception' ? inWilderness : undefined,
    })
    const boosted = !!character.combatBuffs?.wildernessGuideBoost
    const result = rollSkillCheck(character, skillKey, { advantage: passiveAdvantage || boosted })
    setLastCheckLabel(result.label)
    if (boosted) {
      updateCharacter(charId, {
        combatBuffs: { ...character.combatBuffs, wildernessGuideBoost: undefined },
      })
    }
  }

  const activate = () => {
    if (battleMode && onActivateFeature) {
      void onActivateFeature('wildernessGuide')
      return
    }
    const trait = character.traits.find((item) => item.featureKey === 'wildernessGuide')
    if (!trait || trait.uses <= 0) {
      alert('特殊指引次数已用完')
      return
    }
    if (!spendAP(charId, 1)) {
      alert('行动点不足（需要 1 AP）')
      return
    }
    if (!activateClassFeature(charId, 'wildernessGuide')) return
    updateCharacter(charId, {
      combatBuffs: { ...character.combatBuffs, wildernessGuideBoost: true },
    })
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-emerald-500/20 bg-void-900/40 p-3">
      <p className="text-xs text-slate-400">
        被动：白天生存检定优势；野外察觉检定优势
        {hasDarkvision(character) ? '；夜晚生存检定优势（黑暗视觉）' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => runCheck('survival')} className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25">
          生存检定
        </button>
        <button type="button" onClick={() => runCheck('perception')} className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25">
          察觉检定
        </button>
        {!battleMode && (
          <button type="button" disabled={character.currentAP < 1} onClick={activate} className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40">
            特殊指引
          </button>
        )}
      </div>
      {lastCheckLabel && <p className="text-xs font-medium text-arcane-200">{lastCheckLabel}</p>}
    </div>
  )
}
