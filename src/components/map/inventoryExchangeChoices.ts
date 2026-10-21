import type { Character } from '../../types/character'
import { dnd5eEnchantedInventoryInstanceIds } from '../../rulesets/dnd5e/activeEffects'
import { showAppActionChoice, showAppMultiChoice, showAppDirectionStepper, showAppAlert } from '../../lib/appDialog'
import { normalizeDnd5eInventory, dnd5eInventoryItemTemplate, listDnd5eInventoryItemTemplates } from '../../rulesets/dnd5e/items'
import type { Dnd5eInventoryExchangeTemplateSource } from '../../rulesets/dnd5e/inventoryExchange'
import { dnd5eActivityExchangeOutputAllowed } from '../../rulesets/dnd5e/activities/dnd5eActivityInventorySelection'
import type { Dnd5eInventoryExchangePolicy } from '../../rulesets/dnd5e/inventoryExchange'
import { applyDnd5eInventoryExchange, dnd5eInventoryExchangeItemValueCp } from '../../rulesets/dnd5e/inventoryExchange'
import type { Dnd5eInventoryExchangeSelection } from '../../rulesets/dnd5e/inventoryExchangeSelection'
import { dnd5eInventoryExchangeSavedSelection } from '../../rulesets/dnd5e/inventoryExchangeRitualState'

export interface InventoryExchangeChoiceDialogs {
  choose: typeof showAppActionChoice
  multiple: typeof showAppMultiChoice
  quantity: typeof showAppDirectionStepper
  alert: typeof showAppAlert
}
const dialogs: InventoryExchangeChoiceDialogs = {
  choose: showAppActionChoice, multiple: showAppMultiChoice, quantity: showAppDirectionStepper, alert: showAppAlert,
}

export async function requestInventoryExchangeRitual(input: Parameters<typeof requestInventoryExchangeMaterials>[0] & {
  packageId: string
  activityId: string
  worldMinute: number
  sceneRangeFeet?: number
  choosePlacement: (rangeFeet: number) => Promise<{ col: number; row: number } | undefined>
}): Promise<{ decision: 'begin' | 'cancel' | 'complete'; ritualId?: string; selection: Dnd5eInventoryExchangeSelection } | undefined> {
  const ui = input.dialogs ?? dialogs
  const pending = normalizeDnd5eInventory(input.character).pendingExchangeRitual
  if (!pending) {
    const selection = await requestInventoryExchangeMaterials(input)
    return selection ? { decision: 'begin', selection } : undefined
  }
  if (pending.packageId !== input.packageId || pending.activityId !== input.activityId) {
    await ui.alert('当前已有另一项制作仪式，请先完成或取消。'); return
  }
  const selection = dnd5eInventoryExchangeSavedSelection(pending)
  if (!selection) { await ui.alert('保存的制作选择不完整，无法继续，请由 DM 检查该仪式记录。'); return }
  const remaining = Math.max(0, pending.completesWorldMinute - input.worldMinute)
  const choice = await ui.choose({ title: '制作仪式', message: remaining > 0 ? `还需要 ${remaining} 分钟战役时间。` : '仪式时间已到，可以完成制作。',
    options: [...(remaining === 0 ? [{ id: 'complete', label: '完成制作', description: '核对材料并生成物品' }] : []),
      { id: 'cancel', label: '取消仪式', description: '保留尚未消耗的材料' }], searchable: false })
  if (choice !== 'cancel' && (choice !== 'complete' || remaining > 0)) return
  if (choice === 'complete' && input.sceneRangeFeet != null) {
    const targetCell = await input.choosePlacement(input.sceneRangeFeet)
    if (!targetCell) return
    selection.targetCell = targetCell
  }
  return { decision: choice, ritualId: pending.commandId, selection }
}

