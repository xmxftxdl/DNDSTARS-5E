export type Dnd5eBuilderAutomationStatus = 'full' | 'partial' | 'manual' | 'reference-only'

export interface Dnd5eBuilderAutomationCounts {
  full: number
  partial: number
  manual: number
  referenceOnly: number
}

export interface Dnd5eBuilderResourceInventoryEntry {
  id: string
  name: string
  summary?: string
  automation: Dnd5eBuilderAutomationCounts
  reasons?: readonly string[]
}

export interface Dnd5eBuilderResourceInventorySummary extends Dnd5eBuilderAutomationCounts {
  resources: number
  automationUnits: number
  fullResources: number
  partialResources: number
  manualResources: number
  referenceOnlyResources: number
}

export function dnd5eBuilderAutomationStatus(
  counts: Dnd5eBuilderAutomationCounts,
): Dnd5eBuilderAutomationStatus {
  const total = counts.full + counts.partial + counts.manual + counts.referenceOnly
  if (total === 0 || counts.referenceOnly === total) return 'reference-only'
  if (counts.full === total) return 'full'
  if (counts.manual === total) return 'manual'
  return 'partial'
}

export function summarizeDnd5eBuilderResourceInventory(
  entries: readonly Dnd5eBuilderResourceInventoryEntry[],
): Dnd5eBuilderResourceInventorySummary {
  const summary: Dnd5eBuilderResourceInventorySummary = {
    resources: entries.length,
    automationUnits: 0,
    full: 0,
    partial: 0,
    manual: 0,
    referenceOnly: 0,
    fullResources: 0,
    partialResources: 0,
    manualResources: 0,
    referenceOnlyResources: 0,
  }
  for (const entry of entries) {
    summary.full += entry.automation.full
    summary.partial += entry.automation.partial
    summary.manual += entry.automation.manual
    summary.referenceOnly += entry.automation.referenceOnly
    const status = dnd5eBuilderAutomationStatus(entry.automation)
    if (status === 'full') summary.fullResources += 1
    else if (status === 'partial') summary.partialResources += 1
    else if (status === 'manual') summary.manualResources += 1
    else summary.referenceOnlyResources += 1
  }
  summary.automationUnits = summary.full + summary.partial + summary.manual + summary.referenceOnly
  return summary
}
