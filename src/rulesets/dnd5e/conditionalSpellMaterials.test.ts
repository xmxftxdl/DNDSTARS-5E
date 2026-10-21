import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap, Token } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2, parseDnd5eContentPackageV2 } from './contentPackageV2'
import { exportPdfContentModule } from './pdfContentModule'
import { projectDnd5eStarModRuntime } from './starModAdapter'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { applyDnd5eInventoryMutation, applyDnd5eInventoryGrantBundle } from './items'
import { resolveDnd5eHeadlessAction, endDnd5eConcentration, type Dnd5eCombatEvent } from './headlessCombatEngine'
import { planDnd5eMapResultApplication } from './mapBridge'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'

const modes = { choiceId: 'mode', options: [{ optionId: 'ordinary' }, { optionId: 'ward', requirement: {
  label: 'Synthetic diamond recipe', options: [{ label: 'Diamond', components: [{ tag: 'diamond', label: 'Diamond', consumed: true, quantity: 1 }] }],
} }] }
async function content(deferred = false, concentration = false, customMaterial = false, mixed = false) {
  const recipes = structuredClone(modes)
  if (customMaterial) for (const option of recipes.options) for (const recipe of option.requirement?.options ?? []) {
    for (const component of recipe.components) Object.assign(component, { tag: 'synthetic:reagent', requiresExpiry: true })
    if (mixed) recipe.components.push({ tag: 'synthetic:catalyst', label: 'Reusable catalyst', quantity: 1, consumed: false,
      ...{ minimumUnitValueGp: 1000 } })
  }
  return prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Material modes',
    ...(customMaterial ? { items: [{ id: 'reagent', name: 'Synthetic reagent', description: 'Synthetic material for protocol verification.',
      rulesText: 'Matches the synthetic reagent recipe.', category: 'adventuring-gear', icon: 'generic', stackable: true,
      spellcastingMaterial: { tags: ['synthetic:reagent'] } }, ...(mixed ? [{ id: 'catalyst', name: 'Reusable catalyst',
        description: 'Synthetic reusable material.', rulesText: 'Retained after casting.', category: 'adventuring-gear', icon: 'generic', stackable: true,
        spellcastingMaterial: { tags: ['synthetic:catalyst'], unitValueGp: 1000 } }, { id: 'cheap-catalyst', name: 'Insufficient-value catalyst',
        description: 'Synthetic lower-value material.', rulesText: 'Below the recipe value.', category: 'adventuring-gear', icon: 'generic', stackable: true,
        spellcastingMaterial: { tags: ['synthetic:catalyst'], unitValueGp: 999 } }] : [])] } : {}),
    spells: [{ id: 'sample', name: 'Sample', level: 2, school: 'abjuration', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
      components: { verbal: true, somatic: true, material: true, materialText: 'Synthetic', materialRequirementByChoice: deferred
        ? { ...recipes, options: recipes.options.map(option => ({ ...option, ...(option.requirement ? { requirement: { ...option.requirement, consumptionTiming: 'spell-end' } } : {}) })) } : recipes },
      duration: deferred ? { type: 'timed', value: 1, unit: 'round', concentration } : { type: 'instantaneous', concentration: false }, classes: ['wizard'], description: 'Synthetic.', automation: { mode: 'full' } }],
    activityPatterns: [{ schemaVersion: 1, id: 'sample-cast', name: 'Sample', source: { kind: 'spell', id: 'sample' },
      ...(concentration ? { effects: [{ schemaVersion: 1, id: 'ward-effect', name: 'Ward', duration: { kind: 'concentration', maximumRounds: 1 }, concentration: true, stacking: 'replace' }] } : {}),
      target: { kind: 'self' }, pattern: 'choice', label: 'Mode', branches: ['ordinary', 'ward'].map(id => ({ id, label: id,
        outcomes: [{ id: `${id}-benefit`, when: { kind: 'always' }, operations: [concentration
          ? { id: `${id}-effect`, kind: 'apply-effect', target: 'actor', effectId: 'ward-effect' }
          : { id: `${id}-hp`, kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 3 } }] }],
      })) }],
  }), 'material-modes.json', { targetCollection: 'spells' })
}

