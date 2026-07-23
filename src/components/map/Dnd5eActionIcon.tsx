import { useId } from 'react'
import type { Dnd5eActionIconMotif, Dnd5eActionIconSpec } from '../../lib/dnd5eActionIcons'

interface Dnd5eActionIconProps {
  spec: Dnd5eActionIconSpec
  className?: string
  level?: number
  badge?: string | number
  active?: boolean
  disabled?: boolean
}

function Motif({ motif, color }: { motif: Dnd5eActionIconMotif; color: string }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (motif) {
    case 'fire': return <g {...common} strokeWidth="3"><path d="M34 55c-12-9-9-23 1-33 0 9 8 10 8 19 5-4 7-10 6-16 13 11 15 27 4 35-7 6-15 7-19 4-6-4-7-10-5-16 1 5 4 8 8 9-1-5 1-9 5-13 3 7 2 13-2 17" /></g>
    case 'cold': return <g {...common} strokeWidth="2.7"><path d="M40 16v48M19 28l42 24M19 52l42-24M40 16l-5 7m5-7 5 7M40 64l-5-7m5 7 5-7M19 28l9 1m-9-1 4 8M61 52l-9-1m9 1-4-8M19 52l9-1m-9 1 4-8M61 28l-9 1m9-1-4 8" /></g>
    case 'lightning': return <g {...common} strokeWidth="4"><path d="M46 12 25 43h14l-5 25 22-34H43z" /></g>
    case 'acid': return <g {...common} strokeWidth="2.8"><path d="M31 15h18M35 15v17L22 55c-4 8 2 11 9 11h18c8 0 13-4 9-12L45 32V15M28 50h25M32 57h4m7 3h5" /></g>
    case 'poison': return <g {...common} strokeWidth="2.8"><path d="M27 61 54 20M26 27c7-9 20-10 28-1 7 8 4 19-3 24-6 4-15 5-22 1-9-6-10-17-3-24ZM31 36h.1M48 36h.1M35 45c4 2 7 2 11 0M23 59h34" /></g>
    case 'healing': return <g {...common} strokeWidth="3"><path d="M31 14h18v17h17v18H49v17H31V49H14V31h17z" /><path d="M22 22 58 58M58 22 22 58" opacity=".28" /></g>
    case 'radiant': return <g {...common} strokeWidth="2.8"><circle cx="40" cy="40" r="13" /><path d="M40 10v10m0 40v10M10 40h10m40 0h10M19 19l7 7m28 28 7 7M61 19l-7 7M26 54l-7 7" /></g>
    case 'death': return <g {...common} strokeWidth="2.7"><path d="M24 58V37c0-12 7-22 16-22s16 10 16 22v21M20 58h40M31 37h.1M49 37h.1M34 49c4-3 8-3 12 0M40 49v9" /></g>
    case 'armor': return <g {...common} strokeWidth="3"><path d="M40 12c8 7 16 9 24 10v17c0 16-9 25-24 31-15-6-24-15-24-31V22c8-1 16-3 24-10Z" /><path d="m29 40 7 7 15-16" /></g>
    case 'move': return <g {...common}>
      <path d="M14 65c4-13 13-16 20-23 7-8 6-18 24-23" strokeWidth="2.5" strokeDasharray="2 6" />
      <path d="m52 13 9 5-7 9" strokeWidth="3.2" />
      <g fill={color} stroke="none" opacity=".94">
        <ellipse cx="23" cy="55" rx="5" ry="8.5" transform="rotate(-32 23 55)" />
        <circle cx="16" cy="44" r="2.3" /><circle cx="20" cy="42" r="2.1" /><circle cx="24" cy="42" r="1.8" />
        <ellipse cx="39" cy="35" rx="5" ry="8.5" transform="rotate(28 39 35)" />
        <circle cx="45" cy="24" r="2.3" /><circle cx="41" cy="22" r="2.1" /><circle cx="37" cy="23" r="1.8" />
      </g>
    </g>
    case 'movement': return <g {...common} strokeWidth="3"><path d="M14 42c12-15 24-22 42-22l-9-8m9 8-8 10M66 39C54 54 42 61 24 61l9 8m-9-8 8-10" /></g>
    case 'summon': return <g {...common} strokeWidth="2.7"><circle cx="40" cy="40" r="25" /><path d="m40 17 7 15 16 2-12 11 4 16-15-8-15 8 4-16-12-11 16-2z" /></g>
    case 'control': return <g {...common} strokeWidth="2.7"><path d="M15 40c8-12 16-18 25-18s17 6 25 18c-8 12-16 18-25 18S23 52 15 40Z" /><circle cx="40" cy="40" r="8" /><path d="M40 10v7m0 46v7M10 40h7m46 0h7" /></g>
    case 'illusion': return <g {...common} strokeWidth="2.6"><path d="M13 43c8-14 17-21 27-21s19 7 27 21c-8 12-17 18-27 18S21 55 13 43Z" /><path d="M40 28c-8 0-13 8-9 15 4 8 15 8 19 0 4-7-2-15-10-15Z" /><path d="m30 18 5-7m15 8 6-6" /></g>
    case 'divination': return <g {...common} strokeWidth="2.7"><circle cx="40" cy="39" r="22" /><circle cx="40" cy="39" r="9" /><path d="M18 65h44M26 65l5-9m23 9-5-9M40 17V9" /></g>
    case 'nature': return <g {...common} strokeWidth="2.7"><path d="M40 68V35M40 51c-10 0-19-8-20-21 13 0 20 6 20 17M40 43c2-14 10-21 23-22-1 14-9 22-23 22" /><path d="M29 59c-5 0-10 2-15 6m37-6c5 0 10 2 15 6" /></g>
    case 'beast': return <g {...common} strokeWidth="2.8"><path d="M24 59c-6-5-7-13-2-18 4-4 10-3 14 1 3-5 10-6 14-2 5 5 4 13-2 18-7 6-17 6-24 1ZM20 30c-4 1-8-3-9-8s2-9 6-9 8 4 8 9-1 7-5 8Zm40 0c4 1 8-3 9-8s-2-9-6-9-8 4-8 9 1 7 5 8ZM31 27c-4 0-7-4-7-9s3-9 7-9 7 4 7 9-3 9-7 9Zm18 0c4 0 7-4 7-9s-3-9-7-9-7 4-7 9 3 9 7 9Z" /></g>
    case 'weapon': return <g {...common} strokeWidth="3"><path d="m18 63 11-11M21 58l6 6M30 50 57 14l8 1 1 8-36 27ZM18 18l44 44M14 14l9 2 41 41-7 7-41-41z" /></g>
    case 'force': return <g {...common} strokeWidth="2.8"><path d="m40 10 25 15v30L40 70 15 55V25zM40 10v60M15 25l50 30M65 25 15 55" /><circle cx="40" cy="40" r="9" /></g>
    default: return <g {...common} strokeWidth="2.7"><path d="M40 11 51 29l20 5-14 15 2 20-19-8-19 8 2-20L9 34l20-5z" /><circle cx="40" cy="42" r="9" /></g>
  }
}

