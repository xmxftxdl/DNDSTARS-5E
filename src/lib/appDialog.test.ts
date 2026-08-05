import { afterEach, describe, expect, it } from 'vitest'
import {
  getAppDialogSnapshot,
  resetAppDialogsForTests,
  settleAppDialog,
  showAppAlert,
  showAppConfirm,
  showAppPrompt,
  subscribeToAppDialogs,
} from './appDialog'

afterEach(() => resetAppDialogsForTests())

describe('app dialog queue', () => {
  it('queues dialogs and resolves them in display order', async () => {
    const updates: number[] = []
    const unsubscribe = subscribeToAppDialogs(() => {
      updates.push(getAppDialogSnapshot().queuedCount)
    })
    const confirm = showAppConfirm('确认继续？')
    const prompt = showAppPrompt('输入名称', '默认名称')

    const first = getAppDialogSnapshot()
    expect(first.active).toMatchObject({ kind: 'confirm', message: '确认继续？' })
    expect(first.queuedCount).toBe(1)
    expect(settleAppDialog(first.active!.id, true)).toBe(true)
    await expect(confirm).resolves.toBe(true)

    const second = getAppDialogSnapshot()
    expect(second.active).toMatchObject({ kind: 'prompt', defaultValue: '默认名称' })
    expect(settleAppDialog(second.active!.id, '新名称')).toBe(true)
    await expect(prompt).resolves.toBe('新名称')
    expect(getAppDialogSnapshot()).toEqual({ active: null, queuedCount: 0 })
    expect(updates.length).toBeGreaterThanOrEqual(4)
    unsubscribe()
  })

  it('keeps prompt cancellation distinct from an empty value', async () => {
    const cancelled = showAppPrompt('输入内容')
    const cancelledRequest = getAppDialogSnapshot().active!
    settleAppDialog(cancelledRequest.id, null)
    await expect(cancelled).resolves.toBeNull()

    const empty = showAppPrompt('输入内容')
    const emptyRequest = getAppDialogSnapshot().active!
    settleAppDialog(emptyRequest.id, '')
    await expect(empty).resolves.toBe('')
  })

  it('provides application defaults without calling browser dialog APIs', async () => {
    const alert = showAppAlert('保存完成')
    const request = getAppDialogSnapshot().active!
    expect(request).toMatchObject({
      kind: 'alert',
      title: '提示',
      confirmLabel: '知道了',
      message: '保存完成',
    })
    settleAppDialog(request.id, true)
    await expect(alert).resolves.toBeUndefined()
  })
})
