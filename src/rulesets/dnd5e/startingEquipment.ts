import type { CharacterEquipment, EquipmentItem, EquipmentSlot } from '../../types/equipment'
import type { Dnd5eInventory, Dnd5eInventoryEntry } from '../../types/inventory'
import { DND5E_SRD_EQUIPMENT_CATALOG } from './equipment'
import { dnd5eInventoryItemTemplate } from './items'

export interface Dnd5eStartingEquipmentGrant {
  templateId: string
  quantity: number
  equipSlot?: EquipmentSlot
}

export interface Dnd5eStartingEquipmentPicker {
  id: string
  label: string
  equipmentIds: readonly string[]
  defaultEquipmentId: string
  equipSlot?: EquipmentSlot
}

export interface Dnd5eStartingEquipmentOption {
  id: string
  label: string
  description?: string
  grants: readonly Dnd5eStartingEquipmentGrant[]
  pickers?: readonly Dnd5eStartingEquipmentPicker[]
}

export interface Dnd5eStartingEquipmentChoiceGroup {
  id: string
  label: string
  source: 'class' | 'background'
  options: readonly Dnd5eStartingEquipmentOption[]
}

export interface Dnd5eStartingEquipmentPlan {
  charClass: string
  background: string
  fixedGrants: readonly Dnd5eStartingEquipmentGrant[]
  groups: readonly Dnd5eStartingEquipmentChoiceGroup[]
}

export interface Dnd5eStartingEquipmentSelection {
  optionIds: Record<string, string>
  equipmentIds: Record<string, string>
}

export interface ResolvedDnd5eStartingEquipment {
  grants: Dnd5eStartingEquipmentGrant[]
  equipment?: CharacterEquipment
  inventory: Dnd5eInventory
}

const eq = (equipmentId: string) => `srd-5.1:equipment:${equipmentId}`
const item = (itemId: string) => `srd-5.1:item:${itemId}`
const grant = (templateId: string, quantity = 1, equipSlot?: EquipmentSlot): Dnd5eStartingEquipmentGrant => ({
  templateId,
  quantity,
  ...(equipSlot ? { equipSlot } : {}),
})

const SIMPLE_WEAPONS = [
  'dnd5e-club', 'dnd5e-dagger', 'dnd5e-greatclub', 'dnd5e-handaxe', 'dnd5e-javelin',
  'dnd5e-light-hammer', 'dnd5e-mace', 'dnd5e-quarterstaff', 'dnd5e-sickle', 'dnd5e-spear',
  'dnd5e-light-crossbow', 'dnd5e-dart', 'dnd5e-shortbow', 'dnd5e-sling',
] as const
const SIMPLE_MELEE_WEAPONS = [
  'dnd5e-club', 'dnd5e-dagger', 'dnd5e-greatclub', 'dnd5e-handaxe', 'dnd5e-javelin',
  'dnd5e-light-hammer', 'dnd5e-mace', 'dnd5e-quarterstaff', 'dnd5e-sickle', 'dnd5e-spear',
] as const
const MARTIAL_MELEE_WEAPONS = [
  'dnd5e-battleaxe', 'dnd5e-flail', 'dnd5e-glaive', 'dnd5e-greataxe', 'dnd5e-greatsword',
  'dnd5e-halberd', 'dnd5e-lance', 'dnd5e-longsword', 'dnd5e-maul', 'dnd5e-morningstar',
  'dnd5e-pike', 'dnd5e-rapier', 'dnd5e-scimitar', 'dnd5e-shortsword', 'dnd5e-trident',
  'dnd5e-war-pick', 'dnd5e-warhammer', 'dnd5e-whip',
] as const
const MARTIAL_WEAPONS = [
  ...MARTIAL_MELEE_WEAPONS,
  'dnd5e-blowgun', 'dnd5e-hand-crossbow', 'dnd5e-heavy-crossbow', 'dnd5e-longbow', 'dnd5e-net',
] as const

