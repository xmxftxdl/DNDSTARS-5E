import type { Dispatch, SetStateAction } from 'react'
import type { Dnd5eSpellTargetingSession } from '../../application/combat/spells/SpellTargetingContracts'
import { dnd5eAreaRequiresGround } from '../../rulesets/dnd5e/verticalCombatGeometry'

export function SpellAreaElevationControls({ targeting, setTargeting, previewNames, onResetPreview }: {
  targeting: Dnd5eSpellTargetingSession
  setTargeting: Dispatch<SetStateAction<Dnd5eSpellTargetingSession | null>>
  previewNames: string
  onResetPreview: () => void
}) {
  return <>
              {targeting.area && !dnd5eAreaRequiresGround(targeting.spellId) && !(targeting.area.origin === 'self' && targeting.area.shape === 'circle') ? (
                <label className="flex items-center gap-2 text-xs text-violet-100">
                  {targeting.area.origin === 'self' ? '瞄准高度' : '落点高度'}（尺）
                  <input type="number" aria-label="法术目标高度" min={-1000} max={10000} step={5}
                    placeholder="随地形" value={targeting.targetElevationFeet ?? ''}
                    disabled={targeting.areaTargetSelected || (targeting.areaTargetCells?.length ?? 0) > 0}
                    onChange={(event) => {
                      const value = event.target.value === '' ? undefined : Number(event.target.value)
                      if (value != null && (!Number.isFinite(value) || value < -1000 || value > 10000)) return
                      setTargeting((current) => current ? { ...current, targetElevationFeet: value } : null)
                    }}
                    className="w-20 rounded border border-violet-300/30 bg-void-900 px-2 py-1" />
                  <span>绝对高度；留空随地形{(targeting.areaTargetCount ?? 1) > 1 ? '，所有落点共用' : ''}</span>
                </label>
              ) : null}
              {targeting.area ? <span className="max-w-[min(45vw,28rem)] truncate text-xs text-violet-100" title={previewNames} data-testid="spell-area-spatial-targets">
                范围内：{previewNames || '无生物'}
              </span> : null}
              {targeting.areaTargetSelected ? (
                <button type="button" className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => {
                  setTargeting((current) => current ? { ...current,
                    areaTargetSelected: false, areaTargetCell: undefined, areaTargetCells: [],
                    targetTokenIds: [], sculptedTargetIds: [], carefulTargetIds: [], heightenedTargetId: undefined,
                    sculpting: false, carefulSelecting: false, heightenedSelecting: false,
                  } : null)
                  onResetPreview()
                }}>重新选点</button>
              ) : null}
  </>
}
