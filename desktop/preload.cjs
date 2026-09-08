const { contextBridge, ipcRenderer } = require('electron')

function transferableArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
  }
  return null
}

contextBridge.exposeInMainWorld('astralTraceDesktop', Object.freeze({
  getLauncherState: () => ipcRenderer.invoke('desktop:get-launcher-state'),
  retryLaunch: () => ipcRenderer.invoke('desktop:retry-launch'),
  getRuntimeInfo: () => ipcRenderer.invoke('desktop:get-runtime-info'),
  pluginPackages: Object.freeze({
    put: (input) => ipcRenderer.invoke('desktop:plugin-package:put', input),
    get: async (pluginId, integrity) => {
      const result = await ipcRenderer.invoke('desktop:plugin-package:get', pluginId, integrity)
      if (!result) return null
      return { ...result, bytes: transferableArrayBuffer(result.bytes) }
    },
    remove: (pluginId) => ipcRenderer.invoke('desktop:plugin-package:remove', pluginId),
    list: () => ipcRenderer.invoke('desktop:plugin-package:list'),
  }),
  onLauncherState: (listener) => {
    if (typeof listener !== 'function') return () => undefined
    const handler = (_event, state) => listener(state)
    ipcRenderer.on('desktop:launcher-state', handler)
    return () => ipcRenderer.removeListener('desktop:launcher-state', handler)
  },
}))
