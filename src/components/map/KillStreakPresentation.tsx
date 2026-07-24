import type { CSSProperties } from 'react'
import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import {
  KILL_STREAK_BANNER_DURATION_MS,
  KILL_STREAK_EFFECT_DURATION_MS,
  type CombatPresentationKillStreak,
} from '../../lib/combatPresentation'
import BannerClassBackdrop from './BannerClassBackdrop'
import BannerRibbonTail from './BannerRibbonTail'

interface KillStreakPresentationProps {
  presentation: CombatPresentationKillStreak
}

const FALLBACK_PALETTE = ['#dc2626', '#250609', '#fff1c2', '#fb923c'] as const

export default function KillStreakPresentation({
  presentation,
}: KillStreakPresentationProps) {
  const palette = DND5E_CLASS_ICON_PALETTES[presentation.classId] ?? FALLBACK_PALETTE
  const style = {
    '--streak-class': palette[0],
    '--streak-deep': palette[1],
    '--streak-accent': palette[2],
    '--streak-glow': palette[3],
    '--kill-streak-effect-duration': `${KILL_STREAK_EFFECT_DURATION_MS}ms`,
    '--kill-streak-banner-duration': `${KILL_STREAK_BANNER_DURATION_MS}ms`,
  } as CSSProperties

  return (
    <div
      className={`kill-streak-presentation kill-streak-presentation--${presentation.style}`}
      style={style}
      data-kill-streak={presentation.style}
      role="status"
      aria-live="assertive"
    >
      <div className="kill-streak-effect" aria-hidden="true">
        <div className="kill-streak-fireball">
            <span className="kill-streak-fireball__blast" />
            <span className="kill-streak-fireball__flash" />
            <span className="kill-streak-fireball__core" />
            <span className="kill-streak-fireball__ember" />
            <span className="kill-streak-fireball__ring kill-streak-fireball__ring--one" />
            <span className="kill-streak-fireball__ring kill-streak-fireball__ring--two" />
            {Array.from({ length: 24 }, (_, index) => (
              <span
                className="kill-streak-fireball__spark"
                key={`spark-${index}`}
                style={{
                  '--spark-index': index,
                  '--spark-length': `${76 + (index % 4) * 14}px`,
                } as CSSProperties}
              />
            ))}
            {Array.from({ length: 20 }, (_, index) => (
              <i key={index} style={{ '--particle-index': index } as CSSProperties} />
            ))}
        </div>
      </div>

      <div className="kill-streak-banner">
        <BannerRibbonTail side="left" />
        <div className="kill-streak-banner__center">
          <span className="kill-streak-banner__gold-line kill-streak-banner__gold-line--top" />
          <span className="kill-streak-banner__shine" aria-hidden="true" />
          <BannerClassBackdrop
            classId={presentation.classId}
            color={palette[2]}
            glow={palette[3]}
          />
          <span className="kill-streak-banner__eyebrow">
            {presentation.actorName} · 本回合击败三名敌人
          </span>
          <strong
            className="kill-streak-banner__title"
            data-stamp-text="癫狂杀戮"
          >
            癫狂杀戮
          </strong>
          <span className="kill-streak-banner__english">KILLING SPREE</span>
          <span className="kill-streak-banner__gold-line kill-streak-banner__gold-line--bottom" />
        </div>
        <BannerRibbonTail side="right" />
      </div>
    </div>
  )
}
