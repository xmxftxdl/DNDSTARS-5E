import { useCallback, useEffect, useRef, useState } from 'react'
import { Archive, Download, History, LoaderCircle, RotateCcw, ShieldCheck, Upload } from 'lucide-react'
import Card from './Card'
import {
  campaignBackupErrorMessage,
  createCampaignSnapshot,
  downloadCampaignExport,
  importCampaignBundle,
  listCampaignSnapshots,
  preflightCampaignFile,
  restoreCampaignSnapshot,
  type CampaignPreflight,
  type CampaignSnapshotSummary,
} from '../lib/campaignBackupApi'

function snapshotKindLabel(kind: string): string {
  if (kind === 'auto') return '自动快照'
  if (kind === 'pre-restore') return '还原前保护点'
  return '手动快照'
}

function formatTime(value: number): string {
  return Number.isFinite(value) && value > 0 ? new Date(value).toLocaleString('zh-CN') : '未知时间'
}

export default function CampaignSafetyPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [snapshots, setSnapshots] = useState<CampaignSnapshotSummary[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<{ bundle: unknown; preflight: CampaignPreflight } | null>(null)

  const refresh = useCallback(async () => {
    try {
      setSnapshots(await listCampaignSnapshots())
    } catch (error) {
      setNotice(campaignBackupErrorMessage(error))
    }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(initial)
  }, [refresh])

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key)
    setNotice(null)
    try {
      await action()
      setNotice(success)
      await refresh()
    } catch (error) {
      setNotice(campaignBackupErrorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="rounded-xl bg-emerald-500/15 p-3 text-emerald-300"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <h3 className="font-semibold text-slate-100">战役安全与恢复</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              服务会在共享状态改动前自动建立轮转快照（最多 10 个、两分钟节流）。完整导出包含角色、地图、战斗状态、地图图片及房间规则包。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run('snapshot', async () => { await createCampaignSnapshot() }, '已创建手动快照。')}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === 'snapshot' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            立即创建快照
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run('export', downloadCampaignExport, '完整战役包已生成。')}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === 'export' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            导出完整战役
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-arcane-500 px-3 py-2 text-sm font-semibold text-white hover:bg-arcane-400 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            导入并预检
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.dndstars5e-campaign.json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.currentTarget.value = ''
              if (!file) return
              setBusy('preflight')
              void preflightCampaignFile(file)
                .then(setPendingImport)
                .catch((error) => setNotice(campaignBackupErrorMessage(error)))
                .finally(() => setBusy(null))
            }}
          />
        </div>
      </div>

      {notice && <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">{notice}</div>}

      {pendingImport && (
        <div className={`mt-4 rounded-xl border p-4 ${pendingImport.preflight.ok ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-rose-500/30 bg-rose-950/20'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-100">预检：{pendingImport.preflight.roomName}</p>
              <p className="mt-1 text-xs text-slate-400">
                {pendingImport.preflight.stateCount} 个状态 · {pendingImport.preflight.imageCount} 张图片 · {pendingImport.preflight.pluginCount} 个规则包 · {formatTime(pendingImport.preflight.exportedAt)}
              </p>
              {pendingImport.preflight.errors.map((error) => <p key={error} className="mt-1 text-xs text-rose-300">错误：{error}</p>)}
              {pendingImport.preflight.warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-300">提示：{warning}</p>)}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPendingImport(null)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300">取消</button>
              <button
                type="button"
                disabled={!pendingImport.preflight.ok || busy !== null}
                onClick={() => {
                  if (!window.confirm('还原会覆盖当前房间的同名状态；系统会先自动建立保护快照。确定继续吗？')) return
                  void run('import', async () => {
                    await importCampaignBundle(pendingImport.bundle)
                    setPendingImport(null)
                    window.location.reload()
                  }, '战役已还原。')
                }}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                还原到当前房间
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <History className="h-4 w-4" /> 最近恢复点
        </div>
        {snapshots.length === 0 ? (
          <p className="text-sm text-slate-500">暂无快照；首次共享状态改动或手动创建后会出现在这里。</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {snapshots.slice(0, 6).map((snapshot) => (
              <div key={snapshot.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-200">{snapshotKindLabel(snapshot.kind)}</p>
                  <p className="text-[11px] text-slate-500">{formatTime(snapshot.createdAt)} · {snapshot.stateCount} 个状态</p>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm('确定还原这个快照吗？当前状态会先建立保护点。')) return
                    void run(snapshot.id, async () => {
                      await restoreCampaignSnapshot(snapshot.id)
                      window.location.reload()
                    }, '快照已还原。')
                  }}
                  className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  还原
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
