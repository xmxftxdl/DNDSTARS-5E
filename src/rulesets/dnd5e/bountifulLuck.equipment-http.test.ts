import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import { bountifulHttpAppendFixture, assertBountifulHttpAction } from './bountifulLuck.httpAppendFixture.testSupport';
import { isBountifulEquipmentContext } from './bountifulLuckClientCommands';
import { createBountifulEquipmentRoomUI } from './bountifulEquipmentRoomUI';
import { submitBountifulEquipmentChoice, submitBountifulOwnedDiceResult } from './bountifulLuckClientCommands';
import { projectBountifulOriginalPrompts } from '../../../shared/bountiful-luck-state.mjs';
import { createDmDiceConfirmationQueue } from '../../presentation/maps/dmDiceConfirmationQueue';
import { driveBountifulEquipmentContinuation, ensureBountifulEquipmentContinuation } from './bountifulEquipmentContinuationHost';
import { bountifulEquipmentD20RollId } from './bountifulEquipmentD20Receipt';
import { validateBountifulOriginalParents } from '../../../shared/bountiful-luck-state.mjs';
import { dnd5eWeaponAttackProfile } from './equipment';
import type { Character } from '../../types/character';
import { durableD20RollId } from '../../lib/rollConfirmation';
import { syncCharacterClassResources } from '../../lib/classResources';
import { beginBountifulEquipmentOriginal } from './bountifulLuckEquipmentOriginal';
import { it, expect, vi } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { normalizeCharacter } from '../../store/characters';
import { prepareDnd5eEquipmentAttack } from './equipmentAttackAction';
import { applyDnd5eInventoryMutation } from './items';
import type { BattleMap } from '../../store/maps';
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes';
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway';
import { driveBountifulOriginalParent, BountifulOriginalParentPending } from './bountifulLuckPersistentRoomDriver';
import { bountifulOriginalDieRollId, nextBountifulOriginalDieOwner, type BountifulOriginalDieReceipt } from './bountifulLuckReceipt';
const session = vi.hoisted(() => ({ value: { roomId: 'room', memberId: 'host', role: 'dm' } }));
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => session.value }));
function hero(options: {
    current?: number;
    attuned?: boolean;
    identified?: boolean;
} = {}): Character {
    return normalizeCharacter({
        id: 'hero',
        name: 'Hero',
        player: 'Player',
        charClass: 'Fighter',
        level: 1,
        maxHp: 12,
        currentHp: 12,
        equipment: {
            mainWeapon: {
                id: 'plugin:blade',
                name: 'Fate Blade',
                slot: 'mainWeapon',
                dnd5e: {
                    kind: 'weapon', category: 'martial', mode: 'melee',
                    damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str', reachFeet: 5,
                },
            },
        },
        dnd5eInventory: {
            schemaVersion: 3,
            revision: 0,
            entries: [{
                    instanceId: 'blade-1',
                    templateId: 'plugin:blade',
                    quantity: 1,
                    acquiredAt: 1,
                    equippedSlot: 'mainWeapon',
                    attuned: options.attuned ?? true,
                    identified: options.identified ?? true,
                    item: {
                        id: 'plugin:blade',
                        name: 'Fate Blade',
                        category: 'equipment',
                        icon: 'weapon',
                        description: 'Test item',
                        rulesText: 'Test item',
                        stackable: false,
                        equipment: {
                            id: 'plugin:blade',
                            name: 'Fate Blade',
                            slot: 'mainWeapon',
                            dnd5e: {
                                kind: 'weapon', category: 'martial', mode: 'melee',
                                damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str', reachFeet: 5,
                            },
                        },
                        magicItem: { kind: 'weapon', rarity: 'rare', attunement: 'required', automation: 'headless' },
                        resources: [{ id: 'charges', label: 'Charges', maximum: 4, resetOn: 'dawn' }],
                        headlessEffects: [{
                                schemaVersion: 1,
                                id: 'attack-reroll',
                                kind: 'attack-roll-reroll',
                                resourceId: 'charges',
                                maximumDice: 1,
                                trigger: 'after-attack-roll',
                                appliesTo: 'attacks-with-this-weapon',
                            }],
                        source: { book: 'Test', license: 'CC0' },
                    },
                    resources: {
                        charges: {
                            id: 'charges', label: 'Charges', current: options.current ?? 4, maximum: 4, resetOn: 'dawn',
                        },
                    },
                }],
        },
    });
}
it.each([17, 1, 0, -1])('actual BL finalized die remains protected while an independent original die uses a real active charged equipment source (%i)', async (replacement) => {
    const newValue = replacement === -1 ? 1 : replacement;
    session.value = { roomId: 'room', memberId: 'host', role: 'dm' };
    const { package: pkg } = await prepareDnd5eLocalContentJson("{\"name\":\"DM 本地规则\",\"version\":\"1.0.0\",\"races\":[],\"backgrounds\":[],\"features\":[],\"feats\":[{\"id\":\"bountiful-luck\",\"name\":\"慷慨吉运\",\"summary\":\"半身人可用反应帮助附近可见盟友重骰攻击、技能或豁免检定中掷出的1。\",\"description\":\"先决条件为半身人。当你周围30尺内你可见的盟友在攻击检定、技能检定或豁免检定的d20中掷出1时，你可以使用反应使其重骰一次；盟友必须接受新的结果。使用此能力后，直到你的下个回合结束前，你无法使用幸运种族特性。\",\"automation\":\"full\",\"prerequisite\":{\"raceIds\":[\"halfling\"]},\"declarativeAbility\":{\"schemaVersion\":1,\"id\":\"bountiful-luck\",\"name\":\"慷慨吉运\",\"description\":\"先决条件为半身人。当你周围30尺内你可见的盟友在攻击检定、技能检定或豁免检定的d20中掷出1时，你可以使用反应使其重骰一次；盟友必须接受新的结果。使用此能力后，直到你的下个回合结束前，你无法使用幸运种族特性。\",\"level\":1,\"trigger\":{\"kind\":\"after-d20-roll\"},\"cost\":{\"economy\":\"reaction\"},\"targeting\":{\"kind\":\"single-creature\",\"relation\":\"ally\",\"rangeFeet\":30,\"requiresSight\":true,\"includeSelf\":false},\"effects\":[],\"automation\":\"full\",\"mechanic\":{\"kind\":\"ally-natural-one-reroll\"}}}],\"spells\":[],\"items\":[],\"abilityGenerationMethods\":[],\"headlessActions\":[],\"activities\":[],\"classes\":[],\"subclasses\":[],\"monsters\":[]}");
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg));
    const disposeExtra = registerDnd5eRulesPlugin({ manifest: { id: 'test.bound-extra', name: 'Extra die', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0' }, setup(api) { api.registerFeat({ id: 'accuracy', name: 'Extra die', summary: 'Extra die', description: 'A real registered advantage-only test feature', automation: 'full', resources: [{ id: 'uses', label: 'Uses', maximum: 1, resetOn: 'long-rest' }], declarativeAbility: { schemaVersion: 1, id: 'accuracy', name: 'Extra die', description: 'Extra die', level: 1, trigger: { kind: 'after-d20-roll' }, targeting: { kind: 'self' }, effects: [], automation: 'full', cost: { economy: 'none', resources: [{ resourceId: 'uses', amount: 1 }] }, mechanic: { kind: 'd20-choice-reroll', rollKinds: ['attack'], scopes: ['self-roll'], additionalDice: 1, selection: 'highest', requiresAdvantage: true, attackAbilities: ['dex', 'int', 'wis', 'cha'] } } }); } });
    try {
        const make = (id: string, feat: boolean) => normalizeCharacter({ id, name: id, roomMemberId: id + '-member', race: '半身人', dnd5eRaceId: 'halfling', charClass: '战士', level: 4, abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, currentHp: 30, maxHp: 30, dnd5eFeatIds: feat ? [pkg.manifest.id + ':bountiful-luck'] : [] });
        const actor = syncCharacterClassResources({ ...make('ally', false), rulesetId: 'dnd5e-2014-srd-5.1', dnd5eFeatIds: ['test.bound-extra:accuracy'] });
        actor.race = '人类';
        actor.dnd5eRaceId = 'human';
        actor.inspiration = 1;
        actor.dnd5eCombatState = { bardicInspirationDie: 6, bardicInspirationSourceId: 'first-token', bardicInspirationRoundsRemaining: 10 };
        actor.equipment = hero().equipment;
        actor.dnd5eInventory = hero().dnd5eInventory;
        if (replacement === -1)
            actor.roomMemberId = 'host';
        const characters = [applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id, templateId: 'srd-5.1:item:arrows', quantity: 20 }).characters[0], make('first', true), make('second', true), make('target', false)];
        const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: characters.map((c, index) => ({ id: c.id + '-token', characterId: c.id, type: index === 3 ? 'enemy' : 'player', label: c.name, x: index === 0 ? 25 : index === 3 ? 75 : index === 1 ? 125 : 175, y: 25, size: 1, color: '', emoji: '' })) };
        const action: SharedPlayerActionState = { id: 'parent', mapId: 'map', combatId: 'combat', sourceMode: replacement === -1 ? 'dm' : 'player', status: 'pending', roomMemberId: replacement === -1 ? 'host' : 'ally-member', type: 'dnd5e-weapon-attack', actorTokenId: 'ally-token', characterId: 'ally', targetTokenId: 'target-token', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
        const prepared = prepareDnd5eEquipmentAttack({ action, map, characters, attacksUsed: 0, initiativeOrder: map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - index })) });
        if (!prepared.ok)
            throw Error(prepared.reason + ': ' + JSON.stringify({ profile: dnd5eWeaponAttackProfile(characters[0]), weapon: characters[0].equipment?.mainWeapon }));
        prepared.prepared.attackMode = 'advantage';
        type Resource = {
            _sync: {
                revision: number;
            };
            [key: string]: unknown;
        };
        let data: Record<string, Resource> = { combat: { _sync: { revision: 1 }, active: true, mapId: 'map', combatId: 'combat', round: 1, initiativeIndex: 0 }, characters: { _sync: { revision: 2 }, characters }, maps: { _sync: { revision: 3 }, maps: [map] }, 'player-action-requests': { _sync: { revision: 4 }, requests: [action] } };
        data['player-action-ack'] = { _sync: { revision: 0 }, id: '' };
        data['player-action-processed'] = { _sync: { revision: 0 }, actionIds: [] };
        const writes: string[][] = [];
        const gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'> = { loadResource: async <T>(name: string) => structuredClone(data[name] ?? null) as T, saveResourcesAtomically: async (batch, options) => { for (const write of batch)
                expect(write.expectedRevision).toBe(data[write.name]._sync.revision); for (const [name, value] of Object.entries(options?.readRevisions ?? {}))
                expect(data[name]?._sync.revision ?? 0).toBe(value); const next = structuredClone(data); for (const write of batch)
                next[write.name] = { ...write.data as object, _sync: { revision: data[write.name]._sync.revision + 1 } }; data = next; writes.push(batch.map(row => row.name)); return { status: 'committed', transactionId: options?.transactionId ?? '', revisions: {} }; } };
        const rawRollId = durableD20RollId({ mapId: 'map', sourceMode: 'dm', transactionId: 'parent', occurrenceIndex: 0 }) + ':pool:2d20';
        const source = { prepared: prepared.prepared, d20: 1, d20Second: 1, damageRolls: [] as number[], ...captureBountifulOriginalRawIssuer({mapId:'map',parentId:'parent',mode:'dm',rollId:rawRollId,cursor:1,raw:[1,1]}) };
        await expect(beginBountifulEquipmentOriginal({ action, source }, gateway, { showChoice: async () => { }, requestRoll: async () => { } })).rejects.toBeInstanceOf(BountifulOriginalParentPending);
        const untouched = structuredClone(data.characters), sequence: string[] = [], rolls: string[] = [];
        const append = (receipt: BountifulOriginalDieReceipt, actorTokenId: string, characterId: string, memberId: string, command: object) => {
            const rows = data['player-action-requests'].requests as object[];
            data['player-action-requests'].requests = [...rows, { id: 'response-' + rows.length, roomMemberId: memberId, type: 'dnd5e-bountiful-luck', status: 'pending', sourceMode: 'player', mapId: 'map', combatId: 'combat', actorTokenId, characterId, bountifulLuck: { parentId: 'parent', occurrence: receipt.identity.occurrence, command } }];
        };
        // A closed or unanswered UI does not manufacture a decline or any cost.
        await expect(driveBountifulOriginalParent({ mapId: 'map', parentId: 'parent' }, gateway, { showChoice: async () => { }, requestRoll: async () => { } })).rejects.toBeInstanceOf(BountifulOriginalParentPending);
        expect(data.characters).toEqual(untouched);
        const stage = await beginBountifulEquipmentOriginal({ action, source }, gateway, {
            showChoice: async (receipt) => { const next = nextBountifulOriginalDieOwner(receipt); if (!next)
                throw Error('No real owner'); sequence.push(next.ownerId + ':' + receipt.request.dieIndex); const control = receipt.controllers[next.ownerId]; append(receipt, next.ownerId, control.characterId, control.memberId, { phase: 'reaction', ...next, decision: receipt.request.dieIndex === 0 ? 'use' : 'decline' }); },
            requestRoll: async (receipt, refresh) => { rolls.push(receipt.identity.roller.tokenId + ':' + receipt.request.dieIndex); const roller = receipt.identity.roller, id = bountifulOriginalDieRollId(receipt), value = 1; append(receipt, roller.tokenId, requireCharacterRoller(roller), roller.memberId, { phase: 'roll', rollRequestId: id, value }); const fresh = await refresh(); expect(fresh.rawReroll?.memberId).toBe(replacement === -1 ? 'host' : 'ally-member'); append(fresh, roller.tokenId, requireCharacterRoller(roller), 'host', { phase: 'confirm', rollRequestId: id, rawValue: value, value }); }
        });
        if (!stage)
            throw Error('Real equipment raw did not issue its private parent');
        expect(stage.originalReady).toMatchObject({ rollMode: 'advantage', finalizedDice: [0], values: [1, 1] });
        const persisted = await ensureBountifulEquipmentContinuation({ mapId: 'map', parentId: 'parent' }, gateway);
        if (!persisted)
            throw Error('Real gear stage was not persisted');
        expect(persisted.candidates[0].dieIndices).toEqual([1]);
        expect(validateBountifulOriginalParents(data.combat.bountifulOriginalParents)).toBe(true);
        expect(validateBountifulOriginalParents({ bad: { schemaVersion: 1, identity: null } })).toBe(false);
        const stageUnchanged = structuredClone(data.characters);
        await expect(driveBountifulEquipmentContinuation({ mapId: 'map', parentId: 'parent' }, gateway, { showChoice: async () => { }, requestRoll: async () => { } })).rejects.toBeInstanceOf(BountifulOriginalParentPending);
        expect(data.characters).toEqual(stageUnchanged);
        const http = await bountifulHttpAppendFixture();
        try {
            const rejected = { id: 'bad-host', mapId: 'map', combatId: 'combat', type: 'dnd5e-weapon-attack', status: 'pending', sourceMode: 'dm', roomMemberId: 'host', actorTokenId: 'ally-token', characterId: 'ally', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
            expect((await http.append(rejected, data, 'host')).status).toBe(403);
            const forged = { ...rejected, type: 'dnd5e-bountiful-luck', bountifulLuck: { parentId: 'parent', occurrence: persisted.identity.sourceOccurrence, command: { phase: 'equipment-confirm', promptId: persisted.id, rollRequestId: bountifulEquipmentD20RollId(persisted), rawValue: 1, value: 20 } } };
            for (const member of ['host', 'ally-member', 'spectator'])
                expect((await http.append(forged, data, member)).status).toBe(403);
            expect((await http.append(forged, data, 'host', 'invalid-token')).status).toBe(403);
            expect(data.characters).toEqual(stageUnchanged);
            const client = { loadResource: async <T>(name: string) => {
                    if (name === 'combat')
                        return { bountifulLuckPrompts: projectBountifulOriginalPrompts(data.combat.bountifulOriginalParents, session.value.memberId) } as T;
                    return structuredClone(data[name] ?? null) as T;
                }, appendPlayerActionRequest: async (action: unknown) => {
                    assertBountifulHttpAction(action);
                    if (session.value.role === 'dm') {
                        const changed = structuredClone(data);
                        changed.maps._sync.revision++;
                        expect((await http.append({ ...action, id: action.id + ':stale' }, changed, 'host')).status).toBe(403);
                        for (const override of [{ mapId: 'foreign' }, { combatId: 'foreign' }, { actorTokenId: 'first-token' }, { characterId: 'first' }, { round: 2 }, { initiativeIndex: 1 }])
                            expect((await http.append({ ...action, ...override, id: action.id + ':foreign' }, data, 'host')).status).toBe(403);
                        const ownerSpoof = structuredClone(data);
                        const roster = ownerSpoof.characters.characters as Character[], owner = roster.find(row => row.id === 'ally');
                        if (!owner)
                            throw Error('Real original actor missing');
                        owner.roomMemberId = 'first-member';
                        if (action.bountifulLuck?.command.phase === 'equipment-choice' || action.bountifulLuck?.command.phase === 'equipment-roll')
                            expect((await http.append({ ...action, id: action.id + ':owner-changed' }, ownerSpoof, 'host')).status).toBe(403);
                    }
                    const response = await http.append(action, data, session.value.memberId);
                    if (response.status !== 200)
                        throw Error('actual authenticated append: ' + JSON.stringify(response.payload));
                    const saved = response.queue.requests.find(row => row.id === action.id);
                    if (!saved)
                        throw Error('Actual server did not persist the client action');
                    expect(saved.roomMemberId).toBe(session.value.memberId);
                    expect(saved.sourceMode).toBe(session.value.role === 'dm' ? 'dm' : 'player');
                    data['player-action-requests'] = response.queue;
                    const repeated = await http.append({ ...action, updatedAt: action.updatedAt + 1 }, data, session.value.memberId);
                    expect(repeated.status).toBe(200);
                    expect(repeated.queue.requests.filter(row => row.id === action.id)).toHaveLength(1);
                    if (session.value.role === 'dm') {
                        const command = action.bountifulLuck?.command;
                        const foreign = { ...action, bountifulLuck: { ...action.bountifulLuck, command: command?.phase === 'equipment-choice' ? { phase: 'equipment-choice', promptId: command.promptId, decision: 'keep' } : { ...command, value: 2 } } };
                        expect((await http.append(foreign, data, session.value.memberId)).status).toBe(403);
                    }
                    data['player-action-requests'] = response.queue;
                } };
            let choices = 0, rawRolls = 0, confirmations = 0;
            const confirm = createDmDiceConfirmationQueue(async (request) => { confirmations++; expect(request.values).toEqual([newValue]); return request.values; });
            const ui = createBountifulEquipmentRoomUI({ map, characters: () => characters, gateway: client, round: () => 1, initiativeIndex: () => 0,
                choose: async (request) => {
                    choices++;
                    expect(request.defaultOptionId).toBe('pending');
                    expect(request.audience).toBe(replacement === -1 ? 'dm' : 'actor');
                    expect(request.actor?.id).toBe('ally');
                    const selected = replacement === 0 ? 'keep' : JSON.stringify(['reroll', 'blade-1', 'attack-reroll', 'charges', 1]);
                    expect(request.options.map(row => row.id)).toContain(selected);
                    expect(request.options.map(row => row.id)).not.toContain(JSON.stringify(['reroll', 'blade-1', 'attack-reroll', 'charges', 0]));
                    session.value = replacement === -1 ? { roomId: 'room', memberId: 'host', role: 'dm' } : { roomId: 'room', memberId: 'ally-member', role: 'player' };
                    const context = request.context?.bountifulEquipment;
                    if (!isBountifulEquipmentContext(context))
                        throw Error('Actual gear context missing');
                    await submitBountifulEquipmentChoice({ mapId: 'map', context, optionId: selected, round: 1, initiativeIndex: 0 }, client);
                    session.value = { roomId: 'room', memberId: 'host', role: 'dm' };
                    return selected;
                },
                rollD20: async (_label, _targetName, owner) => {
                    rawRolls++;
                    expect(owner.rollerTokenId).toBe('ally-token');
                    expect(owner.skipChoiceReroll).toBe(true);
                    expect(owner.durableRollRequestId).toBe(bountifulEquipmentD20RollId(persisted));
                    if (replacement === -1) {
                        expect(owner.skipDmConfirmation).toBe(true);
                        return newValue;
                    }
                    const input = { mapId: 'map', combatId: 'combat', requestId: owner.durableRollRequestId, characterId: 'first', values: [newValue], round: 1, initiativeIndex: 0 };
                    session.value = { roomId: 'room', memberId: 'first-member', role: 'player' };
                    expect(await submitBountifulOwnedDiceResult(input, client)).toBeUndefined();
                    session.value = { roomId: 'room', memberId: 'ally-member', role: 'player' };
                    await submitBountifulOwnedDiceResult({ ...input, characterId: 'ally' }, client);
                    session.value = { roomId: 'room', memberId: 'host', role: 'dm' };
                    throw Error('deliberate UI disconnect after original player raw append');
                },
                confirmRetainedD20: async (id, label, targetName, value) => (await confirm({ id, label, targetName, sides: 20, values: [value], visibility: 'public' }))[0],
            });
            if (replacement !== 0 && replacement !== -1) {
                await expect(driveBountifulEquipmentContinuation({ mapId: 'map', parentId: 'parent' }, gateway, ui)).rejects.toBeInstanceOf(BountifulOriginalParentPending);
                expect(data.characters).toEqual(stageUnchanged);
                expect(confirmations).toBe(0);
            }
            // A newly constructed real Room UI consumes the persisted original-player
            // raw once, through the actual DM confirmation queue, without a fresh roll.
            const completed = await driveBountifulEquipmentContinuation({ mapId: 'map', parentId: 'parent' }, gateway, ui);
            expect(completed.retainedDice).toEqual(replacement === 0 ? [1, 1] : [1, newValue]);
            expect(choices).toBe(1);
            expect(rawRolls).toBe(replacement === 0 ? 0 : 1);
            expect(confirmations).toBe(replacement === 0 ? 0 : 1);
            expect(data.characters).toEqual(stageUnchanged);
            expect(writes.filter(names => names.includes('characters'))).toHaveLength(0);
            expect(projectBountifulOriginalPrompts(data.combat.bountifulOriginalParents, 'ally-member')).toEqual([]);
        }
        finally {
            await http.close();
        }
    }
    finally {
        disposeExtra();
        dispose();
    }
});

function requireCharacterRoller(roller:{characterId?:string}){if(!roller.characterId)throw Error("This Character-only fixture requires its actual Character roller");return roller.characterId}
