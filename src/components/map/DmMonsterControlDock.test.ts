import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
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

const redDragonWyrmling: Token = {
  id: 'red-dragon-wyrmling-token',
  label: '红龙雏龙',
  x: 0,
  y: 0,
  color: '#ef4444',
  emoji: '🐉',
  size: 1,
  type: 'enemy',
  poolId: 'srd-5.1:red-dragon-wyrmling',
  hp: 75,
  maxHp: 75,
  dnd5eCombatState: {
    monsterRechargeReadyByActionId: { 'fire-breath': true },
  },
}

const androsphinx: Token = {
  id: 'androsphinx-token',
  label: '雄性斯芬克斯',
  x: 0,
  y: 0,
  color: '#f59e0b',
  emoji: '🦁',
  size: 3,
  type: 'enemy',
  poolId: 'srd-5.1:androsphinx',
  hp: 199,
  maxHp: 199,
  dnd5eCombatState: {
    monsterActionUsesByActionId: {
      roar: { current: 2, max: 3 },
    },
  },
}

const blinkDog: Token = {
  id: 'blink-dog-token',
  label: '闪现犬',
  x: 0,
  y: 0,
  color: '#ef4444',
  emoji: '🐕',
  size: 1,
  type: 'enemy',
  poolId: 'srd-5.1:blink-dog',
  hp: 22,
  maxHp: 22,
}

const succubus: Token = {
  id: 'succubus-token',
  label: '魅魔／梦魔',
  x: 0,
  y: 0,
  color: '#db2777',
  emoji: '😈',
  size: 1,
  type: 'enemy',
  poolId: 'srd-5.1:succubus-incubus',
  hp: 66,
  maxHp: 66,
}

const dryad: Token = {
  id: 'dryad-token',
  label: '树精',
  x: 0,
  y: 0,
  color: '#16a34a',
  emoji: '🌳',
  size: 1,
  type: 'enemy',
  poolId: 'srd-5.1:dryad',
  hp: 22,
  maxHp: 22,
  dnd5eCombatState: {
    monsterSpellUsesBySpellId: { shillelagh: { current: 1, max: 1 } },
  },
}

