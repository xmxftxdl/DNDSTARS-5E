import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { CheckCircle2, PackageCheck, RefreshCw, ShieldCheck, Store, Trash2, Wrench } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { getRoomSession } from '../lib/roomSession'
import { deleteRoomPlugin } from '../lib/roomApi'
import { showAppConfirm } from '../lib/appDialog'
import {
  getRoomRulesSnapshot,
  subscribeRoomRules,
  setRoomRulesSnapshot,
} from '../lib/roomRulesState'
import {
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginContentNames,
  subscribeDnd5eRulesPluginRegistry,
} from '../rulesets/dnd5e'
import { activeRulesExtensionRecords } from './activeRulesExtensionsModel'
import { loadActiveExtensionDetails, type ActiveExtensionDetails } from './activeRulesExtensionDetails'
import { activeRulesExtensionNames } from './activeRulesExtensionNames'

export default function ActiveRulesExtensionsPage() {
  const { campaignId = 'local' } = useParams()
  const [roomSession] = useState(() => getRoomSession())
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const registryRevision = useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )
  const contentGroupsByOwner = useMemo(
    () => activeRulesExtensionNames(registeredDnd5ePluginContentNames()),
    // The external registry revision invalidates this metadata-only view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryRevision],
  )
  const [revision, setRevision] = useState(0)
  const [details, setDetails] = useState<Record<string, ActiveExtensionDetails>>({})
  const [removing, setRemoving] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const host = window.DNDSTARS_5E_RULES_PLUGINS
  const records = activeRulesExtensionRecords({
    installed: host?.listInstalled() ?? [],
    active: host?.listActive() ?? [],
    restrictToRoom: !!roomSession,
    roomRequirements: roomRules?.requiredPlugins,
  })
  const recordSignature = records
    .map(({ manifest, installed }) => `${manifest.id}@${manifest.version}:${installed.integrity}`)
    .sort()
    .join('|')
  const pendingRoomCount = roomSession
    ? Math.max(0, (roomRules?.requiredPlugins.length ?? 0) - records.length)
    : 0
  const campaignBasePath = `/campaign/${encodeURIComponent(campaignId)}`

  const removeExtension = async (id: string, name: string) => {
    if (!host || removing || (roomSession && roomSession.role !== 'dm')) return
    if (!(await showAppConfirm({ title: `卸载 ${name}`, message: '卸载后，该扩展的规则内容将停止生效。已有角色记录保留，但关联能力可能需要重新导入扩展才能使用。房间中的玩家会同步此变更。', tone: 'danger', confirmLabel: '卸载' }))) return
    setRemoving(id)
    setMessage(null)
    try {
      if (roomSession && roomRules?.requiredPlugins.some(plugin => plugin.id === id)) {
        setRoomRulesSnapshot(await deleteRoomPlugin(roomSession, id))
      }
      await host.remove(id)
      setRevision(value => value + 1)
      setMessage(`已卸载 ${name}。`)
    } catch (error) {
      setMessage(`卸载未完成：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setRemoving(null)
    }
  }

  useEffect(() => {
    if (!host || records.length === 0) return
    let disposed = false
    void Promise.all(records.map(async ({ manifest, installed }) => {
      try {
        return [manifest.id, await loadActiveExtensionDetails(host, manifest, installed)] as const
      } catch {
        return [manifest.id, {}] as const
      }
    })).then((entries) => {
      if (!disposed) setDetails(Object.fromEntries(entries))
    })
    return () => { disposed = true }
    // The signature changes only when an exact active package changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, recordSignature, revision])

  return (
    <div className="mx-auto w-full max-w-[1800px]" data-testid="active-rules-extensions-page">
      <PageHeader
        title="规则与扩展"
        description="这里只显示当前设备和当前房间已经实际激活的规则。市场商品、未启用版本和工坊草稿不会出现在运行清单中。"
        actions={(
          <div className="flex flex-wrap gap-2">
            {roomSession?.role !== 'player' && (
              <Link
                to={`${campaignBasePath}/dm-tools/workshop`}
                className="inline-flex items-center gap-2 rounded-xl bg-arcane-500/15 px-4 py-2.5 text-sm font-semibold text-arcane-100"
              >
                <Wrench className="h-4 w-4" />打开自定义工坊
              </Link>
            )}
            <Link
              to="/app/extensions"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300"
            >
              <Store className="h-4 w-4" />前往扩展市场
            </Link>
          </div>
        )}
      />

      <section className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-emerald-100">D&D 5e 2014 · SRD 5.1 核心规则</h2>
              <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">已激活</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-100/65">
              核心角色、检定、战斗、法术和 Headless 权威结算底座。自定义扩展只在此核心规则之上增加命名空间内容。
            </p>
          </div>
        </div>
      </section>
      {message && <p role="status" className="mb-4 text-sm text-amber-200">{message}</p>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          当前激活扩展 <strong className="text-slate-100">{records.length}</strong> 个
          {pendingRoomCount > 0 && <span className="ml-2 text-amber-300">· 另有 {pendingRoomCount} 个房间扩展正在同步</span>}
        </p>
        <button
          type="button"
          onClick={() => setRevision((value) => value + 1)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300"
        >
          <RefreshCw className="h-4 w-4" />刷新运行清单
        </button>
      </div>

      {records.length === 0 ? (
        <section className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 px-6 text-center">
          <PackageCheck className="h-10 w-10 text-slate-600" />
          <h2 className="mt-4 font-semibold text-slate-200">当前没有额外激活的扩展</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            当前只运行 SRD 5.1 核心规则。DM 从工坊保存并启用内容后，它会自动出现在这里。
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {records.map(({ manifest, installed }) => {
            const inspected = details[manifest.id]
            const summary = inspected?.summary
            const coverage = inspected?.coverage
            const contentGroups = contentGroupsByOwner.get(manifest.id) ?? []
            const contentCount = contentGroups.reduce((total, group) => total + group.names.length, 0)
            const counts = summary ? [
              ['种族', summary.races], ['背景', summary.backgrounds], ['特性', summary.features],
              ['专长', summary.feats], ['法术', summary.spells], ['物品', summary.items],
              ['职业', summary.classes], ['子职', summary.subclasses], ['怪物', summary.monsters],
            ].filter(([, count]) => Number(count) > 0) : []
            return (
              <article key={manifest.id} className="rounded-2xl border border-white/8 bg-black/15 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-100">{manifest.name}</h2>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />已激活 · v{manifest.version}
                      </span>
                      {manifest.distributionPolicy === 'room-ephemeral' && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">关闭房间即失效</span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-600">{manifest.id}</p>
                    {manifest.description && <p className="mt-3 text-sm leading-6 text-slate-400">{manifest.description}</p>}
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{manifest.publisher}</p>
                    <p className="mt-1">{manifest.license}</p>
                    {(!roomSession || roomSession.role === 'dm') && (
                      <button type="button" disabled={removing !== null}
                        onClick={() => void removeExtension(manifest.id, manifest.name)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/20 px-3 py-2 text-rose-200 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" />{removing === manifest.id ? '正在卸载…' : '卸载'}
                      </button>
                    )}
                  </div>
                </div>

                {counts.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {counts.map(([label, count]) => (
                      <span key={String(label)} className="rounded-lg border border-white/8 bg-white/[0.025] px-2.5 py-1.5 text-xs text-slate-400">
                        {label} <strong className="text-slate-200">{count}</strong>
                      </span>
                    ))}
                  </div>
                )}
                {coverage && (
                  <p className="mt-3 text-xs leading-5 text-sky-200/65">
                    自动化：完整 {coverage.totals.full} · 部分 {coverage.totals.partial} ·
                    手动 {coverage.totals.manual} · 仅资料 {coverage.totals.referenceOnly}
                  </p>
                )}
                {contentCount > 0 && (
                  <details
                    open={contentCount <= 20}
                    className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.035] px-4 py-3"
                    data-testid={`active-extension-content-${manifest.id}`}
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-cyan-100 marker:text-cyan-400">
                      本房间已激活规则内容 · {contentCount} 项
                    </summary>
                    <div className="mt-3 space-y-3">
                      {contentGroups.map((group) => (
                        <div key={group.label} className="grid gap-2 sm:grid-cols-[4rem_minmax(0,1fr)]">
                          <span className="text-xs font-semibold text-cyan-200/75">{group.label}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {group.names.map((name) => (
                              <span
                                key={name}
                                className="rounded-md border border-white/8 bg-black/15 px-2 py-1 text-xs text-slate-300"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <p className="mt-3 break-all font-mono text-[10px] text-slate-700">
                  {installed.integrity}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
