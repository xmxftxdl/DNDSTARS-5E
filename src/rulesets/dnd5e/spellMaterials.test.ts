import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { Character } from '../../types/character'
import { DND5E_MACE, DND5E_SHIELD } from './equipment'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import {
  applyDnd5eSpellMaterialConsumption,
  dnd5eCoreSpellMaterialRequirement,
  dnd5eSpellMaterialConsumptionPlan,
  dnd5eSpellMaterialPlanLogDetails,
} from './spellMaterials'
import {
  dnd5eCoreSpellComponentRequirements,
  dnd5eSpellComponentCheck,
  dnd5eSpellComponentsAvailable,
} from './spellComponents'

function caster(id = 'material-caster'): Character {
  return normalizeCharacter({
    id,
    name: '材料施法者',
    player: 'tester',
    charClass: '法师',
    level: 9,
    maxHp: 40,
    currentHp: 40,
    equipment: {},
    dnd5eInventory: { schemaVersion: 3, revision: 0, entries: [] },
  })
}

function grant(character: Character, templateId: string, quantity: number): Character {
  const result = applyDnd5eInventoryMutation([character], {
    type: 'grant',
    characterId: character.id,
    templateId,
    quantity,
  })
  expect(result.ok).toBe(true)
  return result.characters[0]
}

