import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

// Exercise the actual native hook without starting Expo. Only the native hook
// scheduler and I/O adapters are substituted; refresh/restore logic is not copied.
function loadSource(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const module = { exports: {} }
  const require = (id) => {
    if (Object.hasOwn(dependencies, id)) return dependencies[id]
    throw new Error(`Missing test adapter: ${id}`)
  }
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(require, module, module.exports)
  return module.exports
}
const root = path.resolve(import.meta.dirname, '..')
const { MobileApiError } = loadSource(path.join(root, 'apps/player-mobile/src/services/mobileHttp.ts'))
const account = { accountId: 'test-account', displayName: '测试玩家', sessionToken: 'test-token', createdAt: 1 }
const room = (id) => ({ roomId: id, roomName: id, memberId: `member-${id}`, roomToken: `token-${id}`, clientId: 'mobile-test', role: 'player', slot: 'player1' })
const rules = { schemaVersion: 1, requiredPlugins: [], member: { ready: true, missing: [] } }
const stored = { serverUrl: 'http://test.invalid', account, room: room('A'), activeCharacterId: null }

async function until(predicate) {
  const deadline = Date.now() + 4_000
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for mobile lifecycle')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

function mount(overrides = {}) {
  const slots = []
  const effects = []
  let cursor = 0
  let queued = false
  let alive = true
  let result
  let cleared = 0
  const saved = []
  const render = () => {
    if (!alive) return
    queued = false
    cursor = 0
    const pending = []
    currentPending = pending
    result = useMobileWorkspace()
    for (const { index, fn, dependencies } of pending) {
      effects[index]?.cleanup?.()
      effects[index] = { dependencies, cleanup: fn() }
    }
  }
  const schedule = () => {
    if (queued || !alive) return
    queued = true
    queueMicrotask(render)
  }
  let currentPending = []
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const hooks = {
    useState(initial) {
      const index = cursor++
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (value) => {
        const next = typeof value === 'function' ? value(slots[index].value) : value
        if (Object.is(next, slots[index].value)) return
        slots[index].value = next
        schedule()
      }]
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useEffect(fn, dependencies) {
      const index = cursor++
      if (!depsEqual(effects[index]?.dependencies, dependencies)) currentPending.push({ index, fn, dependencies })
    },
    useCallback(fn, dependencies) {
      const index = cursor++
      if (!depsEqual(slots[index]?.dependencies, dependencies)) slots[index] = { value: fn, dependencies }
      return slots[index].value
    },
  }
  const api = {
    fetchMobileAccount: async () => account,
    fetchMobileCampaigns: async () => [],
    fetchMobileAccountCharacters: async () => [],
    fetchRoomResourceSnapshot: async (session) => ({ value: { sourceRoom: session.room.roomId }, revision: 1 }),
    fetchVoiceStatus: async () => null,
    fetchMobileRoomRules: async () => rules,
    heartbeatMobileRoom: async () => rules,
    joinMobileRoom: async ({ roomId }) => ({ room: room(roomId), rules }),
    leaveMobileRoom: async () => {},
    logoutMobileAccount: async () => {},
    ...overrides,
  }
  const dependencies = {
    react: hooks,
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '../../../../src/rulesets/dnd5e/levelAdvancement': {},
    '../services/mobileApi': api,
    '../services/mobileHttp': { MobileApiError },
    '../services/pushNotifications': { mobilePushPermissionState: async () => 'unsupported' },
    '../character/createMobileCharacter': {},
    '../services/sessionStore': {
      loadMobileAuthState: async () => stored,
      saveMobileAccount: async (_server, value) => saved.push(value),
      clearMobileAccount: async () => { cleared += 1 },
      clearMobileRoom: async () => {},
      saveMobileRoom: async () => {},
      saveActiveCharacterId: async () => {},
      mobileClientId: async () => 'test-client',
    },
    '../services/workspaceAdapter': { buildMobileWorkspace: ({ credentials, resources, rules }) => ({
      roomId: credentials.room.roomId, characters: [], resources, rules,
    }) },
    '../services/roomEventStream': { subscribeMobileRoomEventStream: () => () => {} },
    '../services/actionRegistry': { buildMobileActionRegistry: async () => ({}), prepareMobileRoomPlugins: async () => {} },
    '../services/mobileRoomPluginRuntime': { clearMobileRoomPluginRuntime() {} },
    '../services/mobileCharacterVault': {},
    '../config': { defaultGameServerUrl: stored.serverUrl, normalizeGameServerUrl: (value) => value },
    '../services/mobileActionCommands': {},
    '../services/mobileExplorationMovement': {},
  }
  const { useMobileWorkspace } = loadSource(path.join(root, 'apps/player-mobile/src/hooks/useMobileWorkspace.ts'), dependencies)
  render()
  return {
    get current() { return result },
    get cleared() { return cleared },
    saved,
    close() {
      alive = false
      for (const effect of effects) effect?.cleanup?.()
    },
  }
}

test('temporary account network failure preserves saved identity and room for recovery', async (t) => {
  const h = mount({ fetchMobileAccount: async () => { throw new MobileApiError({ code: 'network-unavailable', message: 'offline', retriable: true }) } })
  t.after(() => h.close())
  await until(() => h.current.account != null && h.current.connection !== 'restoring')
  assert.equal(h.cleared, 0)
  assert.equal(h.current.account.sessionToken, account.sessionToken)
  await until(() => h.current.workspace?.roomId === 'A')
})

test('an explicit expired account response clears the invalid credential', async (t) => {
  const h = mount({ fetchMobileAccount: async () => { throw new MobileApiError({ code: 'http-error', status: 401, message: 'account-session-invalid' }) } })
  t.after(() => h.close())
  await until(() => h.current.connection === 'offline')
  assert.equal(h.cleared, 1)
  assert.equal(h.current.account, null)
})

test('all resource failures report offline and keep the session', async (t) => {
  const h = mount({ fetchRoomResourceSnapshot: async () => { throw new Error('resource-network-down') } })
  t.after(() => h.close())
  await until(() => h.current.error === 'resource-network-down')
  assert.equal(h.current.connection, 'offline')
  assert.equal(h.current.workspace, null)
  assert.equal(h.cleared, 0)
})

test('delayed high revisions from A cannot overwrite B after changing rooms', async (t) => {
  const delayed = []
  const h = mount({ fetchRoomResourceSnapshot: (session) => session.room.roomId === 'A'
    ? new Promise((resolve) => delayed.push(resolve))
    : Promise.resolve({ value: { sourceRoom: 'B' }, revision: 1 }) })
  t.after(() => h.close())
  await until(() => delayed.length >= 15 && h.current.credentials?.room.roomId === 'A')
  await h.current.joinRoom('B')
  await until(() => h.current.workspace?.roomId === 'B')
  for (const resolve of delayed) resolve({ value: { sourceRoom: 'A' }, revision: 999 })
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(h.current.workspace.roomId, 'B')
  assert.equal(h.current.workspace.resources.maps.sourceRoom, 'B')
  await h.current.refresh()
  await until(() => h.current.connection === 'online')
  assert.equal(h.current.workspace.resources.maps.sourceRoom, 'B')
})

test('pending room responses cannot resurrect a workspace after logout', async (t) => {
  const delayed = []
  const h = mount({ fetchRoomResourceSnapshot: () => new Promise((resolve) => delayed.push(resolve)) })
  t.after(() => h.close())
  await until(() => delayed.length >= 15)
  await h.current.logout()
  for (const resolve of delayed) resolve({ value: { sourceRoom: 'A' }, revision: 999 })
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(h.current.account, null)
  assert.equal(h.current.credentials, null)
  assert.equal(h.current.workspace, null)
  assert.equal(h.current.connection, 'offline')
})

test('a pending account restore cannot sign the user back in after logout', async (t) => {
  let resolveAccount
  const h = mount({ fetchMobileAccount: () => new Promise(resolve => { resolveAccount = resolve }) })
  t.after(() => h.close())
  await until(() => !!resolveAccount)
  await h.current.logout()
  resolveAccount(account)
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(h.current.account, null)
  assert.equal(h.current.credentials, null)
  assert.equal(h.saved.length, 0)
})

test('late restored campaign lists cannot repopulate a logged-out account', async (t) => {
  let resolveCampaigns
  const h = mount({ fetchMobileCampaigns: () => new Promise(resolve => { resolveCampaigns = resolve }) })
  t.after(() => h.close())
  await until(() => !!resolveCampaigns)
  await h.current.logout()
  resolveCampaigns([{ roomId: 'OLD', name: 'Old account' }])
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.deepEqual(h.current.campaigns, [])
  assert.equal(h.current.credentials, null)
  assert.equal(h.current.account, null)
})
