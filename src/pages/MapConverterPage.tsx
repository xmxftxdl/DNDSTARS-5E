import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fixedBridgeModelIdForTask } from '../../shared/ai-model-policy.mjs'
import type { AiProviderSelectionV1 } from '../../shared/ai-provider.mjs'
import PageHeader from '../components/PageHeader'
import AiProviderSelector from '../components/dm/AiProviderSelector'
import DmMapAnalysisPanel from '../components/dm/DmMapAnalysisPanel'
import { DEFAULT_AI_PROVIDER_SELECTION } from '../lib/aiProvider'

export default function MapConverterPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const mapsPath = `/campaign/${encodeURIComponent(campaignId)}/maps`
  const [selection, setSelection] = useState<AiProviderSelectionV1>(() => ({
    ...DEFAULT_AI_PROVIDER_SELECTION,
    modelId: fixedBridgeModelIdForTask('map-analysis'),
  }))

  return (
    <div className="mx-auto w-full max-w-[1800px]">
      <PageHeader title="AI 地图转换"
        description="上传地图图片，自动识别墙体，审核后导出带墙体的 UVTT 地图。"
        actions={<Link to={mapsPath} className="rounded-xl bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20">返回战斗地图</Link>} />
      <p className="mb-5 rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-4 text-sm leading-6 text-slate-400">
        选择图片即可自动识别墙线，也可使用 AI 增强识别。删除错误墙线后导出 UVTT，再到战斗地图选择“地图 / UVTT”导入，底图、网格和墙体会一起加入。
      </p>
      <div className="mb-5">
        <AiProviderSelector value={selection} onChange={setSelection} taskProfile="map-analysis" />
      </div>
      <DmMapAnalysisPanel aiProviderSelection={selection} />
    </div>
  )
}
