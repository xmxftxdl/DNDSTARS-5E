import { useMemo, useState, useSyncExternalStore } from 'react'
import { PlugZap } from 'lucide-react'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type {
  Dnd5ePluginActionPayload,
  Dnd5eTurnEconomyCounts,
} from '../../lib/sharedCombatTypes'
import {
  dnd5ePluginFeatureAvailableForCharacter,
  dnd5ePluginFeatureDefinition,
  dnd5eCharacterHasPluginFeature,
  registeredDnd5ePluginFeatures,
  dnd5eRulesPluginRegistrySnapshot,
  subscribeDnd5eRulesPluginRegistry,
} from '../../rulesets/dnd5e'
import type { Dnd5ePluginTargeting } from '../../rulesets/dnd5e'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  getRoomRulesSnapshot,
  roomAllowsPlugin,
  subscribeRoomRules,
} from '../../lib/roomRulesState'

function economyAvailable(
  economy: 'action' | 'bonusAction' | 'reaction' | 'none',
  turn: Dnd5eTurnEconomyCounts,
): boolean {
  if (economy === 'none') return true
  return turn[economy].current > 0
}

export default function Dnd5ePluginCombatPanel({
  character,
  map,
  actorToken,
  canAct,
  pending,
  turnEconomy,
  onAction,
  onBeginAreaTargeting,
}: {
  character: Character
  map: BattleMap
  actorToken: Token
  canAct: boolean
  pending: boolean
  turnEconomy: Dnd5eTurnEconomyCounts
  onAction: (request: {
    targetTokenId?: string
    payload: Dnd5ePluginActionPayload
  }) => void
  onBeginAreaTargeting: (request: {
    featureId: string
    featureName: string
    targeting: Extract<Dnd5ePluginTargeting, { kind: 'area' }>
  }) => void
}) {
  const pluginRevision = useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )
  const [targetsByFeature, setTargetsByFeature] = useState<Record<string, string>>({})
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const features = useMemo(
    () => registeredDnd5ePluginFeatures().flatMap((feature) => {
      return dnd5eCharacterHasPluginFeature(character, feature.id) &&
        feature.action &&
        feature.automation !== 'manual' &&
        dnd5ePluginFeatureAvailableForCharacter(feature, character)
        ? [dnd5ePluginFeatureDefinition(feature.id)!]
        : []
    }),
    [character, pluginRevision],
  )
  if (features.length === 0) return null

  return (
    <section data-testid="dnd5e-plugin-combat-panel" className="rounded-xl border border-violet-400/15 bg-violet-500/5 p-3">
      <div className="mb-3 flex items-center gap-2">
        <PlugZap className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-violet-100">扩展规则行动</h3>
        <span className="ml-auto rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
          DM Headless
        </span>
      </div>
      <div className="space-y-3">
        {features.map((feature) => {
          const featureAction = feature.action!
          const targeting = featureAction.targeting
          const targetOptions = targeting.kind === 'self'
            ? [actorToken]
            : targeting.kind === 'area'
              ? []
              : map.tokens.filter((token) => {
                if (token.type === 'obstacle') return false
                if (token.id === actorToken.id && targeting.includeSelf !== true) return false
                const opposed = areOpposedCombatTokens(actorToken, token)
                if (targeting.relation === 'ally' && opposed) return false
                if (targeting.relation === 'enemy' && !opposed) return false
                const distanceFeet = tokenFootprintDistanceCells(actorToken, token, map) *
                  Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
                return targeting.rangeFeet == null || distanceFeet <= targeting.rangeFeet
              })
          const selectedTargetId = targeting.kind === 'self'
            ? actorToken.id
            : targeting.kind === 'area'
              ? '__area__'
              : targetsByFeature[feature.id] ?? targetOptions[0]?.id ?? ''
          const allowedForRoom = roomAllowsPlugin(feature.ownerPluginId, roomRules)
          const roomReady = roomRules?.member.ready ?? true
          const disabled = pending || !canAct || !roomReady || !allowedForRoom ||
            !economyAvailable(featureAction.economy, turnEconomy) || !selectedTargetId
          return (
            <article key={feature.id} className="rounded-lg border border-white/8 bg-black/15 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{feature.name}</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{featureAction.description ?? feature.summary}</p>
                  {(!allowedForRoom || !roomReady) && (
                    <p className="mt-1 text-[11px] text-amber-300">
                      {!allowedForRoom ? '该规则包未在本房间启用' : '本机规则包与房间版本不一致'}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                  {featureAction.economy === 'action'
                    ? '动作'
                    : featureAction.economy === 'bonusAction'
                      ? '附赠动作'
                      : featureAction.economy === 'reaction'
                        ? '反应'
                        : '免费'}
                </span>
              </div>
              {targeting.kind === 'single-creature' && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-500">地图目标</span>
                  <select
                    data-testid={`dnd5e-plugin-target-${feature.id}`}
                    value={selectedTargetId}
                    onChange={(event) => setTargetsByFeature((current) => ({
                      ...current,
                      [feature.id]: event.target.value,
                    }))}
                    className="w-full rounded-lg border border-white/10 bg-void-950/80 px-2 py-1.5 text-xs text-slate-200"
                  >
                    {targetOptions.length === 0 && <option value="">没有符合条件的目标</option>}
                    {targetOptions.map((token) => {
                      const distanceFeet = tokenFootprintDistanceCells(actorToken, token, map) *
                        Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
                      return <option key={token.id} value={token.id}>{token.label} · {distanceFeet}尺</option>
                    })}
                  </select>
                </label>
              )}
              <button
                data-testid={`dnd5e-plugin-action-${feature.id}`}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (targeting.kind === 'area') {
                    onBeginAreaTargeting({ featureId: feature.id, featureName: feature.name, targeting })
                    return
                  }
                  onAction({
                    targetTokenId: selectedTargetId,
                    payload: { featureId: feature.id },
                  })
                }}
                className="mt-3 w-full rounded-lg bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {featureAction.label}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