describe('D&D 5e structured spell materials', () => {
  it('matches explicit ingredient tags and never accepts price alone', () => {
    const requirement = dnd5eCoreSpellMaterialRequirement('revivify')!
    const expensiveSword: Character = {
      ...caster(),
      dnd5eInventory: {
        schemaVersion: 3,
        revision: 4,
        entries: [{
          instanceId: 'expensive-sword',
          templateId: 'test:expensive-sword',
          item: {
            id: 'test:expensive-sword', name: '昂贵武器', category: 'adventuring-gear',
            icon: 'sword', description: '', rulesText: '', stackable: false,
            cost: { amount: 10_000, currency: 'gp' },
            source: { book: '测试', license: '测试' },
          },
          quantity: 1,
          acquiredAt: 1,
        }],
      },
    }

    expect(dnd5eSpellMaterialConsumptionPlan(expensiveSword, requirement)).toBeUndefined()
  })

  it('allows diamonds to combine for revivify and consumes the bound inventory units', () => {
    const withDiamonds = grant(caster(), 'srd-5.1:item:diamond-100gp', 3)
    const check = dnd5eSpellComponentCheck(
      withDiamonds,
      dnd5eCoreSpellComponentRequirements('revivify'),
      'wizard',
    )

    expect(check.material).toBe('specific-material')
    expect(dnd5eSpellComponentsAvailable(check)).toBe(true)
    expect(check.materialPlan?.allocations).toEqual([
      expect.objectContaining({ tag: 'diamond', quantity: 3, consumed: true }),
    ])

    const settled = applyDnd5eSpellMaterialConsumption(withDiamonds, check.materialPlan!)
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(normalizeDnd5eInventory(settled.character).entries.some((entry) =>
      entry.templateId === 'srd-5.1:item:diamond-100gp',
    )).toBe(false)
    expect(normalizeDnd5eInventory(settled.character).revision).toBe(
      (normalizeDnd5eInventory(withDiamonds).revision ?? 0) + 1,
    )
  })

  it('distinguishes one minimum-value diamond from an aggregate value', () => {
    let character = grant(caster(), 'srd-5.1:item:diamond-300gp', 1)
    character = grant(character, 'srd-5.1:item:diamond-100gp', 2)

    expect(dnd5eSpellMaterialConsumptionPlan(
      character,
      dnd5eCoreSpellMaterialRequirement('revivify')!,
    )).toBeDefined()
    expect(dnd5eSpellMaterialConsumptionPlan(
      character,
      dnd5eCoreSpellMaterialRequirement('raise-dead')!,
    )).toBeUndefined()

    const withSingleDiamond = grant(character, 'srd-5.1:item:diamond-500gp', 1)
    expect(dnd5eSpellMaterialConsumptionPlan(
      withSingleDiamond,
      dnd5eCoreSpellMaterialRequirement('raise-dead')!,
    )).toBeDefined()
  })

  it('uses an exact total-value material without overconsuming a cheaper matching stack', () => {
    let character = grant(caster(), 'srd-5.1:item:diamond-1000gp', 1)
    character = grant(character, 'srd-5.1:item:diamond-25000gp', 1)
    character = grant(character, 'srd-5.1:item:holy-water-flask', 1)

    const plan = dnd5eSpellMaterialConsumptionPlan(
      character,
      dnd5eCoreSpellMaterialRequirement('true-resurrection')!,
    )!
    expect(plan.allocations).toEqual(expect.arrayContaining([
      expect.objectContaining({ tag: 'holy-water', quantity: 1 }),
      expect.objectContaining({ tag: 'diamond', unitValueGp: 25_000, quantity: 1 }),
    ]))
    expect(plan.allocations).not.toContainEqual(expect.objectContaining({
      tag: 'diamond', unitValueGp: 1_000,
    }))

    const settled = applyDnd5eSpellMaterialConsumption(character, plan)
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(normalizeDnd5eInventory(settled.character).entries).toEqual([
      expect.objectContaining({ templateId: 'srd-5.1:item:diamond-1000gp', quantity: 1 }),
    ])
  })

  it('checks non-consumed costly materials without deleting or revising inventory', () => {
    const withPearl = grant(caster(), 'srd-5.1:item:pearl-100gp', 1)
    const plan = dnd5eSpellMaterialConsumptionPlan(
      withPearl,
      dnd5eCoreSpellMaterialRequirement('identify')!,
    )!
    const before = normalizeDnd5eInventory(withPearl)
    const settled = applyDnd5eSpellMaterialConsumption(withPearl, plan)

    expect(settled).toMatchObject({ ok: true, consumed: false })
    if (!settled.ok) return
    expect(normalizeDnd5eInventory(settled.character).revision).toBe(before.revision)
    expect(normalizeDnd5eInventory(settled.character).entries).toHaveLength(1)
  })

  it('requires the Shapechange jade circlet to be worn before the cast and preserves it', () => {
    const carried = grant(caster(), 'srd-5.1:item:jade-circlet-1500gp', 1)
    const requirement = dnd5eCoreSpellMaterialRequirement('shapechange')!
    expect(dnd5eSpellMaterialConsumptionPlan(carried, requirement)).toBeUndefined()

    const circlet = normalizeDnd5eInventory(carried).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:jade-circlet-1500gp')!
    const equipped = applyDnd5eInventoryMutation([carried], {
      type: 'equip', characterId: carried.id, instanceId: circlet.instanceId, slot: 'helmet',
    })
    expect(equipped.ok).toBe(true)
    const wearer = equipped.characters[0]
    const plan = dnd5eSpellMaterialConsumptionPlan(wearer, requirement)!
    expect(plan.allocations).toEqual([expect.objectContaining({
      instanceId: circlet.instanceId, tag: 'jade-circlet', quantity: 1,
      consumed: false, mustBeEquipped: true,
    })])
    expect(dnd5eSpellMaterialPlanLogDetails(wearer, plan)[1]).toContain('施法前已穿戴')
    const settled = applyDnd5eSpellMaterialConsumption(wearer, plan)
    expect(settled).toMatchObject({ ok: true, consumed: false })
    if (!settled.ok) return
    expect(normalizeDnd5eInventory(settled.character).entries[0]).toMatchObject({
      instanceId: circlet.instanceId, equippedSlot: 'helmet', quantity: 1,
    })
  })

  it('makes the Warding Bond platinum ring wearable and requires the caster to wear it', () => {
    const carried = grant(caster(), 'srd-5.1:item:platinum-ring-50gp', 1)
    const requirement = dnd5eCoreSpellMaterialRequirement('warding-bond')!
    expect(dnd5eSpellMaterialConsumptionPlan(carried, requirement)).toBeUndefined()

    const ring = normalizeDnd5eInventory(carried).entries.find((entry) =>
      entry.templateId === 'srd-5.1:item:platinum-ring-50gp')!
    expect(ring.item.equipment).toMatchObject({ slot: 'ring' })
    const equipped = applyDnd5eInventoryMutation([carried], {
      type: 'equip', characterId: carried.id, instanceId: ring.instanceId, slot: 'ring',
    })
    expect(equipped.ok).toBe(true)
    const plan = dnd5eSpellMaterialConsumptionPlan(
      equipped.characters[0],
      requirement,
    )!
    expect(plan.allocations).toEqual([expect.objectContaining({
      instanceId: ring.instanceId,
      tag: 'platinum-ring',
      quantity: 1,
      unitValueGp: 50,
      consumed: false,
      mustBeEquipped: true,
    })])
  })

  it('records consumed and preserved Legend Lore allocations in the cast audit log', () => {
    let character = grant(caster(), 'srd-5.1:item:legend-lore-incense-250gp', 1)
    character = grant(character, 'srd-5.1:item:ivory-strip-50gp', 4)
    const plan = dnd5eSpellMaterialConsumptionPlan(
      character,
      dnd5eCoreSpellMaterialRequirement('legend-lore')!,
    )!

    expect(dnd5eSpellMaterialPlanLogDetails(character, plan)).toEqual([
      '施法材料方案：价值 250 gp 的熏香和四片各值 50 gp 的象牙｜采用 价值 250 gp 的熏香和四片各值 50 gp 的象牙',
      '施法材料：通晓传奇熏香（250 gp） ×1｜每单位 250 gp｜结算时已消耗',
      '施法材料：象牙片（50 gp） ×4｜每单位 50 gp｜施法后保留',
    ])
  })

  it('prices Imprisonment at 500 gp per target Hit Die and preserves its reusable component', () => {
    const oneShare = grant(caster(), 'srd-5.1:item:imprisonment-precious-chain-500gp', 1)
    const scoutRequirement = dnd5eCoreSpellMaterialRequirement('imprisonment', {
      targetHitDiceCount: 3,
    })!
    expect(scoutRequirement.label).toContain('1,500 gp')
    expect(dnd5eSpellMaterialConsumptionPlan(oneShare, scoutRequirement)).toBeUndefined()

    const threeShares = grant(oneShare, 'srd-5.1:item:imprisonment-precious-chain-500gp', 2)
    const plan = dnd5eSpellMaterialConsumptionPlan(threeShares, scoutRequirement)!
    expect(plan).toMatchObject({
      optionLabel: '锁链·贵金属锁链',
      allocations: [expect.objectContaining({
        tag: 'imprisonment-precious-chain', quantity: 3, consumed: false,
      })],
    })
    const settled = applyDnd5eSpellMaterialConsumption(threeShares, plan)
    expect(settled).toMatchObject({ ok: true, consumed: false })
    if (!settled.ok) return
    expect(normalizeDnd5eInventory(settled.character)).toEqual(normalizeDnd5eInventory(threeShares))

    const chainingRequirement = dnd5eCoreSpellMaterialRequirement('imprisonment', {
      targetHitDiceCount: 3,
      imprisonmentMode: 'chaining',
    })!
    expect(chainingRequirement.options).toHaveLength(1)
    expect(chainingRequirement.options[0]?.label).toBe('锁链·贵金属锁链')
    const threeMithralShares = grant(caster(), 'srd-5.1:item:imprisonment-mithral-orb-500gp', 3)
    expect(dnd5eSpellMaterialConsumptionPlan(threeMithralShares, chainingRequirement)).toBeUndefined()
  })

  it('uses and consumes the existing holy-water inventory item for protection', () => {
    const withHolyWater = grant(caster(), 'srd-5.1:item:holy-water-flask', 1)
    const check = dnd5eSpellComponentCheck(
      withHolyWater,
      dnd5eCoreSpellComponentRequirements('protection-from-evil-and-good'),
      'wizard',
    )

    expect(check.material).toBe('specific-material')
    const settled = applyDnd5eSpellMaterialConsumption(withHolyWater, check.materialPlan!)
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(normalizeDnd5eInventory(settled.character).entries).toHaveLength(0)
  })

  it('requires a free hand to manipulate the actual material even if the inventory has it', () => {
    const occupied = grant({
      ...caster(),
      equipment: { mainWeapon: DND5E_MACE, offHand: DND5E_SHIELD },
    }, 'srd-5.1:item:diamond-300gp', 1)
    const check = dnd5eSpellComponentCheck(
      occupied,
      dnd5eCoreSpellComponentRequirements('revivify'),
      'wizard',
    )

    expect(check.material).toBe('specific-material-hands-occupied')
    expect(dnd5eSpellComponentsAvailable(check)).toBe(false)
  })

  it('rejects a stale prepared allocation instead of consuming a different snapshot', () => {
    const withDiamond = grant(caster(), 'srd-5.1:item:diamond-300gp', 1)
    const plan = dnd5eSpellMaterialConsumptionPlan(
      withDiamond,
      dnd5eCoreSpellMaterialRequirement('revivify')!,
    )!
    const stale: Character = {
      ...withDiamond,
      dnd5eInventory: {
        ...normalizeDnd5eInventory(withDiamond),
        revision: (normalizeDnd5eInventory(withDiamond).revision ?? 0) + 1,
      },
    }

    expect(applyDnd5eSpellMaterialConsumption(stale, plan)).toMatchObject({
      ok: false,
      reason: 'stale-inventory-revision',
    })
  })
})
