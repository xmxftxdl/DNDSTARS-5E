import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DICE_TIMING } from '../../lib/diceOverlayShared'
import DicePresentationOverlays from './DicePresentationOverlays'

describe('right dice presentation drawer', () => {
  const overlaysSource = readFileSync(new URL('./DicePresentationOverlays.tsx', import.meta.url), 'utf8')
  const workspaceSource = readFileSync(new URL('../../pages/MapsWorkspacePage.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

  it('presents local and shared dice rolls from the right-side tray', () => {
    expect(overlaysSource.match(/layout="left-drawer"/g)?.length).toBe(4)
    expect(overlaysSource).toContain('<DiceRollOverlay showCard={false}')
    expect(css).toContain('.dice-box-damage-frame.dice-box-frame--left-drawer')
    expect(css).toContain('@keyframes dice-box-left-drawer-enter')
    expect(css).toContain('.dice-tray-drawer__surface::before')
    expect(css).toContain('.dice-tray-drawer__rim')
    expect(css).toMatch(/\.dice-tray-drawer\s*{[^}]*right:\s*4\.75rem;/s)
    expect(css).toMatch(/\.dice-tray-recall\s*{[^}]*right:\s*0;/s)
    expect(css).toContain('.dice-tray-drawer__controls')
  })

  it('renders the solid result rail above the 3D dice iframe', () => {
    const diceLayer = overlaysSource.indexOf('{diceBoxD20 && (')
    const foregroundLayer = overlaysSource.indexOf('dice-tray-drawer--foreground')
    expect(diceLayer).toBeGreaterThan(0)
    expect(foregroundLayer).toBeGreaterThan(diceLayer)
    expect(css).toMatch(/\.dice-tray-drawer__result\s*{[^}]*z-index:\s*7;/s)
    expect(css).toMatch(/\.dice-tray-drawer__result\s*{[^}]*background:[^;}]*rgba\(11, 13, 22, 0\.99\)/s)
    expect(overlaysSource).toContain('<DiceOverlayPortal layer="backdrop">')
    expect(overlaysSource).toContain('<DiceOverlayPortal layer="foreground">')
  })

  it('moves the previous roll banner context into the tray header', () => {
    expect(overlaysSource).toContain('activeRollStatus: ActiveDiceRollStatusView | null')
    expect(overlaysSource).toContain('dice-tray-drawer__context-meta')
    expect(overlaysSource).toContain('dice-tray-drawer__title')
    expect(overlaysSource).toContain('dice-tray-drawer__target')
    expect(workspaceSource).not.toContain('<ActiveDiceRollStatus status={activeDiceRollStatus}')
  })

  it('edits and confirms DM secret dice inside the physical tray', () => {
    const html = renderToStaticMarkup(createElement(DicePresentationOverlays, {
      roll: null,
      diceBoxD20: null,
      diceBoxRoll: null,
      rollRequestPreview: null,
      activeRollStatus: null,
      secretConfirmation: {
        id: 'secret-roll',
        label: '火焰吐息 · 伤害',
        targetName: '新冒险者',
        sides: 10,
        values: [2, 10, 6],
      },
      isDM: true,
      renderFreeRollControls: () => createElement('div', { 'data-testid': 'free-roll-quickbar' }, '骰型栏'),
      onRollDone: () => undefined,
      onD20Complete: () => undefined,
      onDiceComplete: () => undefined,
      onPreviewComplete: () => undefined,
      onSecretConfirm: () => undefined,
    }))

    expect(html).toContain('DM 暗骰')
    expect(html).toContain('火焰吐息 · 伤害')
    expect(html).toContain('目标</span>新冒险者')
    expect(html).toContain('3d10')
    expect(html).toContain('data-testid="secret-dice-override"')
    expect(html.match(/inputMode="numeric"/g)).toHaveLength(3)
    expect(html).toContain('确认并继续')
    expect(html).not.toContain('data-testid="free-roll-quickbar"')
    expect(workspaceSource).not.toContain('<SecretDiceOverrideOverlay')
  })

  it('opens an actionable player tray before a delegated saving throw is rolled', () => {
    const html = renderToStaticMarkup(createElement(DicePresentationOverlays, {
      roll: null,
      diceBoxD20: null,
      diceBoxRoll: null,
      rollRequestPreview: null,
      activeRollStatus: null,
      secretConfirmation: null,
      playerRollPrompt: {
        id: 'save-request',
        label: '火球术·敏捷豁免',
        targetName: '新冒险者',
        count: 1,
        sides: 20,
      },
      isDM: false,
      onRollDone: () => undefined,
      onD20Complete: () => undefined,
      onDiceComplete: () => undefined,
      onPreviewComplete: () => undefined,
      onSecretConfirm: () => undefined,
      onPlayerRoll: () => undefined,
    }))

    expect(html).toContain('data-testid="player-dice-roll-request"')
    expect(html).toContain('data-testid="player-dice-roll-confirm"')
    expect(html).toContain('火球术·敏捷豁免')
    expect(html).toContain('目标</span>新冒险者')
    expect(html).toContain('确认并投掷')
    expect(html).not.toContain('点击骰子添加，然后投掷')
    expect(css).toMatch(/\.dice-tray-drawer__result--player-request\s*{[^}]*pointer-events:\s*auto;/s)
  })

  it('wraps a large secret dice pool into a vertically scrollable grid', () => {
    const values = Array.from({ length: 18 }, (_, index) => index % 10 + 1)
    const html = renderToStaticMarkup(createElement(DicePresentationOverlays, {
      roll: null,
      diceBoxD20: null,
      diceBoxRoll: null,
      rollRequestPreview: null,
      activeRollStatus: null,
      secretConfirmation: {
        id: 'large-secret-roll',
        label: '大型伤害池',
        targetName: '新冒险者',
        sides: 10,
        values,
      },
      isDM: true,
      onRollDone: () => undefined,
      onD20Complete: () => undefined,
      onDiceComplete: () => undefined,
      onPreviewComplete: () => undefined,
      onSecretConfirm: () => undefined,
    }))

    expect(html).toContain('dice-tray-drawer__result--many')
    expect(html).toContain('dice-tray-drawer__secret--many')
    expect(html.match(/inputMode="numeric"/g)).toHaveLength(18)
    expect(css).toMatch(/\.dice-tray-drawer__secret--many\s*{[^}]*display:\s*grid;/s)
    expect(css).toMatch(/\.dice-tray-drawer__secret--many \.dice-tray-drawer__dice--editable[\s\S]*overflow-y:\s*auto;/)
    expect(css).toMatch(/\.dice-tray-drawer__result--many\s*{[^}]*max-height:/s)
  })

  it('opens the quick dice tray by default and keeps settled results open', () => {
    const html = renderToStaticMarkup(createElement(DicePresentationOverlays, {
      roll: null,
      diceBoxD20: null,
      diceBoxRoll: null,
      rollRequestPreview: null,
      activeRollStatus: null,
      secretConfirmation: null,
      isDM: true,
      renderFreeRollControls: () => createElement('div', { 'data-testid': 'free-roll-quickbar' }, '骰型栏'),
      onRollDone: () => undefined,
      onD20Complete: () => undefined,
      onDiceComplete: () => undefined,
      onPreviewComplete: () => undefined,
      onSecretConfirm: () => undefined,
    }))

    expect(html).toContain('data-testid="dice-tray-drawer"')
    expect(html).toContain('data-testid="free-roll-quickbar"')
    expect(html).toContain('点击骰子添加，然后投掷')
    expect(html).not.toContain('data-testid="dice-tray-recall"')
    expect(overlaysSource).toContain('const [trayOpen, setTrayOpen] = useState(() => props.renderFreeRollControls != null)')
    expect(overlaysSource).toContain('const rememberRecord = (record: DiceTrayRecord) => {')
    expect(overlaysSource).toMatch(/setLastRecord\(record\)[\s\S]*setTrayOpen\(true\)/)
    expect(overlaysSource).toContain('data-testid="dice-tray-recall"')
  })

  it('hosts the free-roll settings inside the same physical tray', () => {
    expect(overlaysSource).toContain('renderFreeRollControls?: (close: () => void) => ReactNode')
    expect(overlaysSource).toContain('dice-tray-drawer__controls')
    expect(overlaysSource).toContain('showFreeRollQuickbar')
    expect(overlaysSource).toContain('dice-tray-drawer__controls--quick')
    expect(overlaysSource).toMatch(/const showFreeRollQuickbar = !showFreeRollControls &&\s*secretConfirmation == null/)
    expect(overlaysSource).toContain('(!hasDicePresentation || activePresentationSettled)')
    expect(css).toMatch(/\.dice-tray-drawer__result--secret\s*{[^}]*z-index:\s*10;/s)
    expect(overlaysSource).toContain("setFreeRollControlsOpen(true)")
    expect(workspaceSource).toContain('renderFreeRollControls={!isSpectator ? (close) => (')
    expect(workspaceSource).toContain('<MapDiceRoller')
    expect(workspaceSource).toContain('embedded')
    expect(css).toContain('.map-dice-roller__topbar')
    expect(css).toContain('.map-dice-roller__settings')
    expect(css).toContain('.dice-tray-drawer__controls--quick .map-dice-roller__settings')
    expect(css).toMatch(/\.map-dice-roller__topbar\s*{[^}]*margin:\s*0\.62rem 0\.55rem 0;/s)
    expect(css).not.toContain('.dice-tray-drawer--settings .dice-tray-drawer__surface::before')
  })

  it('waits for the visual engine failsafe instead of truncating a large dice pool at 3.5 seconds', () => {
    expect(DICE_TIMING.ROLL_SETTLED_HOLD_MS).toBeGreaterThanOrEqual(900)
    expect(workspaceSource).toContain('maximumWaitMs: DICE_TIMING.ROLL_FAILSAFE_MS +')
    expect(workspaceSource).not.toContain(': DICE_TIMING.ROLL_MIN_VISIBLE_MS + 900')
  })
})
