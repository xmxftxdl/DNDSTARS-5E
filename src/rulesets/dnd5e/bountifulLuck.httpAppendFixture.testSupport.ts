/// <reference types="node" />
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { vi } from 'vitest';
import type { SharedPlayerActionRequestQueueState, SharedPlayerActionState } from '../../lib/sharedCombatTypes';
import { validateBountifulLuckCommand } from '../../../shared/bountiful-luck-state.mjs';
import { createHash, randomBytes } from 'node:crypto';
import { handleSharedApi, SHARED_PROTOCOL_VERSION } from '../../../scripts/shared-server-core.mjs';
function dataRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function assertBountifulHttpAction(value: unknown): asserts value is SharedPlayerActionState {
    if (!dataRecord(value) || !['id', 'mapId', 'combatId', 'actorTokenId', 'characterId'].every(key => typeof value[key] === 'string' && !!value[key]) || value.type !== 'dnd5e-bountiful-luck' || value.status !== 'pending' || !['dm', 'player'].includes(String(value.sourceMode)) || !['round', 'initiativeIndex', 'seq', 'updatedAt'].every(key => typeof value[key] === 'number' && Number.isSafeInteger(value[key])) || !validateBountifulLuckCommand(value.bountifulLuck))
        throw Error('Expected actual native Bountiful client action');
}
/** Runs the actual authenticated HTTP router without starting a listener. All
 * private documents come from the real prepared-parent issuer in the test. */
export async function bountifulHttpAppendFixture() {
    const base = path.resolve(os.tmpdir(), 'stars-bountiful-http-append');
    await fs.mkdir(base, { recursive: true });
    const root = await fs.mkdtemp(path.join(base, 'room-')), stateRoot = path.join(root, 'rooms', 'room'), lobbyRoot = path.join(root, 'lobby');
    await fs.mkdir(stateRoot, { recursive: true });
    await fs.mkdir(lobbyRoot, { recursive: true });
    const members = ['host', 'ally-member', 'first-member', 'second-member', 'target-member', 'spectator'];
    const tokens = new Map(members.map(member => [member, randomBytes(32).toString('base64url')]));
    const entry = (memberId: string) => ({ memberId, role: memberId === 'spectator' ? 'spectator' : 'player', roomTokenHash: createHash('sha256').update(tokens.get(memberId)!).digest('hex') });
    await fs.writeFile(path.join(lobbyRoot, 'room.json'), JSON.stringify({ id: 'room', host: entry('host'), players: members.filter(member => member !== 'host').map(entry) }));
    const ctx = { stateRoot: root, lobbyRoot, imageRoot: root, legacyStateRoot: root, legacyImageRoot: root, quarantineRoot: root, snapshotRoot: root, eventClients: new Map(), eventBacklog: new Map(), eventSequences: new Map(), rateLimits: new Map() };
    return {
        async append(action: unknown, data: Record<string, unknown>, memberId: string, tokenOverride?: string) {
            await Promise.all(Object.entries(data).map(([name, value]) => fs.writeFile(path.join(stateRoot, name + '.json'), JSON.stringify(value))));
            const socket = new Socket(), req = new IncomingMessage(socket);
            req.method = 'POST';
            req.headers = { 'x-stars-member': memberId, 'x-stars-room-token': tokenOverride ?? tokens.get(memberId) ?? 'unknown', 'x-stars-protocol': String(SHARED_PROTOCOL_VERSION) };
            req.push(Buffer.from(JSON.stringify({ action })));
            req.push(null);
            const res = new ServerResponse(req);
            let body = '';
            const end = vi.spyOn(res, 'end').mockImplementation((value?: unknown) => { body = String(value ?? ''); return res; });
            try {
                await handleSharedApi(req, res, new URL('http://localhost/api/state/player-action-requests/append?room=room'), ctx);
                const queue: SharedPlayerActionRequestQueueState & {
                    _sync: {
                        revision: number;
                    };
                    [key: string]: unknown;
                } = JSON.parse(await fs.readFile(path.join(stateRoot, 'player-action-requests.json'), 'utf8'));
                if (!queue || !Array.isArray(queue.requests) || !Number.isSafeInteger(queue._sync?.revision))
                    throw Error('Actual append returned no synced queue');
                return { status: res.statusCode, payload: JSON.parse(body), queue };
            }
            finally {
                end.mockRestore();
                socket.destroy();
            }
        },
        async close() { if (path.dirname(root) !== base || !path.basename(root).startsWith('room-'))
            throw Error('Outside isolated test root'); await fs.rm(root, { recursive: true, force: true, maxRetries: 4, retryDelay: 20 }); },
    };
}
