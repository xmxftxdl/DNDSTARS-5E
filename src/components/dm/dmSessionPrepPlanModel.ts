import type {
  AccountCampaignPrepPlanDraftV1,
  AccountCampaignPrepPlanV1,
} from '../../lib/accountApi'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import { createStoryWorkspace } from './dmCampaignStoryModel'

const DEFAULT_CHECKLIST = [
  '确认开场与本场目标',
  '准备关键 NPC 的动机与声线',
  '核对线索的发现方式与失败前进',
  '检查地图、灯光与预设遭遇',
]

export function createDefaultCampaignPrepPlan(analysis: PdfCampaignAnalysisV2 | null): AccountCampaignPrepPlanDraftV1 {
  const storyWorkspace = createStoryWorkspace(analysis)
  const selectedStoryEventIds = storyWorkspace.events
    .filter((event) => event.status === 'planned' || event.status === 'active')
    .slice(0, 3)
    .map((event) => event.id)
  return {
    schemaVersion: 1,
    sessionTitle: '下一次团务',
    objective: analysis?.overview?.trim().slice(0, 1200) ?? '',
    selectedStoryEventIds,
    selectedSceneIds: [...new Set(storyWorkspace.events
      .filter((event) => selectedStoryEventIds.includes(event.id))
      .flatMap((event) => event.sceneIds))],
    selectedPersonIds: analysis?.people.slice(0, 4).map((entry) => entry.id) ?? [],
    selectedClueIds: analysis?.clues.slice(0, 4).map((entry) => entry.id) ?? [],
    checklist: DEFAULT_CHECKLIST.map((text, index) => ({ id: `default-${index + 1}`, text, completed: false })),
    privateNotes: '',
    storyWorkspace,
  }
}

export function campaignPrepPlanDraft(plan: AccountCampaignPrepPlanV1): AccountCampaignPrepPlanDraftV1 {
  const storyWorkspace = plan.storyWorkspace ? structuredClone(plan.storyWorkspace) : undefined
  const selectedStoryEventIds = Array.isArray(plan.selectedStoryEventIds)
    ? [...plan.selectedStoryEventIds]
    : storyWorkspace?.events
      .filter((event) => event.sceneIds.some((sceneId) => plan.selectedSceneIds.includes(sceneId)))
      .map((event) => event.id) ?? []
  return {
    schemaVersion: 1,
    sessionTitle: plan.sessionTitle,
    objective: plan.objective,
    selectedStoryEventIds,
    selectedSceneIds: [...plan.selectedSceneIds],
    selectedPersonIds: [...plan.selectedPersonIds],
    selectedClueIds: [...plan.selectedClueIds],
    checklist: plan.checklist.map((item) => ({ ...item })),
    privateNotes: plan.privateNotes,
    storyWorkspace,
  }
}