/** Selection only. The Host validates exact values and eligibility at begin/completion. */
export async function requestInventoryExchangeMaterials(input: {
  character: Character
  templateId: string
  templateOptions?: readonly string[]
  templateSource?: Dnd5eInventoryExchangeTemplateSource
  outputQuantity: number
  policy: Dnd5eInventoryExchangePolicy
  dialogs?: InventoryExchangeChoiceDialogs
}): Promise<Dnd5eInventoryExchangeSelection | undefined> {
  const ui = input.dialogs ?? dialogs
  const inventory = normalizeDnd5eInventory(input.character)
  const outputIds = input.templateSource
    ? listDnd5eInventoryItemTemplates().filter(item => dnd5eActivityExchangeOutputAllowed(item.id, input.templateSource!, input.policy)).map(item => item.id)
    : input.templateOptions
  if (outputIds) {
    const options = outputIds.flatMap(id => {
      const item=dnd5eInventoryItemTemplate(id),value=item&&dnd5eInventoryExchangeItemValueCp(item)
      if(!item || item.magicItem || item.headlessEffects?.length || value==null ||
        !input.policy.outputTags.every(tag=>item.spellcastingMaterial?.tags.includes(tag)))return []
      const total=value*input.outputQuantity
      if(input.policy.maximumInclusive?total>input.policy.maximumValueCp:total>=input.policy.maximumValueCp)return []
      return [{id,label:item.name,description:`总价值 ${total/100} 金币`}]
    })
    if(!options.length){await ui.alert('没有已安装且符合制作条件的产物。');return}
    const selected=await ui.choose({title:'选择制作产物',message:'选择产物后，再选择等值材料与货币。',options,searchable:options.length>8})
    if(!selected || !options.some(option=>option.id===selected))return
    const selection=await requestInventoryExchangeMaterials({...input,templateId:selected,templateOptions:undefined,templateSource:undefined})
    return selection?{...selection,outputTemplateId:selected}:undefined
  }
  const enchanted = new Set(dnd5eEnchantedInventoryInstanceIds(input.character.dnd5eCombatState?.activeEffects))
  const output = dnd5eInventoryItemTemplate(input.templateId)
  if (!output) { await ui.alert('制作物品的资料尚未安装。'); return }
  const unitValue = dnd5eInventoryExchangeItemValueCp(output)
  if (unitValue == null || !Number.isSafeInteger(input.outputQuantity) || input.outputQuantity < 1 || input.outputQuantity > 1000) {
    await ui.alert('缺少有效的物品价值或制作数量，无法核对材料。'); return
  }
  const requiredCp = unitValue * input.outputQuantity
  let originalInstanceId: string | undefined
  if (input.policy.requiresOriginal) {
    const originals = inventory.entries.filter(entry => entry.templateId === input.templateId && entry.quantity > 0 && !entry.condition?.destroyed && entry.planarState !== 'ethereal' &&
      !enchanted.has(entry.instanceId) && !entry.spellAlteration && !entry.sourceEffectTag && entry.expiresAtWorldMinute == null)
    if (!originals.length) { await ui.alert(`制作${output.name}需要持有原件。`); return }
    const original = await ui.choose({ title: '选择复制原件', message: '原件不会被消耗，仪式期间需要持续持有。',
      options: originals.map(entry => ({ id: entry.instanceId, label: entry.item.name, description: `数量 ${entry.quantity}` })), searchable: originals.length > 8 })
    if (original == null || !originals.some(entry => entry.instanceId === original)) return
    originalInstanceId = original
  }
  const candidates = inventory.entries.filter(entry => {
    const template = dnd5eInventoryItemTemplate(entry.templateId)
    return entry.instanceId !== originalInstanceId && entry.quantity > 0 && !entry.condition?.destroyed && entry.planarState !== 'ethereal' &&
      !entry.equippedSlot && !entry.spellAlteration && !entry.sourceEffectTag && entry.expiresAtWorldMinute == null &&
      !enchanted.has(entry.instanceId) && !inventory.entries.some(child => child.containerInstanceId === entry.instanceId) &&
      template && !template.magicItem && !template.headlessEffects?.length && input.policy.inputTags.every(tag => template.spellcastingMaterial?.tags.includes(tag))
  })
  const currencies = [ ['cp', '铜币'], ['sp', '银币'], ['ep', '金银币'], ['gp', '金币'], ['pp', '铂金币'] ] as const
  const options = [...candidates.map(entry => ({ id: `item:${entry.instanceId}`, label: entry.item.name,
    description: `可用 ${entry.quantity}，每件 ${(dnd5eInventoryExchangeItemValueCp(dnd5eInventoryItemTemplate(entry.templateId)!) ?? 0) / 100} 金币` })),
    ...currencies.filter(([key]) => (inventory.currency?.[key] ?? 0) > 0).map(([key, label]) => ({ id: `coin:${key}`, label, description: `可用 ${inventory.currency?.[key] ?? 0}` }))]
  if (!options.length) { await ui.alert('没有符合要求的材料或货币。'); return }
  const selected = await ui.multiple({ title: `制作${output.name} × ${input.outputQuantity}：选择材料`, message: `需要投入总价值 ${requiredCp / 100} 金币的材料和货币。选择后分别设置数量，仪式完成时才会扣除。`, options })
  if (!selected?.length || new Set(selected).size !== selected.length || selected.some(id => !options.some(option => option.id === id))) return
  const inputs: { instanceId: string; quantity: number }[] = []
  const coins: { currency: 'cp' | 'sp' | 'ep' | 'gp' | 'pp'; amount: number }[] = []
  for (const id of selected) {
    const entry = id.startsWith('item:') ? candidates.find(candidate => `item:${candidate.instanceId}` === id) : undefined
    const currency = currencies.find(([key]) => `coin:${key}` === id)
    const maximum = entry?.quantity ?? (currency ? inventory.currency?.[currency[0]] ?? 0 : 0)
    const label = entry?.item.name ?? currency?.[1] ?? ''
    const answer = maximum === 1 ? { value: 1 } : await ui.quantity({ title: `消耗${label}`, message: `可用 ${maximum}，选择本次投入数量。`,
      minValue: 1, maxValue: maximum, step: 1, defaultValue: 1, unit: entry ? '件' : '枚', upLabel: '数量', downLabel: '数量' })
    if (!answer || !Number.isSafeInteger(answer.value) || answer.value < 1 || answer.value > maximum) return
    if (entry) inputs.push({ instanceId: entry.instanceId, quantity: answer.value })
    else if (currency) coins.push({ currency: currency[0], amount: answer.value })
  }
  const selection = { expectedInventoryRevision: inventory.revision ?? 0, inputs, coins, ...(originalInstanceId ? { originalInstanceId } : {}) }
  const preview = applyDnd5eInventoryExchange([input.character], { ...selection, characterId: input.character.id,
    receiptId: `ui-preview:${crypto.randomUUID()}`, output: { templateId: input.templateId, quantity: input.outputQuantity } }, input.policy)
  if (!preview.ok) { await ui.alert(`材料不符合制作要求。总价值必须恰好为 ${requiredCp / 100} 金币，原件不能作为耗材。请重新选择。`); return }
  return selection
}

