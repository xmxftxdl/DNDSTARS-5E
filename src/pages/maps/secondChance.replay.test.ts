import { secondChanceTestContent } from './secondChance.testFixture';
import { expect, it, vi } from 'vitest';
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e/pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eHeadlessTurnKey, type Dnd5eAction } from '../../rulesets/dnd5e/headlessCombatEngine';
import { createIncomingAttackReplaySession, createIncomingAttackResolutionSession } from './secondChanceReplay.testHelper';
import { resolveAndCommitDnd5eActivityCommand } from '../../rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge';
import { dnd5eActivityActorSnapshotFromCombatantV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityCombatAuthority';
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry';
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability';
import { resolveDnd5eActionWithDamageReactions } from '../../rulesets/dnd5e/damageReactionFlow';
import { createDnd5eConditionEffect } from '../../rulesets/dnd5e/activeEffects';
import { dnd5eCombatantPairKey } from '../../rulesets/dnd5e/headlessCombatPrimitives';
import { createSecondChanceRoomChoiceDriver } from '../../lib/secondChanceRoomChoices';
import { migrateMapsState } from '../../store/maps';
import { normalizeCharacter } from '../../store/characters';
import { createDnd5ePreparedDamageCommitSession } from '../../rulesets/dnd5e/damageCommitSession';
import { dnd5eInventoryEffectRollKey } from '../../rulesets/dnd5e/inventoryHeadlessRuntime';
function fixture(mode: 'normal' | 'advantage' | 'disadvantage' = 'normal') {
    const original = structuredClone(secondChanceTestContent).feats[0];
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.second-real-engine', name: 'Second Chance real engine', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, setup(api) { api.registerFeat({ ...original, automation: 'full', resources: [{ id: 'uses', label: '花开二度', maximum: 1, resetOn: 'short-rest' }], declarativeAbility: { schemaVersion: 1, id: 'incoming', name: original.name, description: original.description, level: 1, trigger: { kind: 'after-d20-roll' }, targeting: { kind: 'self' }, cost: { economy: 'reaction', resources: [{ resourceId: 'uses', amount: 1 }] }, effects: [], automation: 'full', mechanic: { kind: 'incoming-hit-attack-die-reroll' } } }); } });
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 16, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false });
    const attacker = make('attacker', 20), owner = make('owner', 10);
    owner.pluginFeatureIds = ['test.second-real-engine:feat-second-chance'];
    owner.classResources = { 'test.second-real-engine:uses': { current: 1, max: 1 } };
    const state = startDnd5eHeadlessCombat('real-second-chance', [attacker, owner]);
    const action: Dnd5eAction = { type: 'attack', actorId: 'attacker', targetId: 'owner', attackModifier: 5, d20: 18, d20Second: mode === 'normal' ? undefined : 17, mode, damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' } };
    return { state, action, dispose };
}
it.each(['normal', 'advantage', 'disadvantage'] as const)('pauses the original real %s attack before damage and continues the same action once', mode => {
    const f = fixture(mode);
    try {
        const before = structuredClone(f.state), session = createIncomingAttackReplaySession(f.state, f.action), pending = session.run(f.state);
        expect(pending.status).toBe('pending');
        if (pending.status !== 'pending')
            throw Error(JSON.stringify(pending));
        expect(pending.snapshot.combatants.owner.currentHp).toBe(30);
        expect(f.state).toEqual(before);
        expect(pending.facts.dice).toEqual(mode === 'normal' ? [18] : [18, 17]);
        const done = session.resume(f.state, pending.occurrence, pending.facts, { featureId: 'test.second-real-engine:feat-second-chance', dieIndex: 0, newD20: 2 });
        expect(done.status).toBe('resolved');
        if (done.status !== 'resolved')
            throw Error(JSON.stringify(done));
        expect(done.result.ok, JSON.stringify(done.result)).toBe(true);
        expect(done.result.state.combatants.owner.currentHp).toBe(mode === 'advantage' ? 26 : 30);
        expect(done.result.state.combatants.owner.turn.reactionAvailable).toBe(false);
        expect(done.result.state.combatants.owner.classResources['test.second-real-engine:uses'].current).toBe(0);
        expect(done.result.events.filter(event => event.type === 'damage-applied')).toHaveLength(mode === 'advantage' ? 1 : 0);
        expect(session.resume(f.state, pending.occurrence, pending.facts)).toMatchObject({ status: 'rejected', reason: 'session-ended' });
        expect(f.state).toEqual(before);
    }
    finally {
        f.dispose();
    }
});
it.each([true, false])('existing product DamageReactionFlow drives the genuine incoming hit pause and final original attack (use=%s)', async (use) => {
    const f = fixture();
    try {
        let offers = 0;
        const result = await resolveDnd5eActionWithDamageReactions({ state: f.state, action: f.action, combatRevision: 0, authorityUnchanged: () => true, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected extra dice'); }, chooseIncomingAttackReroll: async (request: any) => { offers++; expect(request.facts.event.targetId).toBe('owner'); return use ? { featureId: 'test.second-real-engine:feat-second-chance', dieIndex: 0, newD20: 2 } : undefined; } });
        expect(result.ok, JSON.stringify(result)).toBe(true);
        expect(offers).toBe(1);
        expect(result.state.combatants.owner.currentHp).toBe(use ? 30 : 26);
        expect(result.state.combatants.owner.classResources['test.second-real-engine:uses'].current).toBe(use ? 0 : 1);
    }
    finally {
        f.dispose();
    }
});
it('the concrete room choice driver routes defender consent and attacker die selection separately, rolls one replacement, and asks only new real critical damage dice', async () => {
    const f = fixture('advantage');
    try {
        const map = migrateMapsState({ maps: [{ id: 'map', width: 500, height: 500, gridSize: 50, tokens: [{ id: 'attacker', characterId: 'attacker-char', label: 'Attacker', type: 'player', x: 25, y: 25 }, { id: 'owner', characterId: 'owner-char', label: 'Owner', type: 'player', x: 75, y: 25 }] }] }).maps[0];
        const roster = [normalizeCharacter({ id: 'attacker-char', name: 'Attacker', roomId: 'room', roomMemberId: 'attacker-member' }), normalizeCharacter({ id: 'owner-char', name: 'Owner', roomId: 'room', roomMemberId: 'defender-member' })];
        const choose = vi.fn(async (request: any) => request.id.endsWith(':reaction') ? 'test.second-real-engine:feat-second-chance' : 'die:0');
        const rollD20 = vi.fn(async (..._args: unknown[]) => 20), rollDice = vi.fn(async (..._args: unknown[]) => [5]);
        const driver = createSecondChanceRoomChoiceDriver({ map, characters: () => roster, choose, rollD20, rollDice });
        const result = await resolveDnd5eActionWithDamageReactions({ ...driver, state: f.state, action: f.action, combatRevision: 0, authorityUnchanged: () => true, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected unrelated dice'); } });
        expect(result.ok, JSON.stringify(result)).toBe(true);
        expect(result.state.combatants.owner.currentHp).toBe(21);
        expect(choose.mock.calls[0][0].actor?.id).toBe('owner-char');
        expect(choose.mock.calls[1][0].actor?.id).toBe('attacker-char');
        expect(rollD20).toHaveBeenCalledTimes(1);
        expect(rollD20.mock.calls[0][2]).toMatchObject({ rollerTokenId: 'attacker', rollerCharacterId: 'attacker-char', skipChoiceReroll: true });
        expect(rollDice).toHaveBeenCalledTimes(1);
        expect(rollDice.mock.calls[0].slice(0, 2)).toEqual([1, 6]);
        expect(rollDice.mock.calls[0][4]).toMatchObject({ rollerTokenId: 'attacker', rollerCharacterId: 'attacker-char' });
        expect(result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1);
        expect(result.state.combatants.owner.classResources['test.second-real-engine:uses'].current).toBe(0);
        expect(f.state.combatants.owner.currentHp).toBe(30);
    }
    finally {
        f.dispose();
    }
});
it.each(['cancel', 'disconnect', 'roll-cancel', 'defender-timeout'] as const)('concrete driver keeps a defender-used forced reroll pending on attacker %s', async (boundary) => {
    const f = fixture(boundary === 'roll-cancel' ? 'normal' : 'advantage');
    try {
        const map = migrateMapsState({ maps: [{ id: 'map', width: 500, height: 500, gridSize: 50, tokens: [{ id: 'attacker', characterId: 'attacker-char', type: 'player', x: 25, y: 25 }, { id: 'owner', characterId: 'owner-char', type: 'player', x: 75, y: 25 }] }] }).maps[0];
        const roster = [normalizeCharacter({ id: 'attacker-char', name: 'Attacker' }), normalizeCharacter({ id: 'owner-char', name: 'Owner' })];
        const choose = vi.fn(async (request: any) => request.id.endsWith(':reaction') ? boundary === 'defender-timeout' ? request.defaultOptionId : 'test.second-real-engine:feat-second-chance' : boundary === 'cancel' ? 'cancel' : undefined);
        const driver = createSecondChanceRoomChoiceDriver({ map, characters: () => roster, choose, rollD20: async () => { throw Error('dice-cancelled'); }, rollDice: async () => { throw Error('unexpected dice'); } });
        await expect(resolveDnd5eActionWithDamageReactions({ ...driver, state: f.state, action: f.action, combatRevision: 0, authorityUnchanged: () => true, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected dice'); } })).rejects.toThrow(boundary === 'roll-cancel' ? 'dice-cancelled' : boundary === 'defender-timeout' ? 'reaction-decision-pending' : 'attacker-selection-pending');
        expect(f.state.combatants.owner.currentHp).toBe(30);
        expect(f.state.combatants.owner.classResources['test.second-real-engine:uses'].current).toBe(1);
        expect(f.state.combatants.owner.turn.reactionAvailable).toBe(true);
        expect(f.state.combatants.attacker.turn.actionAvailable).toBe(true);
    }
    finally {
        f.dispose();
    }
});
it.each(['savage', 'brutal', 'sneak', 'inventory'] as const)('a real reroll upgrade preserves the original %s rider and requests only its newly required critical dice', async (rider) => {
    const f = fixture('advantage');
    try {
        if (f.action.type !== 'attack')
            throw Error('expected original attack');
        const actor = f.state.combatants.attacker;
        f.action.classDamageContext = { mode: 'melee', weaponId: 'sword', weaponDamageSides: 6, damageType: 'slashing', finesse: rider === 'sneak', strengthBased: rider !== 'sneak', adjacentEnemyOfTarget: false };
        if (rider === 'savage')
            actor.racialRules = { halflingLucky: false, halfOrcRelentlessEndurance: false, innateSpells: [], ...actor.racialRules, halfOrcSavageAttacks: true };
        if (rider === 'brutal')
            Object.assign(actor, { classId: 'barbarian', classLevels: { barbarian: 9 }, level: 9 });
        if (rider === 'sneak') {
            Object.assign(actor, { classId: 'rogue', classLevels: { rogue: 1 }, level: 1 });
            f.action.classDamageRolls = [{ source: 'sneak-attack', rolls: [3] }];
        }
        if (rider === 'inventory') {
            const resources = { charges: { id: 'charges', label: 'Charges', current: 2, maximum: 2, resetOn: 'long-rest' as const } };
            actor.inventoryHeadlessEffects = [{ instanceId: 'item-1', templateId: 'test:weapon', itemName: 'Flame', equipmentId: 'sword', equippedSlot: 'mainWeapon', effectId: 'flame', resources: structuredClone(resources), effect: { schemaVersion: 1, id: 'flame', kind: 'on-hit-bonus-damage', trigger: 'after-attack-hit', appliesTo: 'attacks-with-this-weapon', damage: { count: 1, sides: 6, bonus: 0 }, damageType: 'fire', doubleDiceOnCritical: true, resourceId: 'charges', resourceCost: 1 } }];
            actor.inventoryResourceSnapshots = [{ instanceId: 'item-1', resources: structuredClone(resources) }];
            actor.inventoryRevision = 0;
            f.action.inventoryEffectRolls = { [dnd5eInventoryEffectRollKey('item-1', 'flame')]: [3] };
        }
        const requests: object[] = [];
        const result = await resolveDnd5eActionWithDamageReactions({ state: f.state, action: f.action, combatRevision: 0, authorityUnchanged: () => true, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unrelated roll'); }, chooseIncomingAttackReroll: async () => ({ featureId: 'test.second-real-engine:feat-second-chance', dieIndex: 0, newD20: 20 }), rollIncomingCriticalDice: async (request: any) => { requests.push(request); return [request.originalRolls[0] === 4 ? 5 : 6]; } });
        expect(result.ok, JSON.stringify(result)).toBe(true);
        expect(requests).toHaveLength(2);
        expect(requests[0]).toMatchObject({ count: 1, sides: 6, originalRolls: [4] });
        expect(result.state.combatants.owner.currentHp).toBe(rider === 'savage' || rider === 'brutal' ? 15 : 12);
        expect(result.state.combatants.owner.classResources['test.second-real-engine:uses'].current).toBe(0);
        if (rider === 'inventory')
            expect(result.state.combatants.attacker.inventoryResourceSnapshots?.[0].resources.charges.current).toBe(1);
        expect(f.state.combatants.owner.currentHp).toBe(30);
    }
    finally {
        f.dispose();
    }
});
it.each(['monster', 'monk', 'spell'] as const)('a real native %s incoming hit can become a miss without rejecting already rolled damage', async (kind) => {
    const f = fixture();
    try {
        const actor = f.state.combatants.attacker;
        f.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'owner')]: 5 };
        let action: Dnd5eAction;
        if (kind === 'monster') {
            actor.statBlockId = 'srd-5.1:goblin';
            actor.controller = 'dm';
            action = { type: 'monster-action', actorId: 'attacker', actionId: 'scimitar', rolls: [{ targetId: 'owner', d20: 18, damageRolls: [[4]] }] };
        }
        else if (kind === 'monk') {
            Object.assign(actor, { classId: 'monk', classLevels: { monk: 2 }, level: 2 });
            actor.classResources['dnd5e-ki'] = { current: 2, max: 2 };
            actor.classState.monkAttackActionTurnKey = dnd5eHeadlessTurnKey(f.state, 'attacker');
            actor.classState.monkMartialArtsTurnKey = dnd5eHeadlessTurnKey(f.state, 'attacker');
            action = { type: 'monk-unarmed-bonus', actorId: 'attacker', mode: 'martial-arts', attackModifier: 5, reachFeet: 5, damageType: 'bludgeoning', damage: { count: 1, sides: 4, bonus: 0 }, attacks: [{ targetId: 'owner', d20: 18, damageRolls: [3] }] };
        }
        else {
            Object.assign(actor, { controller: 'dm', classId: 'wizard', classLevels: { wizard: 1 }, level: 1, saveDc: 13, classSelections: { 'spell-cantrips': ['fire-bolt'] } });
            action = { type: 'cast-spell', actorId: 'attacker', targetId: 'owner', spellId: 'fire-bolt', slotLevel: 0, d20: 18, effectRolls: [4] };
        }
        let offered = 0;
        const result = await resolveDnd5eActionWithDamageReactions({ state: f.state, action, combatRevision: 0, authorityUnchanged: () => true, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected dice'); }, chooseIncomingAttackReroll: async () => { offered++; return { featureId: 'test.second-real-engine:feat-second-chance', dieIndex: 0, newD20: 2 }; } });
        expect(result.ok, JSON.stringify(result)).toBe(true);
        expect(offered, JSON.stringify(result.events)).toBe(1);
        expect(result.state.combatants.owner.currentHp).toBe(30);
        expect(result.state.combatants.owner.classResources['test.second-real-engine:uses'].current).toBe(0);
    }
    finally {
        f.dispose();
    }
});
it.each([false, true])('an Activity upgraded to a critical asks only its missing die and preserves a later actual critical cancellation (cancel=%s)', cancelCritical => {
    const f = fixture();
    let disposeGuard = () => { };
    try {
        if (cancelCritical) {
            disposeGuard = registerDnd5eRulesPlugin({ manifest: { id: 'test.second-critical-guard', name: 'Guard control', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'guardian', classId: 'cleric', name: 'Guardian', summary: 'Control', resources: [{ id: 'uses', label: 'Uses', maximum: { kind: 'fixed', value: 1 }, resetOn: 'long-rest' }], abilities: [{ schemaVersion: 1, id: 'cancel', name: 'Cancel', description: 'Control', level: 6, trigger: { kind: 'after-attack-roll' }, cost: { economy: 'reaction', resources: [{ resourceId: 'uses', amount: 1 }] }, targeting: { kind: 'single-creature', relation: 'ally', includeSelf: true, rangeFeet: 30, requiresSight: true }, mechanic: { kind: 'critical-hit-cancellation', protects: 'ally-or-self' }, effects: [], automation: 'partial' }] }); } });
            f.state.combatants.guard = createDnd5eCombatant({ id: 'guard', name: 'Guard', controller: 'player', initiative: 5, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 }, proficiencyBonus: 3, armorClass: 16, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false, classId: 'cleric', classLevels: { cleric: 6 }, level: 6, pluginFeatureIds: ['test.second-critical-guard:guardian.cancel'], classResources: { 'test.second-critical-guard:uses': { current: 1, max: 1 } } });
            f.state.initiativeOrder = [...f.state.initiativeOrder, 'guard'];
            f.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('guard', 'owner')]: 5 };
        }
        registerDnd5eActivityPackage({ packageId: 'test.second-chance-critical', packageVersion: '1.0.0', activities: [{ schemaVersion: 1, id: 'attack', name: 'Registered critical control', activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 }, automation: automationCapabilityFromLegacyStatus('full'), checks: [{ kind: 'attack-roll', id: 'accuracy', scope: 'per-target', rollId: 'actual-attack-dice', attackBonus: { kind: 'constant', value: 5 }, rollMode: 'normal', attackType: 'spell' }], outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'accuracy', result: 'success' }, operations: [{ id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'actual-damage-dice', count: 1, sides: 6 }, critical: 'double-dice', damageType: 'force' }] }] }] });
        const resolve = (state: typeof f.state) => resolveAndCommitDnd5eActivityCommand(state, { command: { schemaVersion: 1, commandId: 'real-critical-parent', actorId: 'attacker', packageId: 'test.second-chance-critical', packageVersion: '1.0.0', activityId: 'attack', targetIds: ['owner'], expectedRevision: 0 }, currentRevision: 0, actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.attacker), targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.owner)], authoritativeRolls: { 'actual-attack-dice:owner': { values: [18] }, 'actual-damage-dice:owner': { values: [4] } }, distanceFeetByTargetId: { owner: 0 } });
        const session = createDnd5ePreparedDamageCommitSession({ prepared: { state: f.state } }, input => resolve(input.prepared!.state), () => false);
        const pending = session.run(f.state);
        expect(pending.status, JSON.stringify(pending)).toBe('pending-incoming-attack');
        if (pending.status !== 'pending-incoming-attack')
            throw Error('expected true Activity incoming pause');
        const missing = session.resumeIncomingAttack(f.state, pending.occurrence, pending.facts, { featureId: 'test.second-real-engine:feat-second-chance', dieIndex: 0, newD20: 20 });
        expect(missing.status, JSON.stringify(missing)).toBe('pending-incoming-critical-dice');
        if (missing.status !== 'pending-incoming-critical-dice')
            throw Error('expected actual critical dice request');
        expect(missing.request).toMatchObject({ actorId: 'attacker', targetId: 'owner', count: 1, sides: 6, originalRolls: [4] });
        let done = session.resumeIncomingCriticalDice(f.state, missing.request, [5]);
        if (cancelCritical) {
            expect(done.status, JSON.stringify(done)).toBe('pending-critical');
            if (done.status !== 'pending-critical')
                throw Error('expected genuine later guard reaction');
            done = session.resumeCritical(f.state, done.occurrence, done.event, { protectorId: 'guard', featureId: 'test.second-critical-guard:guardian.cancel' });
        }
        expect(done.status, JSON.stringify(done)).toBe('resolved');
        if (done.status !== 'resolved')
            throw Error('expected real Activity commit');
        expect(done.result.phase).toBe('commit');
        expect(done.result.result.ok, JSON.stringify(done.result)).toBe(true);
        if (done.result.phase !== 'commit')
            throw Error('expected actual commit');
        expect(done.result.result.state.combatants.owner.currentHp).toBe(cancelCritical ? 26 : 21);
        expect(done.result.result.state.combatants.owner.classResources['test.second-real-engine:uses'].current).toBe(0);
        expect(session.resumeIncomingCriticalDice(f.state, missing.request, [5])).toMatchObject({ status: 'rejected', reason: 'session-ended' });
        if (cancelCritical)
            expect(done.result.result.state.combatants.guard.classResources['test.second-critical-guard:uses'].current).toBe(0);
    }
    finally {
        clearDnd5eActivityRegistryForTests();
        disposeGuard();
        f.dispose();
    }
});
it('does not offer the reaction to an incapacitated owner and preserves the real automatic-critical damage', () => {
    const f = fixture('advantage');
    try {
        f.state.combatants.owner.classState.activeEffects = [createDnd5eConditionEffect({ id: 'paralysis', condition: 'paralyzed', targetId: 'owner', source: { kind: 'feature', actorId: 'attacker', rulesId: 'test-paralysis', magical: false } })];
        f.state.combatants.owner.conditions = ['paralyzed'];
        f.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'owner')]: 5 };
        if (f.action.type !== 'attack')
            throw Error('expected actual attack');
        f.action.damage.rolls = [4, 5];
        const session = createIncomingAttackReplaySession(f.state, f.action), result = session.run(f.state);
        expect(result.status).toBe('resolved');
        if (result.status === 'resolved') {
            expect(result.result.ok, JSON.stringify(result.result)).toBe(true);
            expect(result.result.state.combatants.owner.classResources['test.second-real-engine:uses'].current).toBe(1);
            expect(result.result.state.combatants.owner.currentHp).toBe(21);
        }
    }
    finally {
        f.dispose();
    }
});
it('rerolls a real natural 20 into an ordinary hit and removes only the original critical extra damage dice', () => {
    const f = fixture();
    try {
        if (f.action.type !== 'attack')
            throw Error('expected actual attack');
        f.action.d20 = 20;
        f.action.damage.rolls = [4, 5];
        const session = createIncomingAttackReplaySession(f.state, f.action), pending = session.run(f.state);
        expect(pending.status).toBe('pending');
        if (pending.status !== 'pending')
            throw Error('expected original critical hit pause');
        const done = session.resume(f.state, pending.occurrence, pending.facts, { featureId: 'test.second-real-engine:feat-second-chance', dieIndex: 0, newD20: 17 });
        expect(done.status).toBe('resolved');
        if (done.status !== 'resolved')
            throw Error('expected final result');
        expect(done.result.ok, JSON.stringify(done.result)).toBe(true);
        expect(done.result.state.combatants.owner.currentHp).toBe(26);
        expect(done.result.events.find(event => event.type === 'attack-resolved')).toMatchObject({ d20: 17, critical: false, hit: true, d20Rolls: [17] });
    }
    finally {
        f.dispose();
    }
});
it.each(['weapon', 'spell'] as const)('the actual unified %s Activity also suspends and resolves original damage with the untouched advantage die', attackType => {
    const f = fixture();
    try {
        registerDnd5eActivityPackage({ packageId: 'test.second-chance-activity', packageVersion: '1.0.0', activities: [{ schemaVersion: 1, id: 'attack', name: 'Registered attack control', activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 }, automation: automationCapabilityFromLegacyStatus('full'), checks: [{ kind: 'attack-roll', id: 'accuracy-check', scope: 'per-target', rollId: 'separate-dice-key', attackBonus: { kind: 'constant', value: 5 }, rollMode: 'advantage', attackType }], outcomes: [{ id: 'damage-on-hit', when: { kind: 'check', checkId: 'accuracy-check', result: 'success' }, operations: [{ id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 4 }, damageType: 'force' }] }] }] });
        const before = structuredClone(f.state);
        const run = (state: typeof f.state) => resolveAndCommitDnd5eActivityCommand(state, { command: { schemaVersion: 1, commandId: 'actual-activity-parent', actorId: 'attacker', packageId: 'test.second-chance-activity', packageVersion: '1.0.0', activityId: 'attack', targetIds: ['owner'], expectedRevision: 0 }, currentRevision: 0, actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.attacker), targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.owner)], authoritativeRolls: { 'separate-dice-key:owner': { values: [18, 17] } }, distanceFeetByTargetId: { owner: 0 } });
        const session = createIncomingAttackResolutionSession(f.state, run), pending = session.run(f.state);
        expect(pending.status, JSON.stringify(pending)).toBe('pending');
        if (pending.status !== 'pending')
            throw Error('expected Activity pause');
        expect(pending.facts.dice).toEqual([18, 17]);
        expect(pending.snapshot.combatants.owner.currentHp).toBe(30);
        const done = session.resume(f.state, pending.occurrence, pending.facts, { featureId: 'test.second-real-engine:feat-second-chance', dieIndex: 0, newD20: 2 });
        expect(done.status).toBe('resolved');
        if (done.status !== 'resolved')
            throw Error('expected Activity result');
        expect(done.result.phase).toBe('commit');
        expect(done.result.result.ok, JSON.stringify(done.result)).toBe(true);
        if (done.result.phase !== 'commit')
            throw Error('expected actual commit');
        expect(done.result.result.state.combatants.owner.currentHp).toBe(26);
        expect(done.result.result.state.combatants.owner.turn.reactionAvailable).toBe(false);
        expect(done.result.result.state.combatants.owner.classResources['test.second-real-engine:uses'].current).toBe(0);
        expect(f.state).toEqual(before);
    }
    finally {
        clearDnd5eActivityRegistryForTests();
        f.dispose();
    }
});