describe('DmMonsterControlDock', () => {
  it('disables its end-turn control while an authoritative advance is pending', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [goblin],
      currentTokenId: goblin.id,
      actionUsed: false,
      endTurnPending: true,
      onSelectAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('推进中…')
    const endTurnButton = markup.match(/<button[^>]*disabled=""[^>]*>\s*推进中…\s*<\/button>/)?.[0]
    expect(endTurnButton).toBeDefined()
  })

  it('shows the encounter monster and its complete structured capability groups', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [goblin],
      currentTokenId: goblin.id,
      actionUsed: false,
      movementRemainingFeet: 25,
      movementMaximumFeet: 30,
      onSelectAction: () => {},
      onSelectMovement: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('哥布林')
    expect(markup).toContain('特性')
    expect(markup).toContain('动作')
    expect(markup).toContain('选择目标')
    expect(markup).toContain('先选择移动方式，再点击地图落点')
    expect(markup).toContain('剩余 25/30 尺')
    expect(markup).toContain('移动')
    expect(markup).toContain('疾走')
    expect(markup).toContain('撤离')
    expect(markup).toContain('助跑跳')
    expect(markup).toContain('立定跳')
    expect(markup).toContain('先步行助跑至少 10 尺，最多跳 8 尺')
    expect(markup).toContain('无需助跑，最多跳 4 尺')
    expect(markup).toContain('优势')
    expect(markup).toContain('正常')
    expect(markup).toContain('劣势')
    expect(markup).not.toMatch(
      /data-testid="manual-monster-roll-mode-scimitar-(?:advantage|normal|disadvantage)"[^>]*data-selected="true"/,
    )
    expect(markup).toContain('选择目标 · 弯刀 · 自动')
  })

  it('does not expose a live-combat AI takeover or resume control', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [goblin],
      currentTokenId: goblin.id,
      actionUsed: false,
      onSelectAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).not.toContain('DM 手动控制')
    expect(markup).not.toContain('接管')
    expect(markup).not.toContain('恢复 AI')
  })

  it('shows Slow-adjusted AC and effective movement instead of raw stat-block values', () => {
    const slowedGoblin: Token = {
      ...goblin,
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:slow', label: '缓慢术', targetId: goblin.id,
          source: { kind: 'spell', actorId: 'wizard', rulesId: 'slow' },
          duration: { type: 'concentration', sourceActorId: 'wizard', concentrationId: 'slow', remainingRounds: 10 },
          modifiers: { armorClassBonus: -2, speedMultiplier: 0.5 },
        })],
      },
    }
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [slowedGoblin],
      currentTokenId: slowedGoblin.id,
      actionUsed: false,
      movementRemainingFeet: 12,
      movementMaximumFeet: 12,
      onSelectAction: () => {},
      onSelectMovement: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('AC 13')
    expect(markup).toContain('12 尺')
    expect(markup).not.toContain('AC 15')

    const inspectedOutsideTurn = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [slowedGoblin],
      currentTokenId: 'another-monster',
      actionUsed: false,
      onSelectAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))
    expect(inspectedOutsideTurn).toContain('15 尺')
    expect(inspectedOutsideTurn).not.toContain('30 尺')
  })

  it('keeps movement disabled while the current monster begin-turn boundary settles', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [goblin],
      currentTokenId: goblin.id,
      actionUsed: true,
      actionPending: true,
      turnStartPending: true,
      movementRemainingFeet: 30,
      movementMaximumFeet: 30,
      onSelectAction: () => {},
      onSelectMovement: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('正在结算本回合开始的充能、状态与持续效果')
    const moveButton = markup.match(
      /<button[^>]*data-testid="manual-monster-move-move"[^>]*>/,
    )?.[0]
    expect(moveButton).toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('surfaces an active-effect escape action and locks movement while restrained', () => {
    const restrainedGoblin: Token = {
      ...goblin,
      dnd5eCombatState: {
        activeEffects: [createDnd5eConditionEffect({
          id: 'web:restrained:goblin',
          condition: 'restrained',
          targetId: goblin.id,
          source: { kind: 'spell', actorId: 'wizard-token', rulesId: 'web', magical: true },
          escapeCheck: { ability: 'str', dc: 19, economy: 'action' },
        })],
      },
    }
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [restrainedGoblin],
      currentTokenId: restrainedGoblin.id,
      actionUsed: false,
      movementRemainingFeet: 15,
      movementMaximumFeet: 30,
      onSelectAction: () => {},
      onEscapeActiveEffect: () => {},
      onSelectMovement: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('挣脱束缚（力量检定 DC 19）')
    expect(markup).toContain('剩余 0/30 尺')
    expect(markup).toContain('速度</p><p class="truncate text-sm font-bold text-slate-100">0 尺')
    expect(markup.match(/data-testid="manual-monster-move-move"[^>]*>/)?.[0])
      .toMatch(/\sdisabled(?:=|\s|>)/)
    expect(markup.match(/data-testid="manual-monster-move-dash"[^>]*>/)?.[0])
      .toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('keeps the exact remaining Multiattack occurrence usable after the prior strike', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [owlbearContinuation],
      currentTokenId: owlbearContinuation.id,
      // The parent Multiattack already spent the turn action. Its receipt must
      // nevertheless leave the second occurrence clickable.
      actionUsed: true,
      actionPending: false,
      onSelectAction: () => {},
      onSelectContinuation: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('继续多重攻击')
    expect(markup).toContain('第 2/2 击')
    expect(markup).toContain('Headless 续击')
    expect(markup).toContain('选择目标 · 双爪 · 自动')
    const continuationButton = markup.match(
      /<button[^>]*data-testid="continue-monster-multiattack"[^>]*>/,
    )?.[0]
    expect(continuationButton).toBeDefined()
    expect(continuationButton).not.toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('disables Multiattack and hides a stale continuation when an active effect caps attacks at one', () => {
    const slowedOwlbear: Token = {
      ...owlbearContinuation,
      dnd5eCombatState: {
        ...owlbearContinuation.dnd5eCombatState,
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:slow',
          label: '缓慢术',
          targetId: owlbearContinuation.id,
          source: { kind: 'spell', actorId: 'wizard', rulesId: 'slow' },
          duration: {
            type: 'concentration',
            sourceActorId: 'wizard',
            concentrationId: 'slow',
            remainingRounds: 10,
          },
          modifiers: { maximumAttacksPerTurn: 1 },
        })],
      },
    }
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [slowedOwlbear],
      currentTokenId: slowedOwlbear.id,
      actionUsed: false,
      actionPending: false,
      onSelectAction: () => {},
      onSelectContinuation: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('受效果限制：本回合最多一次攻击')
    expect(markup).not.toContain('继续多重攻击')
    expect(markup).toMatch(
      /data-testid="manual-monster-action-multiattack"[^>]*\sdisabled(?:=|\s|>)/,
    )
    expect(markup).not.toMatch(
      /data-testid="manual-monster-action-beak"[^>]*\sdisabled(?:=|\s|>)/,
    )
  })

  it('lists authoritative monster spells with their live resources for DM control', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [mage],
      currentTokenId: mage.id,
      actionUsed: false,
      bonusActionUsed: false,
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

  it('unlocks the Shillelagh weapon branch only while its authoritative effect is active', () => {
    const renderDryad = (token: Token) => renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [token],
      currentTokenId: token.id,
      actionUsed: false,
      bonusActionUsed: false,
      onSelectAction: () => {},
      onSelectSpell: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    const before = renderDryad(dryad)
    expect(before).toContain('需要先激活对应效果')
    expect(before.match(
      /data-testid="manual-monster-action-club-shillelagh"[^>]*>/,
    )?.[0]).toMatch(/\sdisabled(?:=|\s|>)/)

    const after = renderDryad({
      ...dryad,
      dnd5eCombatState: {
        ...dryad.dnd5eCombatState,
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'srd-5.1:spell:shillelagh',
          label: '橡棍术',
          targetId: dryad.id,
          source: { kind: 'spell', actorId: dryad.id, rulesId: 'shillelagh' },
          duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
          modifiers: {
            shillelagh: {
              weaponId: 'club',
              spellcastingAbility: 'cha',
              spellcastingModifier: 4,
            },
          },
        })],
      },
    })
    expect(after).not.toContain('需要先激活对应效果')
    const enabled = after.match(
      /data-testid="manual-monster-action-club-shillelagh"[^>]*>/,
    )?.[0]
    expect(enabled).toBeDefined()
    expect(enabled).not.toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('shows recharge threshold and keeps a previously recharged breath usable under DM control', () => {
    const readyMarkup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [redDragonWyrmling],
      currentTokenId: redDragonWyrmling.id,
      actionUsed: false,
      onSelectAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(readyMarkup).toContain('充能 5–6 · 已就绪')
    expect(readyMarkup).toContain('选择落点 · 火焰吐息')
    const readyButton = readyMarkup.match(
      /<button[^>]*data-testid="manual-monster-action-fire-breath"[^>]*>/,
    )?.[0]
    expect(readyButton).toBeDefined()
    expect(readyButton).not.toMatch(/\sdisabled(?:=|\s|>)/)

    const spentMarkup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [{
        ...redDragonWyrmling,
        dnd5eCombatState: {
          monsterRechargeReadyByActionId: { 'fire-breath': false },
        },
      }],
      currentTokenId: redDragonWyrmling.id,
      actionUsed: false,
      onSelectAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(spentMarkup).toContain('充能 5–6 · 未充能')
    expect(spentMarkup).toContain('等待充能 5–6')
    const spentButton = spentMarkup.match(
      /<button[^>]*data-testid="manual-monster-action-fire-breath"[^>]*>/,
    )?.[0]
    expect(spentButton).toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('keeps a non-Headless monster action clickable through the DM adjudication route', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [blinkDog],
      currentTokenId: blinkDog.id,
      actionUsed: false,
      onSelectAction: () => {},
      onSelectAdjudicatedAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('DM 裁定')
    expect(markup).toContain('提交 DM 裁定 · 传送')
    const teleportButton = markup.match(
      /<button[^>]*data-testid="manual-monster-action-teleport"[^>]*>/,
    )?.[0]
    expect(teleportButton).toBeDefined()
    expect(teleportButton).not.toMatch(/\sdisabled(?:=|\s|>)/)
    expect(markup).toContain('传送：仅传送')
    expect(markup).toContain('执行 · 传送：仅传送')
    const teleportOnlyButton = markup.match(
      /<button[^>]*data-testid="manual-monster-action-teleport-only"[^>]*>/,
    )?.[0]
    expect(teleportOnlyButton).toBeDefined()
    expect(teleportOnlyButton).not.toMatch(/\sdisabled(?:=|\s|>)/)

    const spentMarkup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [{
        ...blinkDog,
        dnd5eCombatState: { monsterRechargeReadyByActionId: { teleport: false } },
      }],
      currentTokenId: blinkDog.id,
      actionUsed: false,
      onSelectAction: () => {},
      onSelectAdjudicatedAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))
    const spentTeleport = spentMarkup.match(
      /<button[^>]*data-testid="manual-monster-action-teleport"[^>]*>/,
    )?.[0]
    const spentTeleportOnly = spentMarkup.match(
      /<button[^>]*data-testid="manual-monster-action-teleport-only"[^>]*>/,
    )?.[0]
    expect(spentTeleport).toMatch(/\sdisabled(?:=|\s|>)/)
    expect(spentTeleportOnly).toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('renders a live target picker for Headless saving-throw condition actions', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [succubus],
      currentTokenId: succubus.id,
      actionUsed: false,
      onSelectAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('魅惑')
    expect(markup).toContain('选择目标 · 魅惑')
    const charmButton = markup.match(
      /<button[^>]*data-testid="manual-monster-action-charm"[^>]*>/,
    )?.[0]
    expect(charmButton).toBeDefined()
    expect(charmButton).not.toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('keeps a staged Headless Roar selectable and shows its live daily uses', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [androsphinx],
      currentTokenId: androsphinx.id,
      actionUsed: false,
      onSelectAction: () => {},
      onEndTurn: () => {},
      initialExpanded: true,
    }))

    expect(markup).toContain('每日次数 2/3')
    expect(markup).toContain('选择落点 · 咆哮')
    const roarButton = markup.match(
      /<button[^>]*data-testid="manual-monster-action-roar"[^>]*>/,
    )?.[0]
    expect(roarButton).toBeDefined()
    expect(roarButton).not.toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('locks bonus-action and action spells against their own turn resources', () => {
    const markup = renderToStaticMarkup(createElement(DmMonsterControlDock, {
      monsters: [mage],
      currentTokenId: mage.id,
      actionUsed: false,
      bonusActionUsed: true,
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
