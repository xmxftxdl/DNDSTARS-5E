import type { Dnd5eInventoryItemTemplate } from '../../types/inventory'

export interface CustomItemMaterialDraft {
  materialContainsMetal: boolean
  materialValueCp: number
}
type MaterialFields = Pick<Dnd5eInventoryItemTemplate, 'cost' | 'spellcastingMaterial'>
const copper = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }

export function readCustomItemMaterial(item: MaterialFields): CustomItemMaterialDraft {
  const value = item.spellcastingMaterial?.unitValueGp != null ? item.spellcastingMaterial.unitValueGp * 100
    : item.cost ? item.cost.amount * copper[item.cost.currency] : 0
  const rounded = Math.round(value)
  return { materialContainsMetal: item.spellcastingMaterial?.tags.includes('material:contains-metal') === true,
    materialValueCp: Number.isSafeInteger(rounded) && rounded > 0 && Math.abs(value - rounded) < 1e-8 ? rounded : 0 }
}

export function writeCustomItemMaterial(draft: CustomItemMaterialDraft, source?: MaterialFields): MaterialFields {
  const tags = (source?.spellcastingMaterial?.tags ?? []).filter(tag => tag !== 'material:contains-metal')
  if (draft.materialContainsMetal) tags.push('material:contains-metal')
  const value = Number.isSafeInteger(draft.materialValueCp) && draft.materialValueCp > 0 ? draft.materialValueCp : undefined
  return {
    cost: value != null ? { amount: value, currency: 'cp' } : undefined,
    spellcastingMaterial: tags.length ? { tags, ...(value != null ? { unitValueGp: value / 100 } : {}) } : undefined,
  }
}