const PACKS: Readonly<Record<string, readonly Dnd5eStartingEquipmentGrant[]>> = {
  explorer: [
    grant(item('backpack')), grant(item('bedroll')), grant(item('mess-kit')), grant(item('tinderbox')),
    grant(item('torch'), 10), grant(item('rations-one-day'), 10), grant(item('waterskin')),
    grant(item('rope-hempen-50-feet')),
  ],
  dungeoneer: [
    grant(item('backpack')), grant(item('crowbar')), grant(item('hammer')), grant(item('piton'), 10),
    grant(item('torch'), 10), grant(item('tinderbox')), grant(item('rations-one-day'), 10),
    grant(item('waterskin')), grant(item('rope-hempen-50-feet')),
  ],
  burglar: [
    grant(item('backpack')), grant(item('ball-bearings-bag')), grant(item('string-10-feet')), grant(item('bell')),
    grant(item('candle'), 5), grant(item('crowbar')), grant(item('hammer')), grant(item('piton'), 10),
    grant(item('hooded-lantern')), grant(item('oil-flask'), 2), grant(item('rations-one-day'), 5),
    grant(item('tinderbox')), grant(item('waterskin')), grant(item('rope-hempen-50-feet')),
  ],
  diplomat: [
    grant(item('chest')), grant(item('map-scroll-case'), 2), grant(item('fine-clothes')), grant(item('ink-bottle')),
    grant(item('ink-pen')), grant(item('lamp')), grant(item('oil-flask'), 2), grant(item('paper-sheet'), 5),
    grant(item('perfume-vial')), grant(item('sealing-wax')), grant(item('soap')),
  ],
  entertainer: [
    grant(item('backpack')), grant(item('bedroll')), grant(item('costume'), 2), grant(item('candle'), 5),
    grant(item('rations-one-day'), 5), grant(item('waterskin')), grant(item('disguise-kit')),
  ],
  priest: [
    grant(item('backpack')), grant(item('blanket')), grant(item('candle'), 10), grant(item('tinderbox')),
    grant(item('alms-box')), grant(item('incense-block'), 2), grant(item('censer')), grant(item('vestments')),
    grant(item('rations-one-day'), 2), grant(item('waterskin')),
  ],
  scholar: [
    grant(item('backpack')), grant(item('lore-book')), grant(item('ink-bottle')), grant(item('ink-pen')),
    grant(item('parchment-sheet'), 10), grant(item('sand-bag')), grant(item('small-knife')),
  ],
}

const packOption = (id: keyof typeof PACKS, label: string): Dnd5eStartingEquipmentOption => ({
  id,
  label,
  grants: PACKS[id],
})

const picker = (
  id: string,
  label: string,
  equipmentIds: readonly string[],
  defaultEquipmentId: string,
  equipSlot?: EquipmentSlot,
): Dnd5eStartingEquipmentPicker => ({ id, label, equipmentIds, defaultEquipmentId, ...(equipSlot ? { equipSlot } : {}) })

