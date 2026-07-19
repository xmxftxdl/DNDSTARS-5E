import { AlertTriangle, Database, ShieldCheck, Wrench } from 'lucide-react'
import Card from './Card'
import { modeFromPort } from '../lib/appMode'
import { useCharacterStore } from '../store/characters'
import { useMapStore } from '../store/maps'
import {
  migrateDnd5eCombatStateEffects,
  validateDnd5eActiveEffectsStrict,
} from '../rulesets/dnd5e/activeEffects'
import { inspectDnd5eEffectStates } from '../rulesets/dnd5e/effectDiagnostics'

export default function Dnd5eEffectDiagnosticsPanel() {
  const characters = useCharacterStore((state) => state.characters)
  const updateCharacter = useCharacterStore((state) => state.update)
  const maps = useMapStore((state) => state.maps)
  const updateToken = useMapStore((state) => state.updateToken)
  if (modeFromPort() !== 'dm') return null

  const issues = inspectDnd5eEffectStates({ characters, maps })
  const errors = issues.filter((issue) => issue.severity === 'error')
  const repair = () => {
    for (const character of characters) {
      if (!validateDnd5eActiveEffectsStrict(character.dnd5eCombatState?.activeEffects).ok) continue
      const migrated = migrateDnd5eCombatStateEffects({
        targetId: character.id,
        state: character.dnd5eCombatState,
        conditions: character.conditions,
      })
      updateCharacter(character.id, {
        conditions: migrated.conditions,
        dnd5eCombatState: {
          ...character.dnd5eCombatState,
          schemaVersion: migrated.schemaVersion,
          activeEffects: migrated.activeEffects,
        },
      })
    }
    for (const map of maps) {
      for (const token of map.tokens) {
        const state = token.dnd5eCombatState
        if (!state || !validateDnd5eActiveEffectsStrict(state.activeEffects).ok) continue
        const migrated = migrateDnd5eCombatStateEffects({
          targetId: token.id,
          state,
          conditions: state.conditions,
        })
        const nativeState = { ...state } as typeof state & Record<string, unknown>
        delete nativeState.timedEffects
        updateToken(map.id, token.id, {
          dnd5eCombatState: {
            ...nativeState,
            schemaVersion: migrated.schemaVersion,
            activeEffects: migrated.activeEffects,
            conditions: migrated.conditions.length > 0 ? migrated.conditions : undefined,
          },
        })
      }
    }
  }

  return (
    <Card className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className={`rounded-xl p-3 ${issues.length ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
            {issues.length ? <Database className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">D&D 5e 状态数据诊断</h3>
            <p className="mt-1 text-sm text-slate-400">
              检查旧 timedEffects、损坏实例、只读投影、来源角色与专注引用。错误数据会在共享入口被拒绝。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={repair}
          disabled={issues.length === 0}
          className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Wrench className="h-4 w-4" />迁移旧状态并重建投影
        </button>
      </div>
      {issues.length === 0 ? (
        <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
          未发现状态数据问题，所有持久化实例均符合 schema v2。
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          <p className="text-xs text-slate-400">共 {issues.length} 项，其中 {errors.length} 项错误。损坏实例不会被自动删除，请从快照恢复或由 DM 手动处理。</p>
          {issues.slice(0, 20).map((issue) => (
            <div key={issue.id} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${issue.severity === 'error' ? 'border-rose-500/25 bg-rose-950/20 text-rose-200' : 'border-amber-500/25 bg-amber-950/20 text-amber-200'}`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span><strong>{issue.ownerName}</strong>：{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
