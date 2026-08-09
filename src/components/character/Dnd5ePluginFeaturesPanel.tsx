import { useEffect, useSyncExternalStore } from 'react'
import { Check, LockKeyhole, PlugZap, Skull } from 'lucide-react'
import {
  classifyDnd5ePluginFeatureAudience,
  dnd5ePluginFeatAvailableForCharacter,
  dnd5ePluginFeatureAvailableForCharacter,
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginFeats,
  registeredDnd5ePluginFeatures,
  registeredDnd5ePluginMonsters,
  registeredDnd5ePluginRaces,
  subscribeDnd5eRulesPluginRegistry,
  DND5E_SRD_FEATS,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import {
  getRoomRulesSnapshot,
  roomAllowsPlugin,
  subscribeRoomRules,
} from '../../lib/roomRulesState'
import { useCustomMonsterStore } from '../../store/customMonsters'

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
  const roomMonsters = useCustomMonsterStore((state) => state.monsters)
  const roomMonstersLoaded = useCustomMonsterStore((state) => state.loaded)
  const loadRoomMonsters = useCustomMonsterStore((state) => state.loadShared)
  const registeredMonsters = registeredDnd5ePluginMonsters()
  const registeredRaces = registeredDnd5ePluginRaces()
  const allRaceGrantedFeatureIds = new Set(
    registeredRaces.flatMap((race) => race.grantedFeatureIds ?? []),
  )
  const selectedRace = registeredRaces.find((race) =>
    race.id === character.dnd5eRaceId || race.name === character.race)
  const selectedRaceGrantedFeatureIds = new Set(selectedRace?.grantedFeatureIds ?? [])
  useEffect(() => {
    void loadRoomMonsters()
  }, [loadRoomMonsters])
  // 子职和专长授予的特性在各自页面展示；当前种族授予的特性在这里只读展示。
  const features = registeredFeatures.filter((feature) =>
    !feature.grantedBySubclass &&
    !feature.grantedByFeat &&
    (!allRaceGrantedFeatureIds.has(feature.id) || selectedRaceGrantedFeatureIds.has(feature.id)))
  const classifiableFeatures = features.filter((feature) =>
    roomMonstersLoaded || !feature.ownerPluginId.startsWith('local.room.paste-'))
  const classifiedFeatures = classifiableFeatures.map((feature) => ({
    feature,
    classification: selectedRaceGrantedFeatureIds.has(feature.id)
      ? { audience: 'character' as const, monsterNames: [] }
      : classifyDnd5ePluginFeatureAudience(feature, [
          ...registeredMonsters,
          ...roomMonsters,
        ]),
  }))
  const characterFeatures = classifiedFeatures.filter(({ classification }) =>
    classification.audience === 'character')
  const monsterFeatures = classifiedFeatures.filter(({ classification }) =>
    classification.audience !== 'character')
  const waitingForRoomMonsterClassification = !roomMonstersLoaded && features.some((feature) =>
    feature.ownerPluginId.startsWith('local.room.paste-'))
  const feats = registeredDnd5ePluginFeats()
  const selected = new Set(character.dnd5ePluginFeatureIds ?? [])
  const selectedFeats = new Set(character.dnd5eFeatIds ?? [])
  const registeredIds = new Set(registeredFeatures.map((feature) => feature.id))
  const registeredFeatIds = new Set([...feats.map((feat) => feat.id), ...DND5E_SRD_FEATS.map((feat) => feat.id)])
  const missingIds = [...selected].filter((featureId) => !registeredIds.has(featureId))
  const missingFeatIds = [...selectedFeats].filter((featId) => !registeredFeatIds.has(featId))

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
            扩展内容按角色规则与怪物规则分开显示。只有角色规则可以加入人物卡并参与 DM Headless 校验。
          </p>
        </div>
      </div>

      {features.length === 0 && feats.length === 0 && missingIds.length === 0 && missingFeatIds.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
          尚无已安装插件提供通用特性。可在“规则插件”页面安装兼容模板。
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-violet-400/15 pb-2">
            <div>
              <h4 className="text-sm font-bold text-violet-100">角色规则</h4>
              <p className="mt-0.5 text-xs text-slate-500">角色可获得的专长、种族特性和通用扩展特性</p>
            </div>
            <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">
              {feats.length + characterFeatures.length}
            </span>
          </div>

          {feats.length === 0 && characterFeatures.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-5 text-center text-sm text-slate-500">
              当前扩展包没有提供角色规则。
            </div>
          )}

          {waitingForRoomMonsterClassification && (
            <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100/75">
              正在载入房间怪物目录并重新分类旧扩展规则…
            </div>
          )}

          {feats.map((feat) => {
            const available = dnd5ePluginFeatAvailableForCharacter(feat, character)
            const active = selectedFeats.has(feat.id)
            const allowedForRoom = roomAllowsPlugin(feat.ownerPluginId, roomRules)
            const prerequisite = [
              feat.prerequisite?.minimumLevel ? `等级 ${feat.prerequisite.minimumLevel}+` : '',
              ...Object.entries(feat.prerequisite?.abilityScores ?? {}).map(([ability, score]) =>
                `${ability.toUpperCase()} ${score}+`),
              feat.prerequisite?.raceIds?.length ? `种族：${feat.prerequisite.raceIds.join(' / ')}` : '',
            ].filter(Boolean).join('；')
            return (
              <article key={feat.id} className={`rounded-xl border p-4 ${
                active ? 'border-amber-400/30 bg-amber-500/8' : 'border-white/8 bg-black/10'
              }`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-100">{feat.name}</h4>
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">专长</span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                        {feat.automation === 'full' ? '完整自动结算' : feat.automation === 'partial' ? '部分自动结算' : 'DM 手动裁定'}
                      </span>
                      {!allowedForRoom && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                          未在本房间启用
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{feat.summary}</p>
                    {prerequisite && <p className="mt-1 text-xs text-amber-100/65">先决条件：{prerequisite}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">{feat.description}</p>
                    <p className="mt-2 break-all text-[11px] text-slate-600">
                      {feat.sourceLabel ?? feat.ownerPluginName} · {feat.ownerPluginLicense} · {feat.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    className={`flex shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                      active
                        ? 'border-amber-400/30 bg-amber-500/15 text-amber-100'
                        : 'border-white/5 text-slate-600'
                    }`}
                  >
                    {active ? <Check className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                    {!allowedForRoom && !active ? '房间未启用' : active ? '已由创建／升级获得' : available ? '升级时可选' : '不满足条件'}
                  </button>
                </div>
              </article>
            )
          })}

          {characterFeatures.map(({ feature }) => {
            const available = dnd5ePluginFeatureAvailableForCharacter(feature, character)
            const raciallyGranted = selectedRaceGrantedFeatureIds.has(feature.id)
            const active = raciallyGranted ? available : selected.has(feature.id)
            const allowedForRoom = roomAllowsPlugin(feature.ownerPluginId, roomRules)
            const selectable = !raciallyGranted && available && (allowedForRoom || active)
            return (
              <article key={feature.id} className={`rounded-xl border p-4 ${
                active ? 'border-violet-400/30 bg-violet-500/8' : 'border-white/8 bg-black/10'
              }`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-100">{feature.name}</h4>
                      {raciallyGranted && (
                        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                          种族授予
                        </span>
                      )}
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
                    disabled={raciallyGranted || !selectable}
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
                    {raciallyGranted
                      ? '自动获得'
                      : !allowedForRoom && !active
                      ? '房间未启用'
                      : available ? active ? '已选择' : '选择' : `${feature.minimumLevel ?? 1}级解锁`}
                  </button>
                </div>
              </article>
            )
          })}

          {monsterFeatures.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between gap-3 border-b border-rose-400/15 pb-2">
                <div className="flex items-start gap-2.5">
                  <Skull className="mt-0.5 h-4 w-4 text-rose-300" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-100">怪物规则</h4>
                    <p className="mt-0.5 text-xs text-slate-500">怪物属性块中的特性与动作，不会加入角色人物卡</p>
                  </div>
                </div>
                <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs text-rose-200">
                  {monsterFeatures.length}
                </span>
              </div>
            </div>
          )}

          {monsterFeatures.map(({ feature, classification }) => {
            const active = selected.has(feature.id)
            const monsterLabel = classification.audience === 'monster-action' ? '怪物动作' : '怪物特性'
            return (
              <article key={feature.id} className="rounded-xl border border-rose-400/15 bg-rose-500/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-100">{feature.name}</h4>
                      <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] text-rose-200">
                        {monsterLabel}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                        {feature.automation === 'full' ? '完整自动结算' : feature.automation === 'partial' ? '部分自动结算' : 'DM 手动裁定'}
                      </span>
                      {feature.action && (
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">
                          {ECONOMY_LABEL[feature.action.economy]}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{feature.summary}</p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">{feature.description}</p>
                    {classification.monsterNames.length > 0 && (
                      <p className="mt-2 text-xs text-rose-100/65">
                        所属怪物：{classification.monsterNames.join(' / ')}
                      </p>
                    )}
                    <p className="mt-2 break-all text-[11px] text-slate-600">
                      {feature.sourceLabel ?? feature.ownerPluginName} · {feature.ownerPluginLicense} · {feature.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!active}
                    onClick={() => toggle(feature.id)}
                    className={`flex shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-amber-400/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15'
                        : 'cursor-not-allowed border-white/5 text-slate-600'
                    }`}
                  >
                    {active ? <Check className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                    {active ? '从角色移除' : '怪物专用'}
                  </button>
                </div>
              </article>
            )
          })}

          {(missingIds.length > 0 || missingFeatIds.length > 0) && (
            <div className="border-b border-amber-400/15 pb-2 pt-2">
              <h4 className="text-sm font-bold text-amber-100">缺失引用</h4>
              <p className="mt-0.5 text-xs text-slate-500">原插件未安装，暂时无法判断属于角色还是怪物</p>
            </div>
          )}

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

          {missingFeatIds.map((featId) => (
            <article key={featId} className="rounded-xl border border-amber-400/15 bg-amber-500/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-amber-100">专长插件未安装，已保留选择</h4>
                  <p className="mt-1 break-all font-mono text-xs text-amber-100/55">{featId}</p>
                </div>
                <span className="rounded-xl border border-amber-400/15 px-3 py-2 text-xs text-amber-100/55">
                  只能由 DM 修订升级记录
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
