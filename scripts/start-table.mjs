import { spawn } from 'node:child_process'

const servers = [
  { name: 'DM', port: 5273, env: { VITE_APP_MODE: 'dm' } },
  { name: '玩家1', port: 5274, env: { VITE_APP_MODE: 'player', VITE_PLAYER_SLOT: 'player1' } },
  { name: '玩家2', port: 5275, env: { VITE_APP_MODE: 'player', VITE_PLAYER_SLOT: 'player2' } },
  { name: '玩家3', port: 5276, env: { VITE_APP_MODE: 'player', VITE_PLAYER_SLOT: 'player3' } },
]

const children = servers.map((server) => {
  const child = spawn(
    process.execPath,
    [
      'scripts/vite-server.mjs',
      '--host',
      '127.0.0.1',
      '--port',
      String(server.port),
      '--strictPort',
      '--art-asset-root',
      'public',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...server.env,
      },
    },
  )
  child.on('exit', (code, signal) => {
    if (code != null && code !== 0) {
      console.error(`[${server.name}] exited with code ${code}`)
    } else if (signal) {
      console.error(`[${server.name}] exited from ${signal}`)
    }
  })
  return child
})

const close = () => {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}

process.on('SIGINT', () => {
  close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  close()
  process.exit(0)
})