describe('conditional spell material authority', () => {
  it('round-trips an ordinary ingredient with a focus alternative and rejects consumed substitutions', async () => {
    const prepared = await content()
    const requirement = prepared.package.content.spells[0].components.materialRequirementByChoice!.options[1].requirement!
    requirement.allowFocusSubstitution = true
    requirement.options[0].components[0].consumed = false
    const exported = await exportPdfContentModule({ id: 'local.optional-material', name: 'Optional material', version: '1.0.0', inventoryComplete: true,
      entries: [{ sourceId: 'synthetic-optional', name: 'Synthetic optional', draft: { schemaVersion: 1,
        contentJson: JSON.stringify(prepared.package.content), assumptions: [], unsupported: [] } }] })
    const restored = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(exported.bytes))!
    expect(restored.content.spells[0].components.materialRequirementByChoice!.options[1].requirement).toEqual(requirement)
    const invalid = structuredClone(restored)
    invalid.content.spells[0].components.materialRequirementByChoice!.options[1].requirement!.options[0].components[0].consumed = true
    expect(() => parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(invalid)).buffer)).toThrow(/allowFocusSubstitution/)
  })
  it.each([[false, false], [true, false], [true, true]])('preserves material recipes through portable export and reinstall, deferred=%s, custom=%s', async (deferred, custom) => {
    const prepared = await content(deferred, false, custom)
    const exported = await exportPdfContentModule({ id: 'local.material-modes', name: 'Material modes', version: '1.0.0', inventoryComplete: true,
      entries: [{ sourceId: 'synthetic', name: 'Synthetic', draft: { schemaVersion: 1,
        contentJson: JSON.stringify(prepared.package.content), assumptions: [], unsupported: [] } }] })
    const restored = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(exported.bytes))!
    expect(restored.content.spells[0].components.materialRequirementByChoice).toEqual(prepared.package.content.spells[0].components.materialRequirementByChoice)
    if (custom) expect(restored.content.items[0].spellcastingMaterial?.tags).toEqual(['synthetic:reagent'])
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(restored))
    dispose()
  })
  it('rejects deferred recipes without an explicit finite spell duration', async () => {
    const prepared = await content(true)
    prepared.package.content.spells[0].duration = { type: 'instantaneous', concentration: false }
    expect(() => registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(prepared.package))).toThrow(/explicit timed duration/)
  })
  it('rejects recipes not exactly bound to a declared closed Activity choice', async () => {
    const prepared = await content()
    for (const replacement of [
      { ...modes, choiceId: 'missing' },
      { ...modes, options: [modes.options[0]] },
      { ...modes, options: [...modes.options, { optionId: 'extra' }] },
    ]) {
      const invalid = structuredClone(prepared.package)
      invalid.content.spells[0].components.materialRequirementByChoice = replacement
      expect(() => registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(invalid))).toThrow(/Conditional spell material/)
    }
  })
  it.each([[false, false, false, false], [true, false, false, false], [true, true, false, false], [true, true, true, false],
    [false, false, true, true], [true, true, true, true]])('settles an installed material lifecycle, deferred=%s, concentration=%s, custom=%s, mixed=%s', async (deferred, concentration, custom, mixed) => {
    const preparedContent = await content(deferred, concentration, custom, mixed)
    const original = structuredClone(preparedContent.package)
    const exported = await exportPdfContentModule({ id: 'local.material-lifecycle', name: 'Material lifecycle', version: '1.0.0', inventoryComplete: true,
      entries: [{ sourceId: 'synthetic-lifecycle', name: 'Synthetic lifecycle', draft: { schemaVersion: 1,
        contentJson: JSON.stringify(preparedContent.package.content), assumptions: [], unsupported: [] } }] })
    const restored = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(exported.bytes))!
    expect(restored.content.spells[0].components.materialRequirementByChoice).toEqual(original.content.spells[0].components.materialRequirementByChoice)
    expect(preparedContent.package).toEqual(original)
    preparedContent.package = restored
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(preparedContent.package))
    try {
      const spellId = `${preparedContent.package.manifest.id}:sample`
      const materialId = custom ? `${preparedContent.package.manifest.id}:reagent` : 'srd-5.1:item:diamond-300gp'
      let actor = normalizeCharacter({ id: 'caster', name: 'Caster', charClass: '法师', level: 5, maxHp: 30, currentHp: 30,
        abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
        dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
        classResources: { 'dnd5e-spell-slot-2': { current: 2, max: 2 } } })
      const caster: Token = { id: 'caster-token', characterId: actor.id, label: 'Caster', type: 'player', x: 25, y: 25, size: 1, emoji: '', color: '' }
      const map: BattleMap = { id: 'materials', name: 'Materials', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster] }
      const initiativeOrder = [{ tokenId: caster.id, label: caster.label, roll: 20, emoji: '', color: '' }]
      const prepare = (mode?: string) => {
        const action: SharedPlayerActionState = { id: 'cast', type: 'dnd5e-spell-cast', sourceMode: 'player', status: 'pending',
          mapId: map.id, actorTokenId: caster.id, characterId: actor.id, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
          dnd5eSpellCast: { spellId, castingClassId: 'wizard', slotLevel: 2, targetTokenId: caster.id,
            activityChoices: mode ? { mode } : undefined } }
        return prepareDnd5ePluginSpellCast({ action, map, characters: [actor], initiativeOrder })
      }
      expect(prepare().ok).toBe(false)
      expect(prepare('forged').ok).toBe(false)
      expect(prepare('ward').ok).toBe(false)
      if (custom) actor.dnd5eWorldTimeAppliedMinute = 10
      const grant = custom
        ? applyDnd5eInventoryGrantBundle([actor], { characterId: actor.id, receiptId: 'material-grant', grants: [{ templateId: materialId, quantity: 1, expiresAtWorldMinute: 20 }] })
        : applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id, templateId: materialId, quantity: 1 })
      expect(grant.ok).toBe(true)
      actor = grant.characters[0]
      // The normal branch uses the normal material substitute, not the special ingredient.
      const pouch = applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id, templateId: 'srd-5.1:item:component-pouch', quantity: 1 })
      expect(pouch.ok).toBe(true)
      actor = pouch.characters[0]
      const catalystId = `${preparedContent.package.manifest.id}:catalyst`
      if (mixed) {
        expect(prepare('ward').ok).toBe(false)
        const cheap = applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id,
          templateId: `${preparedContent.package.manifest.id}:cheap-catalyst`, quantity: 1 })
        expect(cheap.ok).toBe(true)
        actor = cheap.characters[0]
        expect(prepare('ward').ok).toBe(false)
        const catalyst = applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id, templateId: catalystId, quantity: 1 })
        expect(catalyst.ok).toBe(true)
        actor = catalyst.characters[0]
      }
      for (const mode of ['ordinary', 'ward']) {
        const prepared = prepare(mode)
        expect(prepared.ok, JSON.stringify(prepared.ok ? {} : prepared)).toBe(true)
        if (!prepared.ok) continue
        if (deferred && mode === 'ward') {
          const stale = { ...prepared.prepared, characters: prepared.prepared.characters.map(character => ({ ...character,
            dnd5eInventory: { ...character.dnd5eInventory!, revision: (character.dnd5eInventory?.revision ?? 0) + 1 } })) }
          const rejected = resolvePreparedDnd5ePluginSpellCast({ prepared: stale, rolls: {} })
          expect(rejected.result.ok).toBe(false)
          expect(rejected.application).toBeUndefined()
          expect(rejected.result.state.combatants[caster.id].classResources['dnd5e-spell-slot-2'].current).toBe(2)
        }
        const result = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
        expect(result.result.ok, JSON.stringify(result.result)).toBe(true)
        const diamond = result.application?.characters[0].dnd5eInventory?.entries.find(entry => entry.templateId === materialId)
        expect(diamond?.quantity ?? 0).toBe(mode === 'ward' ? 0 : 1)
        if (mixed) expect(result.application?.characters[0].dnd5eInventory?.entries.find(entry => entry.templateId === catalystId)?.quantity).toBe(1)
        expect(result.application?.characters[0].classResources?.['dnd5e-spell-slot-2'].current).toBe(1)
        if (deferred && mode === 'ward' && result.result.ok && result.application) {
          const escrow = result.application.characters[0].dnd5eInventory?.spellMaterialEscrows?.[0]
          expect(escrow).toMatchObject({ id: 'cast', status: 'reserved', entries: [{ quantity: 1 }] })
          const expiredByClock = advanceDnd5eCampaignTimedActiveEffects(result.application.characters[0], 1)
          expect(expiredByClock.dnd5eInventory?.spellMaterialEscrows?.[0].status).toBe('consumed')
          expect(advanceDnd5eCampaignTimedActiveEffects(expiredByClock, 1).dnd5eInventory?.revision).toBe(expiredByClock.dnd5eInventory?.revision)
          if (concentration) {
            const state = structuredClone(result.result.state), events: Dnd5eCombatEvent[] = []
            endDnd5eConcentration(state, state.combatants[caster.id], events)
            const interrupted = planDnd5eMapResultApplication({ state, map: result.application.map, characters: result.application.characters,
              baselineCharacters: result.application.characters, characterIdByCombatantId: prepared.prepared.characterIdByCombatantId, events })
            expect(interrupted.characters[0].dnd5eInventory?.spellMaterialEscrows?.[0].status).toBe('consumed')
          }
          let ended = resolveDnd5eHeadlessAction(result.result.state, { type: 'end-turn', actorId: caster.id })
          if (concentration && ended.ok) {
            // Existing concentration timing does not spend a full round on the casting turn.
            expect(ended.state.combatants[caster.id].classState.concentrationRoundsRemaining).toBe(1)
            ended = resolveDnd5eHeadlessAction(ended.state, { type: 'end-turn', actorId: caster.id })
          }
          expect(ended.ok, JSON.stringify(ended)).toBe(true)
          if (ended.ok) {
            const applied = planDnd5eMapResultApplication({ state: ended.state, map: result.application.map,
              characters: result.application.characters, baselineCharacters: result.application.characters,
              characterIdByCombatantId: prepared.prepared.characterIdByCombatantId, events: [...ended.events] })
            expect(applied.characters[0].dnd5eInventory?.spellMaterialEscrows?.[0]).toMatchObject({ status: 'consumed', entries: [] })
          }
        }
      }
      expect(actor.dnd5eInventory?.entries.find(entry => entry.templateId === materialId)?.quantity).toBe(1)
      expect(actor.classResources?.['dnd5e-spell-slot-2'].current).toBe(2)
    } finally { dispose() }
  })
})