function classPlan(charClass: string): Pick<Dnd5eStartingEquipmentPlan, 'fixedGrants' | 'groups'> {
  switch (charClass) {
    case '野蛮人': return {
      fixedGrants: [...PACKS.explorer, grant(eq('dnd5e-javelin'), 4)],
      groups: [
        group('barbarian-primary', '主武器', [
          option('greataxe', '巨斧', [grant(eq('dnd5e-greataxe'), 1, 'mainWeapon')]),
          selectableOption('martial-melee', '任意武用近战武器', picker('weapon', '武用近战武器', MARTIAL_MELEE_WEAPONS, 'dnd5e-longsword', 'mainWeapon')),
        ]),
        group('barbarian-secondary', '备用武器', [
          option('two-handaxes', '两把手斧', [grant(eq('dnd5e-handaxe'), 1), grant(eq('dnd5e-handaxe-offhand'), 1)]),
          selectableOption('simple-weapon', '任意简易武器', picker('weapon', '简易武器', SIMPLE_WEAPONS, 'dnd5e-javelin')),
        ]),
      ],
    }
    case '吟游诗人': return {
      fixedGrants: [grant(eq('dnd5e-leather-armor'), 1, 'armor'), grant(eq('dnd5e-dagger'))],
      groups: [
        group('bard-primary', '主武器', [
          option('rapier', '刺剑', [grant(eq('dnd5e-rapier'), 1, 'mainWeapon')]),
          option('longsword', '长剑', [grant(eq('dnd5e-longsword'), 1, 'mainWeapon')]),
          selectableOption('simple-weapon', '任意简易武器', picker('weapon', '简易武器', SIMPLE_WEAPONS, 'dnd5e-dagger', 'mainWeapon')),
        ]),
        group('bard-pack', '装备套组', [packOption('diplomat', '外交官套组'), packOption('entertainer', '艺人套组')]),
        group('bard-instrument', '乐器', [
          option('lute', '鲁特琴', [grant(item('lute'))]),
          option('bagpipes', '风笛', [grant(item('bagpipes'))]),
          option('drum', '鼓', [grant(item('drum'))]),
          option('dulcimer', '扬琴', [grant(item('dulcimer'))]),
          option('flute', '长笛', [grant(item('flute'))]),
          option('horn', '号角', [grant(item('horn'))]),
          option('lyre', '里拉琴', [grant(item('lyre'))]),
          option('pan-flute', '排箫', [grant(item('pan-flute'))]),
          option('shawm', '肖姆管', [grant(item('shawm'))]),
          option('viol', '维奥尔琴', [grant(item('viol'))]),
        ]),
      ],
    }
    case '牧师': return {
      fixedGrants: [grant(eq('dnd5e-shield'), 1, 'offHand'), grant(item('holy-symbol'))],
      groups: [
        group('cleric-primary', '主武器', [
          option('mace', '硬头锤', [grant(eq('dnd5e-mace'), 1, 'mainWeapon')]),
          option('warhammer', '战锤（需要相应熟练）', [grant(eq('dnd5e-warhammer'), 1, 'mainWeapon')]),
        ]),
        group('cleric-armor', '护甲', [
          option('scale-mail', '鳞甲', [grant(eq('dnd5e-scale-mail'), 1, 'armor')]),
          option('leather-armor', '皮甲', [grant(eq('dnd5e-leather-armor'), 1, 'armor')]),
          option('chain-mail', '链甲（需要相应熟练）', [grant(eq('dnd5e-chain-mail'), 1, 'armor')]),
        ]),
        group('cleric-secondary', '远程或备用武器', [
          option('light-crossbow', '轻弩与 20 支弩矢', [grant(eq('dnd5e-light-crossbow')), grant(item('crossbow-bolts'), 20)]),
          selectableOption('simple-weapon', '任意简易武器', picker('weapon', '简易武器', SIMPLE_WEAPONS, 'dnd5e-javelin')),
        ]),
        group('cleric-pack', '装备套组', [packOption('priest', '祭司套组'), packOption('explorer', '探索者套组')]),
      ],
    }
    case '德鲁伊': return {
      fixedGrants: [grant(eq('dnd5e-leather-armor'), 1, 'armor'), ...PACKS.explorer, grant(item('druidic-focus'))],
      groups: [
        group('druid-defense', '盾牌或备用武器', [
          option('wooden-shield', '木制盾牌', [grant(eq('dnd5e-shield'), 1, 'offHand')]),
          selectableOption('simple-weapon', '任意简易武器', picker('weapon', '简易武器', SIMPLE_WEAPONS, 'dnd5e-quarterstaff')),
        ]),
        group('druid-primary', '主武器', [
          option('scimitar', '弯刀', [grant(eq('dnd5e-scimitar'), 1, 'mainWeapon')]),
          selectableOption('simple-melee', '任意简易近战武器', picker('weapon', '简易近战武器', SIMPLE_MELEE_WEAPONS, 'dnd5e-quarterstaff', 'mainWeapon')),
        ]),
      ],
    }
    case '战士': return {
      fixedGrants: [],
      groups: [
        group('fighter-armor', '护甲配置', [
          option('chain-mail', '链甲', [grant(eq('dnd5e-chain-mail'), 1, 'armor')]),
          option('leather-and-longbow', '皮甲、长弓与 20 支箭', [grant(eq('dnd5e-leather-armor'), 1, 'armor'), grant(eq('dnd5e-longbow')), grant(item('arrows'), 20)]),
        ]),
        group('fighter-weapons', '主要武器配置', [
          selectableOption('weapon-and-shield', '一件武用武器与盾牌', picker('weapon', '武用武器', MARTIAL_WEAPONS, 'dnd5e-longsword', 'mainWeapon'), [grant(eq('dnd5e-shield'), 1, 'offHand')]),
          selectableOption('two-weapons', '两件武用武器', [
            picker('weapon-1', '第一件武用武器', MARTIAL_WEAPONS, 'dnd5e-greataxe', 'mainWeapon'),
            picker('weapon-2', '第二件武用武器', MARTIAL_WEAPONS, 'dnd5e-longsword'),
          ]),
        ]),
        group('fighter-secondary', '备用武器', [
          option('light-crossbow', '轻弩与 20 支弩矢', [grant(eq('dnd5e-light-crossbow')), grant(item('crossbow-bolts'), 20)]),
          option('two-handaxes', '两把手斧', [grant(eq('dnd5e-handaxe')), grant(eq('dnd5e-handaxe-offhand'))]),
        ]),
        group('fighter-pack', '装备套组', [packOption('dungeoneer', '地城探索者套组'), packOption('explorer', '探索者套组')]),
      ],
    }
    case '武僧': return {
      fixedGrants: [grant(eq('dnd5e-dart'), 10)],
      groups: [
        group('monk-primary', '主武器', [
          option('shortsword', '短剑', [grant(eq('dnd5e-shortsword'), 1, 'mainWeapon')]),
          selectableOption('simple-weapon', '任意简易武器', picker('weapon', '简易武器', SIMPLE_WEAPONS, 'dnd5e-quarterstaff', 'mainWeapon')),
        ]),
        group('monk-pack', '装备套组', [packOption('dungeoneer', '地城探索者套组'), packOption('explorer', '探索者套组')]),
      ],
    }
    case '圣武士': return {
      fixedGrants: [grant(eq('dnd5e-chain-mail'), 1, 'armor'), grant(item('holy-symbol'))],
      groups: [
        group('paladin-weapons', '主要武器配置', [
          selectableOption('weapon-and-shield', '一件武用武器与盾牌', picker('weapon', '武用武器', MARTIAL_WEAPONS, 'dnd5e-longsword', 'mainWeapon'), [grant(eq('dnd5e-shield'), 1, 'offHand')]),
          selectableOption('two-weapons', '两件武用武器', [
            picker('weapon-1', '第一件武用武器', MARTIAL_WEAPONS, 'dnd5e-greatsword', 'mainWeapon'),
            picker('weapon-2', '第二件武用武器', MARTIAL_WEAPONS, 'dnd5e-longsword'),
          ]),
        ]),
        group('paladin-secondary', '备用武器', [
          option('five-javelins', '五支标枪', [grant(eq('dnd5e-javelin'), 5)]),
          selectableOption('simple-melee', '任意简易近战武器', picker('weapon', '简易近战武器', SIMPLE_MELEE_WEAPONS, 'dnd5e-mace')),
        ]),
        group('paladin-pack', '装备套组', [packOption('priest', '祭司套组'), packOption('explorer', '探索者套组')]),
      ],
    }
    case '游侠': return {
      fixedGrants: [grant(eq('dnd5e-longbow')), grant(item('arrows'), 20)],
      groups: [
        group('ranger-armor', '护甲', [
          option('scale-mail', '鳞甲', [grant(eq('dnd5e-scale-mail'), 1, 'armor')]),
          option('leather-armor', '皮甲', [grant(eq('dnd5e-leather-armor'), 1, 'armor')]),
        ]),
        group('ranger-weapons', '近战武器', [
          option('two-shortswords', '两把短剑', [grant(eq('dnd5e-shortsword'), 1, 'mainWeapon'), grant(eq('dnd5e-shortsword-offhand'), 1, 'offHand')]),
          selectableOption('two-simple-melee', '两件简易近战武器', [
            picker('weapon-1', '第一件简易近战武器', SIMPLE_MELEE_WEAPONS, 'dnd5e-handaxe', 'mainWeapon'),
            picker('weapon-2', '第二件简易近战武器', SIMPLE_MELEE_WEAPONS, 'dnd5e-javelin'),
          ]),
        ]),
        group('ranger-pack', '装备套组', [packOption('dungeoneer', '地城探索者套组'), packOption('explorer', '探索者套组')]),
      ],
    }
    case '游荡者': return {
      fixedGrants: [grant(eq('dnd5e-leather-armor'), 1, 'armor'), grant(eq('dnd5e-dagger'), 2), grant(item('thieves-tools'))],
      groups: [
        group('rogue-primary', '主武器', [
          option('rapier', '刺剑', [grant(eq('dnd5e-rapier'), 1, 'mainWeapon')]),
          option('shortsword', '短剑', [grant(eq('dnd5e-shortsword'), 1, 'mainWeapon')]),
        ]),
        group('rogue-secondary', '远程或备用武器', [
          option('shortbow', '短弓与 20 支箭', [grant(eq('dnd5e-shortbow')), grant(item('arrows'), 20)]),
          option('shortsword', '另一把短剑', [grant(eq('dnd5e-shortsword'))]),
        ]),
        group('rogue-pack', '装备套组', [packOption('burglar', '窃贼套组'), packOption('dungeoneer', '地城探索者套组'), packOption('explorer', '探索者套组')]),
      ],
    }
    case '术士': return {
      fixedGrants: [grant(eq('dnd5e-dagger'), 2)],
      groups: [
        group('sorcerer-primary', '武器', [
          option('light-crossbow', '轻弩与 20 支弩矢', [grant(eq('dnd5e-light-crossbow'), 1, 'mainWeapon'), grant(item('crossbow-bolts'), 20)]),
          selectableOption('simple-weapon', '任意简易武器', picker('weapon', '简易武器', SIMPLE_WEAPONS, 'dnd5e-quarterstaff', 'mainWeapon')),
        ]),
        group('sorcerer-focus', '施法法器', [option('component-pouch', '材料包', [grant(item('component-pouch'))]), option('arcane-focus', '奥术法器', [grant(item('arcane-focus'))])]),
        group('sorcerer-pack', '装备套组', [packOption('dungeoneer', '地城探索者套组'), packOption('explorer', '探索者套组')]),
      ],
    }
    case '邪术师': return {
      fixedGrants: [grant(eq('dnd5e-leather-armor'), 1, 'armor'), grant(eq('dnd5e-dagger'), 2)],
      groups: [
        group('warlock-primary', '远程或备用武器', [
          option('light-crossbow', '轻弩与 20 支弩矢', [grant(eq('dnd5e-light-crossbow'), 1, 'mainWeapon'), grant(item('crossbow-bolts'), 20)]),
          selectableOption('simple-weapon', '任意简易武器', picker('weapon', '简易武器', SIMPLE_WEAPONS, 'dnd5e-quarterstaff', 'mainWeapon')),
        ]),
        group('warlock-focus', '施法法器', [option('component-pouch', '材料包', [grant(item('component-pouch'))]), option('arcane-focus', '奥术法器', [grant(item('arcane-focus'))])]),
        group('warlock-pack', '装备套组', [packOption('scholar', '学者套组'), packOption('dungeoneer', '地城探索者套组')]),
        group('warlock-simple', '额外简易武器', [selectableOption('simple-weapon', '任意简易武器', picker('weapon', '简易武器', SIMPLE_WEAPONS, 'dnd5e-dagger'))]),
      ],
    }
    case '法师': return {
      fixedGrants: [grant(item('spellbook'))],
      groups: [
        group('wizard-primary', '武器', [
          option('quarterstaff', '长棍', [grant(eq('dnd5e-quarterstaff'), 1, 'mainWeapon')]),
          option('dagger', '匕首', [grant(eq('dnd5e-dagger'), 1, 'mainWeapon')]),
        ]),
        group('wizard-focus', '施法法器', [option('component-pouch', '材料包', [grant(item('component-pouch'))]), option('arcane-focus', '奥术法器', [grant(item('arcane-focus'))])]),
        group('wizard-pack', '装备套组', [packOption('scholar', '学者套组'), packOption('explorer', '探索者套组')]),
      ],
    }
    default: return { fixedGrants: [], groups: [] }
  }
}

