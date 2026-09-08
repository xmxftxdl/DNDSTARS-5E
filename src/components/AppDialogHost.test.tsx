import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getAppDialogSnapshot,
  resetAppDialogsForTests,
  settleAppDialog,
  showAppActionChoice,
  showAppChoiceGroups,
  showAppConfirm,
  showAppDirectionStepper,
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
    expect(html).toContain('max-h-[calc(100dvh-2rem)]')
    expect(html).toContain('data-testid="app-dialog-message-scroll"')
    expect(html).toContain('overflow-y-auto')
    expect(html).toContain('data-testid="app-dialog-actions"')
    expect(html).toContain('shrink-0')

    const request = getAppDialogSnapshot().active!
    settleAppDialog(request.id, null)
    await expect(pending).resolves.toBeNull()
  })

  it('renders direction buttons and a five-foot height stepper', async () => {
    const pending = showAppDirectionStepper({
      title: '浮空术',
      message: '选择方向和距离。',
      defaultDirection: 'up',
      defaultValue: 5,
      minValue: 5,
      maxValue: 20,
      step: 5,
      unit: '尺',
      upLabel: '上升',
      downLabel: '下降',
    })
    const html = renderToStaticMarkup(<AppDialogHost />)
    expect(html).toContain('data-testid="app-dialog-direction-stepper"')
    expect(html).toContain('data-testid="app-dialog-direction-up"')
    expect(html).toContain('data-testid="app-dialog-direction-down"')
    expect(html).toContain('data-testid="app-dialog-stepper-decrease"')
    expect(html).toContain('data-testid="app-dialog-stepper-increase"')
    expect(html).toContain('>5 尺</output>')
    expect(html).toContain('>取消</button>')
    expect(html).toContain('>确认</button>')
    expect(html).not.toContain('data-testid="app-dialog-input"')

    const request = getAppDialogSnapshot().active!
    settleAppDialog(request.id, null)
    await expect(pending).resolves.toBeNull()
  })

  it('renders grouped choices as selectable cards instead of a numbered prompt', async () => {
    const pending = showAppChoiceGroups({
      title: '防护法阵',
      message: '选择生物和方向。',
      groups: [{
        id: 'creature',
        label: '生物类型',
        options: [
          { id: 'celestial', label: '天界生物' },
          { id: 'undead', label: '亡灵' },
        ],
      }, {
        id: 'boundary',
        label: '法阵方向',
        options: [
          { id: 'enter', label: '阻止进入', description: '保护内部。' },
          { id: 'exit', label: '阻止离开', description: '反转法阵。' },
        ],
      }],
    })
    const html = renderToStaticMarkup(<AppDialogHost />)
    expect(html).toContain('data-testid="app-dialog-choice-groups"')
    expect(html).toContain('data-testid="app-dialog-choice-creature-celestial"')
    expect(html).toContain('data-testid="app-dialog-choice-boundary-exit"')
    expect(html).toContain('生物类型')
    expect(html).toContain('法阵方向')
    expect(html).not.toContain('data-testid="app-dialog-input"')

    const request = getAppDialogSnapshot().active!
    settleAppDialog(request.id, null)
    await expect(pending).resolves.toBeNull()
  })

  it('renders door operations as direct action buttons without a text input or confirm step', async () => {
    const pending = showAppActionChoice({
      title: '地图交互 · 门',
      message: '选择要执行的操作。',
      options: [
        { id: 'open', label: '开门', description: '直接打开这扇门。' },
        { id: 'break', label: '力量破门', tone: 'rose' },
      ],
    })
    const html = renderToStaticMarkup(<AppDialogHost />)
    expect(html).toContain('data-testid="app-dialog-action-choices"')
    expect(html).toContain('data-testid="app-dialog-action-open"')
    expect(html).toContain('data-testid="app-dialog-action-break"')
    expect(html).toContain('直接打开这扇门。')
    expect(html).not.toContain('data-testid="app-dialog-input"')
    expect(html).not.toContain('data-testid="app-dialog-confirm"')

    const request = getAppDialogSnapshot().active!
    settleAppDialog(request.id, null)
    await expect(pending).resolves.toBeNull()
  })

  it('renders large action choices as searchable single-column scrolling rows', async () => {
    const pending = showAppActionChoice({
      title: '变形术',
      message: '生物形态：请选择一个选项。',
      layout: 'list',
      searchable: true,
      searchPlaceholder: '搜索生物形态',
      options: [
        { id: 'bat', label: '蝙蝠（CR 0）', description: '微型野兽 · AC 12 · HP 1' },
        { id: 'giant-ape', label: '巨猿（CR 7）', description: '超大型野兽 · AC 12 · HP 157' },
      ],
    })
    const html = renderToStaticMarkup(<AppDialogHost />)
    expect(html).toContain('data-testid="app-dialog-action-search"')
    expect(html).toContain('placeholder="搜索生物形态"')
    expect(html).toContain('data-testid="app-dialog-action-list"')
    expect(html).toContain('grid-cols-1')
    expect(html).toContain('max-h-[48dvh]')
    expect(html).toContain('overflow-y-auto')
    expect(html).toContain('data-testid="app-dialog-action-giant-ape"')
    expect(html).not.toContain('data-testid="app-dialog-input"')
    expect(html).not.toContain('data-testid="app-dialog-confirm"')

    const request = getAppDialogSnapshot().active!
    settleAppDialog(request.id, null)
    await expect(pending).resolves.toBeNull()
  })
})
