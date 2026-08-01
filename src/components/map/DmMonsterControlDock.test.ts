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

const owlbearContinuation: Token = {
  id: 'owlbear-token',
  label: '枭熊',
  x: 0,
  y: 0,
  color: '#a855f7',
  emoji: '🦉',
  size: 2,
  type: 'enemy',
  poolId: 'srd-5.1:owlbear',
  hp: 59,
  maxHp: 59,
  dnd5eCombatState: {
    monsterMultiattackContinuation: {
      schemaVersion: 1,
      combatId: 'combat',
      round: 1,
      turnKey: 'combat:1:owlbear-token',
      parentActionId: 'multiattack',
      nextOccurrenceIndex: 1,
      sequenceActionIds: ['beak', 'claws'],
      targetIds: ['hero-token'],
      hitByOccurrence: [true],
    },
  },
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
    expect(markup).toContain('点击当前怪物显示移动范围，再点击地图格移动')
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

  it('keeps the exact remaining Multiattack occurrence usable after takeover', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [owlbearContinuation],
      currentTokenId: owlbearContinuation.id,
      control: {
        schemaVersion: 1,
        mode: 'manual',
        pauseRequested: false,
        controlledTokenId: owlbearContinuation.id,
        updatedAt: 1,
      },
      settlementMode: 'automatic',
      // The parent Multiattack already spent the turn action. Its receipt must
      // nevertheless leave the second occurrence clickable.
      actionUsed: true,
      actionPending: false,
      onRequestTakeover: () => {},
      onResumeAutomation: () => {},
      onSelectAction: () => {},
      onSelectContinuation: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('继续多重攻击')
    expect(markup).toContain('第 2/2 击')
    expect(markup).toContain('Headless 续击')
    const continuationButton = markup.match(
      /<button[^>]*data-testid="continue-monster-multiattack"[^>]*>/,
    )?.[0]
    expect(continuationButton).toBeDefined()
    expect(continuationButton).not.toMatch(/\sdisabled(?:=|\s|>)/)
  })
})
