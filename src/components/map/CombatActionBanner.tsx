import type { CSSProperties } from 'react'
import {
  DND5E_CLASS_ICON_PALETTES,
  dnd5eSpellActionIcon,
} from '../../lib/dnd5eActionIcons'
import BannerClassBackdrop from './BannerClassBackdrop'
import BannerRibbonTail from './BannerRibbonTail'
import Dnd5eActionIcon from './Dnd5eActionIcon'

interface CombatActionBannerProps {
  mode: 'turn' | 'spell'
  classId?: string
  casterName?: string
  spellId?: string
  spellName?: string
}

const FALLBACK_PALETTE = ['#3B82F6', '#071A38', '#DBEAFE', '#60A5FA'] as const

export default function CombatActionBanner({
  mode,
  classId = 'wizard',
  spellId = 'fireball',
  spellName = '火球术',
}: CombatActionBannerProps) {
  const palette = DND5E_CLASS_ICON_PALETTES[classId] ?? FALLBACK_PALETTE
  const style = {
    '--combat-banner-color': palette[0],
    '--combat-banner-deep': palette[1],
    '--combat-banner-accent': palette[2],
    '--combat-banner-glow': palette[3],
    '--streak-class': palette[0],
    '--streak-deep': palette[1],
    '--streak-accent': palette[2],
    '--streak-glow': palette[3],
  } as CSSProperties
  const icon = mode === 'spell'
    ? dnd5eSpellActionIcon({
        id: spellId,
        name: spellName,
        damageType: spellId === 'fireball' ? 'fire' : undefined,
        castingClassId: classId,
      })
    : undefined

  return (
    <div
      className={`combat-action-banner combat-action-banner--${mode}`}
      style={style}
      role="status"
      aria-live={mode === 'turn' ? 'polite' : 'assertive'}
      data-combat-banner={mode}
    >
      <BannerRibbonTail side="left" />
      <div className="kill-streak-banner__center combat-action-banner__center">
        <span className="kill-streak-banner__gold-line kill-streak-banner__gold-line--top" />
        <span className="kill-streak-banner__shine" aria-hidden="true" />
        <BannerClassBackdrop classId={classId} color={palette[2]} glow={palette[3]} />
        <div className="combat-action-banner__aether" aria-hidden="true" />
        <div className="combat-action-banner__runes" aria-hidden="true">
          <span>✦</span><span>◈</span><span>✧</span><span>◈</span><span>✦</span>
        </div>
        <div className="combat-action-banner__content">
          {icon ? (
            <Dnd5eActionIcon
              spec={icon}
              className="combat-action-banner__icon"
            />
          ) : null}
          <div className="combat-action-banner__copy">
            <strong>{mode === 'turn' ? '你的回合' : spellName}</strong>
          </div>
        </div>
        <span className="kill-streak-banner__gold-line kill-streak-banner__gold-line--bottom" />
      </div>
      <BannerRibbonTail side="right" />
    </div>
  )
}
