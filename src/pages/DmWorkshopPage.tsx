import { useState } from 'react'
import { AlertTriangle, CheckCircle2, PackageCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Dnd5eLocalRulesAiImporter from '../components/dm/Dnd5eLocalRulesAiImporter'
import Dnd5eCustomPluginBuilder from '../components/rules/Dnd5eCustomPluginBuilder'
import { activateRoomPluginPackage } from '../lib/roomPluginActivation'
import { getRoomSession } from '../lib/roomSession'
import { setRoomRulesSnapshot } from '../lib/roomRulesState'
import {
  dnd5eRoomRuntimeProjectionBytesV2,
  type Dnd5eContentAutomationCoverageReportV2,
} from '../rulesets/dnd5e'

export default function DmWorkshopPage() {
  const { campaignId = 'local' } = useParams()
  const [roomSession] = useState(() => getRoomSession())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<Dnd5eContentAutomationCoverageReportV2 | null>(null)
  const host = window.DNDSTARS_5E_RULES_PLUGINS
  const activeRulesPath = `/campaign/${encodeURIComponent(campaignId)}/extensions`

  const saveAndActivate = async (file: File) => {
    if (!host || busy) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      let inspected = await host.inspectFile(file)
      setCoverage(inspected.automationCoverage ?? null)
      const summary = inspected.contentSummary
      if (summary) {
        const accepted = window.confirm([
          `保存工坊扩展：${inspected.manifest.name} v${inspected.manifest.version}`,
          `内容：种族 ${summary.races}、背景 ${summary.backgrounds}、特性 ${summary.features}、专长 ${summary.feats}、法术 ${summary.spells}、物品 ${summary.items}、子职 ${summary.subclasses}、怪物 ${summary.monsters}`,
          '保存后会立即启用，并出现在“规则与扩展”的当前激活清单。',
        ].join('\n'))
        if (!accepted) return
      }

      if (roomSession?.role === 'dm') {
        const policy = inspected.manifest.distributionPolicy
        if (policy !== 'room-distributable' && policy !== 'room-ephemeral') {
          throw new Error('联网房间中的工坊扩展必须声明 room-distributable 或 room-ephemeral。')
        }
        if (policy === 'room-ephemeral') {
          const projected = dnd5eRoomRuntimeProjectionBytesV2(inspected.bytes)
          inspected = await host.inspectFile(new File(
            [new Uint8Array(projected)],
            inspected.fileName,
            { type: 'application/json' },
          ))
        }
        const next = await activateRoomPluginPackage({
          session: roomSession,
          host,
          package: inspected,
        })
        if (policy === 'room-ephemeral') {
          await host.installEphemeralBytes({
            id: inspected.manifest.id,
            version: inspected.manifest.version,
            fileName: inspected.fileName,
            integrity: inspected.integrity,
            bytes: inspected.bytes,
          })
        } else {
          await host.installBytes({
            id: inspected.manifest.id,
            version: inspected.manifest.version,
            fileName: inspected.fileName,
            integrity: inspected.integrity,
            bytes: inspected.bytes,
          })
        }
        setRoomRulesSnapshot(next)
        setNotice(`已保存并启用 ${inspected.manifest.name}；当前房间成员会按精确版本同步。`)
        return
      }

      if (inspected.manifest.distributionPolicy === 'room-ephemeral') {
        await host.installEphemeralBytes({
          id: inspected.manifest.id,
          version: inspected.manifest.version,
          fileName: inspected.fileName,
          integrity: inspected.integrity,
          bytes: inspected.bytes,
        })
        setNotice(`已在当前本地会话临时启用 ${inspected.manifest.name}；重新打开后需再次导入。`)
        return
      }
      await host.installBytes({
        id: inspected.manifest.id,
        version: inspected.manifest.version,
        fileName: inspected.fileName,
        integrity: inspected.integrity,
        bytes: inspected.bytes,
      })
      setNotice(`已在当前设备保存并启用 ${inspected.manifest.name}。`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl" data-testid="dm-custom-workshop-page">
      <PageHeader
        title="自定义工坊"
        description="可粘贴规则交给本地或自选 AI 转换，也可使用结构化编辑器创建内容；仅在 Host 校验和 DM 确认后启用。"
        actions={(
          <Link
            to={activeRulesPath}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200"
          >
            <PackageCheck className="h-4 w-4" />查看当前激活内容
          </Link>
        )}
      />

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}
        </div>
      )}
      {coverage && (
        <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-500/[0.05] px-4 py-3 text-xs leading-5 text-sky-100/75">
          自动化覆盖：完整 {coverage.totals.full} · 部分 {coverage.totals.partial} ·
          手动 {coverage.totals.manual} · 仅资料 {coverage.totals.referenceOnly}
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <Dnd5eLocalRulesAiImporter busy={busy} onInstall={saveAndActivate} />

      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-100">结构化内容编辑器</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">适合逐条创建、校对和维护怪物、法术、特性及其他规则资源。</p>
      </div>
      <Dnd5eCustomPluginBuilder
        defaultPublisher={roomSession?.displayName}
        busy={busy}
        onInstall={saveAndActivate}
        installLabel={roomSession?.role === 'dm'
          ? '保存并启用到当前房间'
          : '保存并在当前设备启用'}
        alwaysExpanded
      />
    </div>
  )
}
