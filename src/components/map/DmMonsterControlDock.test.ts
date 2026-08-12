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

const mage: Token = {
  id: 'mage-token',
  label: '法师',
  x: 0,
  y: 0,
  color: '#ef4444',
  emoji: '🧙',
  size: 1,
  type: 'enemy',
  poolId: 'srd-5.1:mage',
  hp: 40,
  maxHp: 40,
  dnd5eCombatState: {
    monsterSpellSlots: {
      1: { current: 2, max: 4 },
      2: { current: 1, max: 3 },
      3: { current: 1, max: 3 },
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
      onSelectMovement: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('哥布林')
    expect(markup).toContain('特性')
    expect(markup).toContain('动作')
    expect(markup).toContain('选择目标')
    expect(markup).toContain('恢复 AI')
    expect(markup).toContain('先选择移动方式，再点击地图落点')
    expect(markup).toContain('剩余 25/30 尺')
    expect(markup).toContain('移动')
    expect(markup).toContain('疾走')
    expect(markup).toContain('撤离')
    expect(markup).toContain('助跑跳')
    expect(markup).toContain('立定跳')
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

  it('lists authoritative monster spells with their live resources for DM takeover', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [mage],
      currentTokenId: mage.id,
      control: {
        schemaVersion: 1,
        mode: 'manual',
        pauseRequested: false,
        controlledTokenId: mage.id,
        updatedAt: 1,
      },
      settlementMode: 'automatic',
      actionUsed: false,
      bonusActionUsed: false,
      onRequestTakeover: () => {},
      onResumeAutomation: () => {},
      onSelectAction: () => {},
      onSelectSpell: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('法术')
    expect(markup).toContain('火球术')
    expect(markup).toContain('3 环 1/3')
    expect(markup).toContain('范围选点')
    const fireballButton = markup.match(
      /<button[^>]*data-testid="manual-monster-spell-fireball-3"[^>]*>/,
    )?.[0]
    expect(fireballButton).toBeDefined()
    expect(fireballButton).not.toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('locks bonus-action and action spells against their own turn resources', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [mage],
      currentTokenId: mage.id,
      control: {
        schemaVersion: 1,
        mode: 'manual',
        pauseRequested: false,
        controlledTokenId: mage.id,
        updatedAt: 1,
      },
      settlementMode: 'automatic',
      actionUsed: false,
      bonusActionUsed: true,
      onRequestTakeover: () => {},
      onResumeAutomation: () => {},
      onSelectAction: () => {},
      onSelectSpell: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    const fireballButton = markup.match(
      /<button[^>]*data-testid="manual-monster-spell-fireball-3"[^>]*>/,
    )?.[0]
    const mistyStepButton = markup.match(
      /<button[^>]*data-testid="manual-monster-spell-misty-step-2"[^>]*>/,
    )?.[0]
    expect(fireballButton).toBeDefined()
    expect(fireballButton).not.toMatch(/\sdisabled(?:=|\s|>)/)
    expect(mistyStepButton).toBeDefined()
    expect(mistyStepButton).toMatch(/\sdisabled(?:=|\s|>)/)
  })
})
