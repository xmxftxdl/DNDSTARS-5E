export interface PostSpellRandomTableAdjudicationPresentation {
  featureLabel: string
  resultLabel: string
  logMessage: string
}

export function buildPostSpellRandomTableAdjudicationPresentation(input: {
  actorName: string
  featureName?: string
  tableRoll: number
}): PostSpellRandomTableAdjudicationPresentation {
  const featureLabel = input.featureName?.trim() || '施法后随机表'
  return {
    featureLabel,
    resultLabel: `${featureLabel} · 结果 ${input.tableRoll}`,
    logMessage: `${input.actorName} 的${featureLabel}掷出 ${input.tableRoll}；当前结果未接入 Headless，战斗结算已暂停，等待 DM 裁定。`,
  }
}
