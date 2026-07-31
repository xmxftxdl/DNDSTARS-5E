import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import DmMonsterControlDock from './DmMonsterControlDock'

const goblin: Token = {
  id: 'goblin-token',
  label: '哥布林',
  x: 0,
  y: 0,
  color: '#4ade80',
  emoji: '👺',
  size: 1,
  type: 'enemy',
  poolId: 'srd-5.1:goblin',
  hp: 7,
  maxHp: 7,
}

describe('DmMonsterControlDock', () => {
  it('shows the encounter monster and its complete structured capability groups', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [goblin],
      currentTokenId: goblin.id,
      control: {
        schemaVersion: 1,
        mode: 'manual',
        pauseRequested: false,
        controlledTokenId: goblin.id,
        updatedAt: 1,
      },
      settlementMode: 'automatic',
      actionUsed: false,
      movementRemainingFeet: 25,
      movementMaximumFeet: 30,
      onRequestTakeover: () => {},
      onResumeAutomation: () => {},
      onSelectAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('哥布林')
    expect(markup).toContain('特性')
    expect(markup).toContain('动作')
    expect(markup).toContain('选择目标')
    expect(markup).toContain('恢复 AI')
    expect(markup).toContain('拖动地图上的当前怪物 Token 进行移动')
    expect(markup).toContain('剩余 25/30 尺')
  })

  it('explains that a requested pause waits for settlement', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [goblin],
      currentTokenId: goblin.id,
      control: {
        schemaVersion: 1,
        mode: 'automatic',
        pauseRequested: true,
        controlledTokenId: goblin.id,
        requestedAt: 1,
        updatedAt: 1,
      },
      settlementMode: 'automatic',
      actionUsed: false,
      onRequestTakeover: () => {},
      onResumeAutomation: () => {},
      onSelectAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('结算后接管')
    expect(markup).toContain('命中、伤害、豁免与附带效果会先完整结算')
  })
})
