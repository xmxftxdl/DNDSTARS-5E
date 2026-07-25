import { useEffect, useState } from 'react'
import { Download, Globe2, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { accountApiErrorMessage } from '../lib/accountApi'
import {
  downloadPublicPlugin,
  loadPluginPublisher,
  type PluginCatalogEntry,
  type PluginCatalogPublisher,
} from '../lib/pluginCatalogApi'

function downloadBytes(bytes: ArrayBuffer, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function PluginPublisherPage() {
  const { publisherId = '' } = useParams()
  const [publisher, setPublisher] = useState<PluginCatalogPublisher | null>(null)
  const [plugins, setPlugins] = useState<PluginCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void loadPluginPublisher(publisherId).then((result) => {
      if (!active) return
      setPublisher(result.publisher)
      setPlugins(result.plugins)
      setError(null)
    }).catch((cause) => {
      if (active) setError(accountApiErrorMessage(cause))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [publisherId])

  const download = async (plugin: PluginCatalogEntry) => {
    const version = plugin.versions[0]
    if (!version) return
    setBusy(plugin.id)
    try {
      const result = await downloadPublicPlugin(plugin.id, version)
      downloadBytes(result.bytes, result.fileName)
      setError(null)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={publisher?.displayName ?? '插件发布者'}
        description="查看该发布者已经通过审核的 DNDSTARS 规则包。"
        actions={<Link to="/plugins" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">返回插件中心</Link>}
      />
      {error && <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">{error}</div>}
      {loading ? (
        <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin" />正在读取发布者页面…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plugins.map((plugin) => {
            const latest = plugin.versions[0]
            if (!latest) return null
            return (
              <article key={plugin.id} className="rounded-2xl border border-white/8 bg-black/15 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-slate-100">{plugin.name}</h2>
                  <Globe2 className="h-4 w-4 text-emerald-300" />
                </div>
                <p className="mt-1 font-mono text-xs text-slate-600">{plugin.id} · v{latest.version}</p>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-400">{plugin.description}</p>
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void download(plugin)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-arcane-500/15 px-3 py-2 text-sm font-semibold text-arcane-100 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />{busy === plugin.id ? '正在下载…' : '下载'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