function backgroundPlan(background: string): Pick<Dnd5eStartingEquipmentPlan, 'fixedGrants' | 'groups'> {
  if (background !== '侍僧') return { fixedGrants: [], groups: [] }
  return {
    fixedGrants: [
      grant(item('holy-symbol')), grant(item('incense-block'), 5), grant(item('vestments')),
      grant(item('common-clothes')), grant(item('coin-pouch-15gp')),
    ],
    groups: [group('acolyte-devotion', '侍僧背景宗教器物', [
      option('prayer-book', '祈祷书', [grant(item('prayer-book'))]),
      option('prayer-wheel', '经轮', [grant(item('prayer-wheel'))]),
    ], 'background')],
  }
}

export function dnd5eStartingEquipmentPlan(charClass: string, background: string): Dnd5eStartingEquipmentPlan {
  const fromClass = classPlan(charClass)
  const fromBackground = backgroundPlan(background)
  return {
    charClass,
    background,
    fixedGrants: [...fromClass.fixedGrants, ...fromBackground.fixedGrants],
    groups: [...fromClass.groups, ...fromBackground.groups],
  }
}

export function defaultDnd5eStartingEquipmentSelection(plan: Dnd5eStartingEquipmentPlan): Dnd5eStartingEquipmentSelection {
  const optionIds: Record<string, string> = {}
  const equipmentIds: Record<string, string> = {}
  for (const group of plan.groups) {
    const selected = group.options[0]
    if (!selected) continue
    optionIds[group.id] = selected.id
    for (const choice of selected.pickers ?? []) equipmentIds[pickerKey(group.id, choice.id)] = choice.defaultEquipmentId
  }
  return { optionIds, equipmentIds }
}