const RUNES = [
  'M15 15h11M20 10v11', 'M55 12l10 10M65 12 55 22', 'M12 58h14l-7 10z', 'M58 56h10v10H58z',
  'M13 38h8m-4-4v8', 'M59 38h8m-4-4v8', 'M33 11h14', 'M33 69h14',
]

export default function Dnd5eActionIcon({ spec, className = '', level, badge, active = false, disabled = false }: Dnd5eActionIconProps) {
  const reactId = useId().replace(/:/g, '')
  const gradientId = `action-icon-${reactId}`
  return (
    <span className={`relative block aspect-square overflow-hidden rounded-xl ${active ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-void-950' : ''} ${disabled ? 'grayscale opacity-45' : ''} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 80 80" className="h-full w-full" role="img" data-icon-motif={spec.motif}>
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="28%" r="82%">
            <stop offset="0" stopColor={spec.background} />
            <stop offset="1" stopColor={spec.backgroundDeep} />
          </radialGradient>
          <filter id={`${gradientId}-glow`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width="80" height="80" rx="11" fill={`url(#${gradientId})`} />
        <g opacity=".13" stroke={spec.accent} transform={`rotate(${spec.textureRotation} 40 40)`}>
          <path d="M-10 18h100M-10 34h100M-10 50h100M-10 66h100" />
          <path d="M18-10v100M34-10v100M50-10v100M66-10v100" />
        </g>
        <circle cx="40" cy="40" r="31" fill="none" stroke={spec.accent} strokeOpacity=".2" />
        <g filter={`url(#${gradientId}-glow)`}><Motif motif={spec.motif} color={spec.accent} /></g>
        <path d={RUNES[spec.runeIndex]} fill="none" stroke={spec.glow} strokeWidth="1.4" opacity=".75" />
        <path d="M3 63 17 77H3z" fill={spec.backgroundDeep} opacity=".8" />
        <path d="M77 17 63 3h14z" fill={spec.accent} opacity=".15" />
        <rect x="1.5" y="1.5" width="77" height="77" rx="10" fill="none" stroke={spec.accent} strokeOpacity=".52" strokeWidth="2" />
      </svg>
      {level != null ? <span className="absolute bottom-1 left-1 min-w-5 rounded-md border border-white/15 bg-black/70 px-1 text-center text-[10px] font-black text-white shadow">{level}</span> : null}
      {badge != null && badge !== '' ? <span className="absolute right-1 top-1 min-w-5 rounded-md border border-white/15 bg-black/75 px-1 text-center text-[10px] font-black text-white shadow">{badge}</span> : null}
    </span>
  )
}
