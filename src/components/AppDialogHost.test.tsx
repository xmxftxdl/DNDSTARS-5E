import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getAppDialogSnapshot,
  resetAppDialogsForTests,
  settleAppDialog,
  showAppConfirm,
  showAppPrompt,
} from '../lib/appDialog'
import AppDialogHost from './AppDialogHost'

afterEach(() => resetAppDialogsForTests())

describe('AppDialogHost', () => {
  it('renders an accessible in-app confirmation above application overlays', async () => {
    const pending = showAppConfirm({
      title: '删除地图',
      message: '此操作无法撤销。',
      confirmLabel: '删除',
      tone: 'danger',
    })
    const html = renderToStaticMarkup(<AppDialogHost />)

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('z-[200000]')
    expect(html).toContain('删除地图')
    expect(html).toContain('此操作无法撤销。')
    expect(html).toContain('data-testid="app-dialog-cancel"')

    const request = getAppDialogSnapshot().active!
    settleAppDialog(request.id, false)
    await expect(pending).resolves.toBe(false)
  })

  it('renders prompt defaults inside the application dialog', async () => {
    const pending = showAppPrompt('命名场景', '未命名场景')
    const html = renderToStaticMarkup(<AppDialogHost />)
    expect(html).toContain('data-testid="app-dialog-input"')
    expect(html).toContain('value="未命名场景"')

    const request = getAppDialogSnapshot().active!
    settleAppDialog(request.id, null)
    await expect(pending).resolves.toBeNull()
  })
})