export function normalizeDnd5eStartingEquipmentSelection(
  plan: Dnd5eStartingEquipmentPlan,
  selection: Dnd5eStartingEquipmentSelection,
): Dnd5eStartingEquipmentSelection {
  const defaults = defaultDnd5eStartingEquipmentSelection(plan)
  const optionIds: Record<string, string> = {}
  const equipmentIds: Record<string, string> = {}
  for (const group of plan.groups) {
    const selected = group.options.find((candidate) => candidate.id === selection.optionIds[group.id]) ?? group.options[0]
    if (!selected) continue
    optionIds[group.id] = selected.id
    for (const choice of selected.pickers ?? []) {
      const key = pickerKey(group.id, choice.id)
      const requested = selection.equipmentIds[key]
      equipmentIds[key] = choice.equipmentIds.includes(requested) ? requested : defaults.equipmentIds[key] ?? choice.defaultEquipmentId
    }
  }
  return { optionIds, equipmentIds }
}

export function resolveDnd5eStartingEquipment(
  characterId: string,
  plan: Dnd5eStartingEquipmentPlan,
  selection: Dnd5eStartingEquipmentSelection,
): ResolvedDnd5eStartingEquipment {
  const normalized = normalizeDnd5eStartingEquipmentSelection(plan, selection)
  const grants = plan.fixedGrants.map((entry) => ({ ...entry }))
  for (const group of plan.groups) {
    const selected = group.options.find((candidate) => candidate.id === normalized.optionIds[group.id])
    if (!selected) continue
    grants.push(...selected.grants.map((entry) => ({ ...entry })))
    for (const choice of selected.pickers ?? []) {
      grants.push(grant(eq(normalized.equipmentIds[pickerKey(group.id, choice.id)]), 1, choice.equipSlot))
    }
  }
  const equipment: CharacterEquipment = {}
  const inventoryEntries: Dnd5eInventoryEntry[] = []
  grants.forEach((entry, index) => {
    const template = dnd5eInventoryItemTemplate(entry.templateId)
    if (!template) throw new Error(`Unknown D&D 5e starting equipment template: ${entry.templateId}`)
    const itemSnapshot = structuredClone(template)
    if (entry.equipSlot && itemSnapshot.equipment) {
      const equipped = cloneEquipmentForSlot(itemSnapshot.equipment, entry.equipSlot)
      itemSnapshot.equipment = equipped
      equipment[entry.equipSlot] = equipped
    }
    inventoryEntries.push({
      instanceId: `starting:${characterId}:${index}:${entry.templateId}`,
      templateId: entry.templateId,
      item: itemSnapshot,
      quantity: entry.quantity,
      ...(itemSnapshot.use?.chargesPerItem ? { remainingCharges: itemSnapshot.use.chargesPerItem * entry.quantity } : {}),
      ...(entry.equipSlot ? { equippedSlot: entry.equipSlot } : {}),
      acquiredAt: 0,
    })
  })
  return {
    grants,
    equipment: Object.keys(equipment).length > 0 ? equipment : undefined,
    inventory: { schemaVersion: 1, entries: inventoryEntries },
  }
}

