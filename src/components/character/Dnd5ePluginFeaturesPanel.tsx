import { useSyncExternalStore } from 'react'
import { Check, LockKeyhole, PlugZap } from 'lucide-react'
import {
  dnd5ePluginFeatureAvailableForCharacter,
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginFeatures,
  subscribeDnd5eRulesPluginRegistry,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import {
  getRoomRulesSnapshot,
  roomAllowsPlugin,
  subscribeRoomRules,
} from '../../lib/roomRulesState'

const ECONOMY_LABEL = {
  action: '动作',
  bonusAction: '附赠动作',
  reaction: '反应',
  none: '不消耗行动资源',
} as const

export default function Dnd5ePluginFeaturesPanel({
  character,
  onChange,
}: {
  character: Character
  onChange: (patch: Partial<Character>) => void
}) {
  useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const registeredFeatures = registeredDnd5ePluginFeatures()
  // 子职特性由所选子职和等级自动授予，只在职业进度页展示，不能手动勾选。
  const features = registeredFeatures.filter((feature) => !feature.grantedBySubclass)
  const selected = new Set(character.dnd5ePluginFeatureIds ?? [])
  const registeredIds = new Set(registeredFeatures.map((feature) => feature.id))
  const missingIds = [...selected].filter((featureId) => !registeredIds.has(featureId))

  const toggle = (featureId: string) => {
    const next = selected.has(featureId)
      ? [...selected].filter((id) => id !== featureId)
      : [...selected, featureId]
    onChange({ dnd5ePluginFeatureIds: next })
  }

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-500/10 p-2.5">
          <PlugZap className="h-5 w-5 text-violet-300" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">扩展规则特性</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            以下文字和自动化由用户安装的独立插件提供，不属于 SRD 5.1 核心包。选择结果会保存到角色并参与 DM Headless 校验。
          </p>
        </div>
      </div>

      {features.length === 0 && missingIds.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
          尚无已安装插件提供通用特性。可在“规则插件”页面安装兼容模板。
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {features.map((feature) => {
            const available = dnd5ePluginFeatureAvailableForCharacter(feature, character)
            const active = selected.has(feature.id)
            const allowedForRoom = roomAllowsPlugin(feature.ownerPluginId, roomRules)
            const selectable = available && (allowedForRoom || active)
            return (
              <article key={feature.id} className={`rounded-xl border p-4 ${
                active ? 'border-violet-400/30 bg-violet-500/8' : 'border-white/8 bg-black/10'
              }`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-100">{feature.name}</h4>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                        {feature.automation === 'full' ? '完整自动结算' : feature.automation === 'partial' ? '部分自动结算' : 'DM 手动裁定'}
                      </span>
                      {feature.action && (
                        <span className="rounded-full bg-arcane-500/10 px-2 py-0.5 text-[10px] text-arcane-200">
                          {ECONOMY_LABEL[feature.action.economy]}
                        </span>
                      )}
                      {!allowedForRoom && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                          未在本房间启用
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{feature.summary}</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">{feature.description}</p>
                    <p className="mt-2 break-all text-[11px] text-slate-600">
                      {feature.sourceLabel ?? feature.ownerPluginName} · {feature.ownerPluginLicense} · {feature.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() => toggle(feature.id)}
                    className={`flex shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      !selectable
                        ? 'cursor-not-allowed border-white/5 text-slate-600'
                        : active
                          ? 'border-violet-400/30 bg-violet-500/15 text-violet-100'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:border-violet-400/30 hover:text-violet-100'
                    }`}
                  >
                    {selectable ? <Check className={`h-4 w-4 ${active ? 'opacity-100' : 'opacity-30'}`} /> : <LockKeyhole className="h-4 w-4" />}
                    {!allowedForRoom && !active
                      ? '房间未启用'
                      : available ? active ? '已选择' : '选择' : `${feature.minimumLevel ?? 1}级解锁`}
                  </button>
                </div>
              </article>
            )
          })}

          {missingIds.map((featureId) => (
            <article key={featureId} className="rounded-xl border border-amber-400/15 bg-amber-500/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-amber-100">插件未安装，已保留选择</h4>
                  <p className="mt-1 break-all font-mono text-xs text-amber-100/55">{featureId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(featureId)}
                  className="rounded-xl border border-amber-400/15 px-3 py-2 text-xs text-amber-100/75 hover:bg-amber-500/10"
                >
                  从角色移除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
