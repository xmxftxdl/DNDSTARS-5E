import { useEffect, useState, useSyncExternalStore } from 'react'
import { CheckCircle2, PackageCheck, RefreshCw, ShieldCheck, Store, Wrench } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { getRoomSession } from '../lib/roomSession'
import {
  getRoomRulesSnapshot,
  subscribeRoomRules,
} from '../lib/roomRulesState'
import type {
  Dnd5eContentAutomationCoverageReportV2,
  Dnd5eContentPackageSummaryV2,
} from '../rulesets/dnd5e'
import { activeRulesExtensionRecords } from './activeRulesExtensionsModel'

interface ActiveExtensionDetails {
  summary?: Dnd5eContentPackageSummaryV2
  coverage?: Dnd5eContentAutomationCoverageReportV2
}

export default function ActiveRulesExtensionsPage() {
  const { campaignId = 'local' } = useParams()
  const [roomSession] = useState(() => getRoomSession())
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const [revision, setRevision] = useState(0)
  const [details, setDetails] = useState<Record<string, ActiveExtensionDetails>>({})
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

  useEffect(() => {
    if (!host || records.length === 0) return
    let disposed = false
    void Promise.all(records.map(async ({ manifest, installed }) => {
      try {
        const bytes = await host.readBytes(manifest.id)
        const inspected = await host.inspectFile(new File(
          [new Uint8Array(bytes)],
          installed.source === 'url' ? `${manifest.id}.dndstars5e` : installed.fileName,
          { type: 'application/json' },
        ))
        return [manifest.id, {
          summary: inspected.contentSummary,
          coverage: inspected.automationCoverage,
        }] as const
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
    <div className="mx-auto max-w-6xl" data-testid="active-rules-extensions-page">
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
            const counts = summary ? [
              ['种族', summary.races], ['背景', summary.backgrounds], ['特性', summary.features],
              ['专长', summary.feats], ['法术', summary.spells], ['物品', summary.items],
              ['子职', summary.subclasses], ['怪物', summary.monsters],
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