export function dnd5eStartingEquipmentPickerItems(choice: Dnd5eStartingEquipmentPicker): EquipmentItem[] {
  const allowed = new Set(choice.equipmentIds)
  return DND5E_SRD_EQUIPMENT_CATALOG.filter((entry) => allowed.has(entry.id))
}

export function dnd5eStartingEquipmentSummary(
  plan: Dnd5eStartingEquipmentPlan,
  selection: Dnd5eStartingEquipmentSelection,
): string[] {
  const normalized = normalizeDnd5eStartingEquipmentSelection(plan, selection)
  return plan.groups.flatMap((group) => {
    const selected = group.options.find((candidate) => candidate.id === normalized.optionIds[group.id])
    if (!selected) return []
    const picked = (selected.pickers ?? []).map((choice) => {
      const equipmentId = normalized.equipmentIds[pickerKey(group.id, choice.id)]
      return DND5E_SRD_EQUIPMENT_CATALOG.find((entry) => entry.id === equipmentId)?.name ?? equipmentId
    })
    return [`${group.label}：${selected.label}${picked.length ? `（${picked.join('、')}）` : ''}`]
  })
}

export function dnd5eStartingEquipmentPickerKey(groupId: string, pickerId: string): string {
  return pickerKey(groupId, pickerId)
}

function group(
  id: string,
  label: string,
  options: readonly Dnd5eStartingEquipmentOption[],
  source: Dnd5eStartingEquipmentChoiceGroup['source'] = 'class',
): Dnd5eStartingEquipmentChoiceGroup {
  return { id, label, source, options }
}

function option(id: string, label: string, grants: readonly Dnd5eStartingEquipmentGrant[]): Dnd5eStartingEquipmentOption {
  return { id, label, grants }
}

function selectableOption(
  id: string,
  label: string,
  pickers: Dnd5eStartingEquipmentPicker | readonly Dnd5eStartingEquipmentPicker[],
  grants: readonly Dnd5eStartingEquipmentGrant[] = [],
): Dnd5eStartingEquipmentOption {
  return { id, label, grants, pickers: Array.isArray(pickers) ? pickers : [pickers] }
}

function pickerKey(groupId: string, pickerId: string): string {
  return `${groupId}:${pickerId}`
}

function cloneEquipmentForSlot(equipment: EquipmentItem, slot: EquipmentSlot): EquipmentItem {
  return { ...structuredClone(equipment), slot }
}
