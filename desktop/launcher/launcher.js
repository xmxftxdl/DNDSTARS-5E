const message = document.querySelector('#launcher-message')
const detail = document.querySelector('#launcher-detail')
const progress = document.querySelector('#launcher-progress')
const retry = document.querySelector('#launcher-retry')

function render(state) {
  if (!state) return
  message.textContent = state.message || '正在启动…'
  detail.textContent = state.detail || 'DM 与玩家通用 · 在线客户端'
  progress.style.width = `${Math.max(4, Math.min(100, Number(state.progress) || 4))}%`
  retry.hidden = !state.retriable
  retry.disabled = state.phase === 'retrying'
}

retry.addEventListener('click', async () => {
  retry.disabled = true
  await window.astralTraceDesktop.retryLaunch()
})

window.astralTraceDesktop.onLauncherState(render)
window.astralTraceDesktop.getLauncherState().then(render)
