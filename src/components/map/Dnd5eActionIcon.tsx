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
    case 'monster-attack': return <g {...common} data-icon-detail="monster-claw-attack">
      <path d="M19 17c5 10 12 16 22 20M35 11c2 11 7 19 16 25M52 15c-1 10 2 18 10 25" strokeWidth="5.2" />
      <path d="M18 17 13 9m22 2-1-9m18 13 5-8" strokeWidth="3.2" />
      <path d="M23 61c8-12 18-18 31-17l9 5-9 4 5 8-10-3-5 9-6-9-10 6z" strokeWidth="2.8" />
      <path d="M44 49h.1m11 2h.1" strokeWidth="4.4" />
    </g>
    case 'weapon': return <g {...common} strokeWidth="3"><path d="m18 63 11-11M21 58l6 6M30 50 57 14l8 1 1 8-36 27ZM18 18l44 44M14 14l9 2 41 41-7 7-41-41z" /></g>
    case 'force': return <g {...common} strokeWidth="2.8"><path d="m40 10 25 15v30L40 70 15 55V25zM40 10v60M15 25l50 30M65 25 15 55" /><circle cx="40" cy="40" r="9" /></g>
    default: return <g {...common} strokeWidth="2.7"><path d="M40 11 51 29l20 5-14 15 2 20-19-8-19 8 2-20L9 34l20-5z" /><circle cx="40" cy="42" r="9" /></g>
  }
}

const RUNES = [
  'M15 15h11M20 10v11', 'M55 12l10 10M65 12 55 22', 'M12 58h14l-7 10z', 'M58 56h10v10H58z',
  'M13 38h8m-4-4v8', 'M59 38h8m-4-4v8', 'M33 11h14', 'M33 69h14',
]

export function Dnd5eClassBackdrop({ classId, color, glow }: { classId: string; color: string; glow: string }) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (classId) {
    case 'barbarian':
      return <g data-backdrop-detail="cracked-rage" {...common}>
        <path d="M5 19 24 30l-8 8 17 8-9 10 16 18M57 4 45 23l9 7-14 12 9 8-8 26" strokeWidth="2.5" opacity=".35" />
        <path d="m11 58 19-23m2 36 20-29m-4 25 19-23" stroke={glow} strokeWidth="4.5" opacity=".16" />
      </g>
    case 'bard':
      return <g data-backdrop-detail="resonant-song" {...common}>
        <path d="M-8 25c15-8 29-8 43 0s29 8 45-1M-8 32c15-8 29-8 43 0s29 8 45-1M-8 39c15-8 29-8 43 0s29 8 45-1M-8 46c15-8 29-8 43 0s29 8 45-1M-8 53c15-8 29-8 43 0s29 8 45-1" strokeWidth="1" opacity=".19" />
        <path d="M7 58c12 9 23 9 34 0s22-9 34 0" stroke={glow} strokeWidth="3.2" opacity=".16" />
        <g
          data-backdrop-detail="resonant-song-filled-notes"
          fill="#FFF7FF"
          stroke="none"
          opacity=".9"
        >
          <ellipse cx="18" cy="48" rx="3.7" ry="2.8" transform="rotate(-18 18 48)" />
          <path d="M21 47V25l13-3v22h-2V25l-9 2v20z" />
          <ellipse cx="31" cy="45" rx="3.7" ry="2.8" transform="rotate(-18 31 45)" />
          <ellipse cx="58" cy="32" rx="3.5" ry="2.6" transform="rotate(-20 58 32)" />
          <path d="M61 31V13h2v18zM61 13c6 1 9 4 10 8-4-2-7-2-10-1z" />
          <ellipse cx="49" cy="62" rx="3.4" ry="2.5" transform="rotate(-15 49 62)" />
          <path d="M52 61V44h2v17z" />
        </g>
        <path d="M10 19c8-8 14-4 12 2-2 5-9 4-9-1 0-7 12-11 15-2 2 7-5 14-11 10" strokeWidth="1.8" opacity=".3" />
        <circle cx="8" cy="13" r="1.5" fill={glow} stroke="none" opacity=".55" /><circle cx="69" cy="67" r="1.8" fill={glow} stroke="none" opacity=".5" />
        <path d="m69 9 1.7 4.2L75 15l-4.3 1.7L69 21l-1.7-4.3L63 15l4.3-1.8z" fill={glow} stroke="none" opacity=".34" />
      </g>
    case 'cleric':
      return <g data-backdrop-detail="divine-halo" {...common}>
        <circle cx="40" cy="40" r="22" strokeWidth="5" opacity=".12" />
        <circle cx="40" cy="40" r="29" strokeWidth="1.7" opacity=".35" />
        <path d="M40 2v19M40 59v19M2 40h19m38 0h19M13 13l14 14m26 26 14 14M67 13 53 27M27 53 13 67" strokeWidth="3" opacity=".25" />
      </g>
    case 'druid':
      return <g data-backdrop-detail="living-leaves" {...common}>
        <path d="M7 66C20 48 29 31 34 8M73 14C57 27 50 44 47 72" strokeWidth="2.2" opacity=".35" />
        <path d="M17 50c-8-8-7-17 1-23 8 8 8 16-1 23Zm40-17c2-12 10-18 21-16-2 11-9 17-21 16ZM30 29c-7-7-6-14 1-19 7 6 6 13-1 19Zm18 25c10-5 19-2 23 7-9 5-17 3-23-7Z" fill={color} stroke="none" opacity=".19" />
      </g>
    case 'fighter':
      return <g data-backdrop-detail="tempered-steel" {...common}>
        <path d="M8 8h64v64H8zM16 16h48v48H16z" strokeWidth="2" opacity=".23" />
        <path d="M12 40h56M40 12v56M17 17l46 46m0-46L17 63" strokeWidth="1.4" opacity=".17" />
        <circle cx="13" cy="13" r="2.4" fill={glow} stroke="none" opacity=".55" /><circle cx="67" cy="13" r="2.4" fill={glow} stroke="none" opacity=".55" /><circle cx="13" cy="67" r="2.4" fill={glow} stroke="none" opacity=".55" /><circle cx="67" cy="67" r="2.4" fill={glow} stroke="none" opacity=".55" />
      </g>
    case 'monk':
      return <g data-backdrop-detail="flowing-chi" {...common}>
        <circle cx="40" cy="40" r="27" strokeWidth="2.2" strokeDasharray="17 7" opacity=".31" />
        <circle cx="40" cy="40" r="18" strokeWidth="4" strokeDasharray="3 9" opacity=".2" />
        <path d="M4 51c16 12 29 9 37-8 8-16 20-20 35-12M8 29c13-8 24-5 33 8 9 14 20 17 32 8" stroke={glow} strokeWidth="2.6" opacity=".2" />
      </g>
    case 'paladin':
      return <g data-backdrop-detail="oath-shield" {...common}>
        <path d="M40 8c10 8 19 10 27 11v20c0 17-10 27-27 34C23 66 13 56 13 39V19c8-1 17-3 27-11Z" strokeWidth="3.2" opacity=".27" />
        <path d="M40 17v43M23 35h34" stroke={glow} strokeWidth="4" opacity=".19" />
        <path d="m40 5 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill={color} stroke="none" opacity=".3" />
      </g>
    case 'ranger':
      return <g data-backdrop-detail="forest-trail" {...common}>
        <path d="m4 67 14-25 14 25m-8 0 17-34 18 34m-7 0 13-25 13 25M40 5v17m-6-6 6 6 6-6" strokeWidth="2.2" opacity=".29" />
        <path d="M3 69h74" strokeWidth="3" opacity=".3" />
        <path d="M9 26c13-9 28-13 45-12" stroke={glow} strokeWidth="1.5" strokeDasharray="2 5" opacity=".25" />
      </g>
    case 'rogue':
      return <g data-backdrop-detail="cut-shadow" {...common}>
        <path d="m-8 23 34-20h22L-8 37Zm0 30L65 10h23L-8 67Zm25 27 71-42v17L45 80Z" fill="#020617" stroke="none" opacity=".36" />
        <path d="m40 8 7 13-7 13-7-13zM14 58l8-7 8 7-8 8zM56 57l6-5 6 5-6 6z" fill={color} stroke="none" opacity=".24" />
      </g>
    case 'sorcerer':
      return <g data-backdrop-detail="draconic-bloodline" {...common}>
        <path d="M-3 13c8-8 16-8 24 0 8-8 16-8 24 0 8-8 16-8 24 0 8-8 16-8 24 0M-3 35c8-8 16-8 24 0 8-8 16-8 24 0 8-8 16-8 24 0 8-8 16-8 24 0M-3 57c8-8 16-8 24 0 8-8 16-8 24 0 8-8 16-8 24 0 8-8 16-8 24 0" strokeWidth="2.3" opacity=".27" />
        <path d="M9 75 28 51l7 5 9-19 7 5L68 8" stroke={glow} strokeWidth="3" opacity=".22" />
      </g>
    case 'warlock':
      return <g data-backdrop-detail="eldritch-eye" {...common}>
        <path d="M7 40c10-16 21-24 33-24s23 8 33 24C63 56 52 64 40 64S17 56 7 40Z" strokeWidth="3" opacity=".29" />
        <circle cx="40" cy="40" r="12" strokeWidth="4" opacity=".25" />
        <path d="M40 28c-8 5-8 19 0 24 8-5 8-19 0-24ZM8 13c9 5 14 12 16 21M72 13c-9 5-14 12-16 21M8 67c9-5 14-12 16-21M72 67c-9-5-14-12-16-21" stroke={glow} strokeWidth="2" opacity=".22" />
      </g>
    case 'wizard':
      return <g data-backdrop-detail="arcane-circle" {...common}>
        <g fill={glow} stroke="none">
          <circle cx="8" cy="12" r="1.1" opacity=".65" /><circle cx="19" cy="7" r=".7" opacity=".5" /><circle cx="31" cy="14" r="1.2" opacity=".62" />
          <circle cx="51" cy="7" r=".8" opacity=".55" /><circle cx="69" cy="14" r="1.3" opacity=".68" /><circle cx="75" cy="28" r=".7" opacity=".5" />
          <circle cx="8" cy="38" r=".8" opacity=".55" /><circle cx="17" cy="69" r="1.2" opacity=".62" /><circle cx="29" cy="75" r=".7" opacity=".52" />
          <circle cx="51" cy="71" r="1" opacity=".6" /><circle cx="70" cy="66" r=".8" opacity=".55" /><circle cx="75" cy="49" r="1.2" opacity=".64" />
          <path d="m12 23 1.3 3.2 3.2 1.3-3.2 1.3L12 32l-1.3-3.2-3.2-1.3 3.2-1.3zM66 36l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1z" opacity=".42" />
        </g>
        <path d="M8 12 19 7l12 7M51 7l18 7 6 14M17 69l12 6 22-4 19-5" strokeWidth=".8" strokeDasharray="2 2" opacity=".2" />
        <circle cx="40" cy="40" r="33" strokeWidth="1.1" strokeDasharray="2 3" opacity=".3" />
        <circle cx="40" cy="40" r="28" strokeWidth="2" strokeDasharray="7 2 1 2" opacity=".36" />
        <circle cx="40" cy="40" r="21" strokeWidth="1.3" opacity=".28" />
        <path d="m40 10 26 45H14zM14 25h52L40 70ZM20 40h40M40 20v40" strokeWidth="1.5" opacity=".23" />
        <path d="m40 5 2 4-2 4-2-4zM70 37l4 3-4 3-4-3zM40 67l2 4-2 4-2-4zM10 37l4 3-4 3-4-3z" fill={color} stroke="none" opacity=".44" />
        <path d="M27 15h5l-2.5 4zM58 20l4 2-4 2M57 61h5M18 56l4 4m0-4-4 4" strokeWidth="1.4" opacity=".42" />
      </g>
    default:
      return <g data-backdrop-detail="neutral-arcane" {...common}><circle cx="40" cy="40" r="28" strokeWidth="2" strokeDasharray="5 4" opacity=".25" /></g>
  }
}

function ClassBorderOrnaments({ classId, color }: { classId: string; color: string }) {
  const common = { fill: color, stroke: 'none', opacity: .82 }
  switch (classId) {
    case 'barbarian':
      return <g data-border-detail="rage-spikes" {...common}><path d="m4 18 5-9 5 9-5-3zm62 44 5 9 5-9-5 3zM18 4 9 9l9 5-3-5zm44 72 9-5-9-5 3 5z" /></g>
    case 'bard':
      return <g data-border-detail="song-notes" fill="none" stroke={color} strokeWidth="1.5" opacity=".82"><path d="M7 13V6l6-1v6m-6 2c-3 0-3-3 0-3m6 1c-3 0-3-3 0-3M67 74v-7l6-1v6m-6 2c-3 0-3-3 0-3m6 1c-3 0-3-3 0-3" /></g>
    case 'cleric':
      return <g data-border-detail="holy-rays" fill="none" stroke={color} strokeWidth="1.8" opacity=".85"><path d="M40 2v8m-4-4h8M40 70v8m-4-4h8M2 40h8m-4-4v8M70 40h8m-4-4v8" /></g>
    case 'druid':
      return <g data-border-detail="leaf-corners" {...common}><path d="M5 18C4 9 9 4 18 5c-1 9-6 13-13 13Zm57 57c1-9 6-14 13-13 1 9-4 14-13 13ZM62 5c9-1 14 4 13 13-9-1-13-6-13-13ZM18 75C9 76 4 71 5 62c9 1 13 6 13 13Z" /></g>
    case 'fighter':
      return <g data-border-detail="steel-rivets" {...common}><circle cx="7" cy="7" r="2.2" /><circle cx="73" cy="7" r="2.2" /><circle cx="7" cy="73" r="2.2" /><circle cx="73" cy="73" r="2.2" /></g>
    case 'monk':
      return <g data-border-detail="chi-beads" fill="none" stroke={color} strokeWidth="2" opacity=".86"><circle cx="8" cy="8" r="3.5" /><circle cx="72" cy="8" r="3.5" /><circle cx="8" cy="72" r="3.5" /><circle cx="72" cy="72" r="3.5" /></g>
    case 'paladin':
      return <g data-border-detail="oath-crests" {...common}><path d="M34 2h12v6c0 5-2 8-6 10-4-2-6-5-6-10zm0 60c4 2 8 2 12 0v10c0 4-2 6-6 8-4-2-6-4-6-8z" /></g>
    case 'ranger':
      return <g data-border-detail="trail-arrows" {...common}><path d="m3 26 9-8-3 8 3 8zm74 28-9 8 3-8-3-8zM26 3l-8 9 8-3 8 3zm28 74 8-9-8 3-8-3z" /></g>
    case 'rogue':
      return <g data-border-detail="shadow-blades" {...common}><path d="m3 20 15-15-5 11 3 3-11 5zm74 40-15 15 5-11-3-3 11-5zM20 77 5 62l11 5 3-3 5 11zM60 3l15 15-11-5-3 3-5-11z" /></g>
    case 'sorcerer':
      return <g data-border-detail="dragon-scales" fill="none" stroke={color} strokeWidth="1.8" opacity=".86"><path d="M4 19c5-7 10-7 15 0M61 4c7 5 7 10 0 15M76 61c-5 7-10 7-15 0M19 76c-7-5-7-10 0-15" /></g>
    case 'warlock':
      return <g data-border-detail="pact-eyes" fill="none" stroke={color} strokeWidth="1.6" opacity=".88"><path d="M31 6c6-5 12-5 18 0-6 5-12 5-18 0Zm0 68c6-5 12-5 18 0-6 5-12 5-18 0Z" /><circle cx="40" cy="6" r="1.7" fill={color} /><circle cx="40" cy="74" r="1.7" fill={color} /></g>
    case 'wizard':
      return <g data-border-detail="arcane-gems" {...common}><path d="m7 3 3 4-3 4-3-4zm66 0 3 4-3 4-3-4zM7 77l-3-4 3-4 3 4zm66 0-3-4 3-4 3 4z" /></g>
    default:
      return null
  }
}

function RarityBorderOrnaments({ rarity, color }: { rarity: NonNullable<Dnd5eActionIconSpec['rarityBackdropId']>; color: string }) {
  const common = { fill: color, opacity: '.9' }
  switch (rarity) {
    case 'common':
      return <g data-rarity-detail="plain" fill="none" stroke={color} strokeWidth="1" opacity=".55"><path d="M8 18V8h10M62 8h10v10M72 62v10H62M18 72H8V62" /></g>
    case 'uncommon':
      return <g data-rarity-detail="corner-leaves" {...common}><path d="M5 17C7 9 10 6 18 5c-5 3-8 6-9 12zm70 0C73 9 70 6 62 5c5 3 8 6 9 12zM5 63c2 8 5 11 13 12-5-3-8-6-9-12zm70 0c-2 8-5 11-13 12 5-3 8-6 9-12z" /></g>
    case 'rare':
      return <g data-rarity-detail="four-gems" {...common}><path d="m40 2.5 4 4-4 4-4-4zm0 67 4 4-4 4-4-4zM2.5 40l4-4 4 4-4 4zm67 0 4-4 4 4-4 4z" /></g>
    case 'very-rare':
      return <g data-rarity-detail="arcane-crescents" fill="none" stroke={color} strokeWidth="2" opacity=".9"><path d="M7 25C9 13 16 7 28 5M53 5c12 2 18 8 20 20M73 55c-2 12-8 18-20 20M27 75C15 73 9 67 7 55" /><circle cx="7" cy="40" r="2" fill={color} /><circle cx="73" cy="40" r="2" fill={color} /></g>
    case 'legendary':
      return <g data-rarity-detail="sun-crown" {...common}><path d="m40 1.5 3 6 6 1-4.5 4.5 1 6-5.5-3-5.5 3 1-6L31 8.5l6-1zm0 77-3-6-6-1 4.5-4.5-1-6 5.5 3 5.5-3-1 6 4.5 4.5-6 1zM1.5 40l6-3 1-6 4.5 4.5 6-1-3 5.5 3 5.5-6-1L8.5 49l-1-6zm77 0-6 3-1 6-4.5-4.5-6 1 3-5.5-3-5.5 6 1 4.5-4.5 1 6z" /></g>
    case 'artifact':
      return <g data-rarity-detail="relic-spikes" {...common}><path d="m40 1 5 10-5-3-5 3zm39 39-10 5 3-5-3-5zM40 79l-5-10 5 3 5-3zM1 40l10-5-3 5 3 5zM8 8l11 4-7 1-1 7zm64 0-4 11-1-7-7-1zm0 64-11-4 7-1 1-7zM8 72l4-11 1 7 7 1z" /></g>
    case 'varies':
      return <g data-rarity-detail="shifting-orbs" {...common}><circle cx="12" cy="12" r="2.2" /><circle cx="40" cy="5" r="2.2" /><circle cx="68" cy="12" r="2.2" /><circle cx="75" cy="40" r="2.2" /><circle cx="68" cy="68" r="2.2" /><circle cx="40" cy="75" r="2.2" /><circle cx="12" cy="68" r="2.2" /><circle cx="5" cy="40" r="2.2" /></g>
  }
}

export default function Dnd5eActionIcon({ spec, className = '', level, badge, active = false, disabled = false }: Dnd5eActionIconProps) {
  const reactId = useId().replace(/:/g, '')
  const gradientId = `action-icon-${reactId}`
  const paintedActionAsset = spec.asset ??
    (spec.motif === 'melee-attack'
      ? '/assets/icons/melee-attack-action.png'
      : spec.motif === 'move'
      ? '/assets/icons/move-action.png'
      : spec.motif === 'dash'
        ? '/assets/icons/dash-action.png'
        : spec.motif === 'disengage'
          ? '/assets/icons/disengage-action.png'
          : spec.motif === 'dodge'
            ? '/assets/icons/dodge-action.png'
            : undefined)
  const paintedAssetDetail = spec.asset?.match(/\/([^/]+)-(?:spell|item)-action\.png$/)?.[1] ?? spec.motif
  const paintedAssetIsForeground = spec.assetMode === 'foreground'
  return (
    <span className={`relative block aspect-square overflow-hidden rounded-xl ${active ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-void-950' : ''} ${disabled ? 'grayscale opacity-45' : ''} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 80 80" className="h-full w-full" role="img" data-icon-motif={spec.motif}>
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="28%" r="82%">
            <stop offset="0" stopColor={spec.background} />
            <stop offset="1" stopColor={spec.backgroundDeep} />
          </radialGradient>
          <linearGradient
            id={`${gradientId}-class-border`}
            x1="0"
            y1="0"
            x2="80"
            y2="80"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={spec.accent} stopOpacity=".7" />
            <stop offset=".2" stopColor={spec.accent} stopOpacity=".74" />
            <stop offset=".38" stopColor={spec.glow} stopOpacity=".86" />
            <stop offset=".5" stopColor="#ffffff" />
            <stop offset=".62" stopColor={spec.glow} stopOpacity=".86" />
            <stop offset=".8" stopColor={spec.accent} stopOpacity=".74" />
            <stop offset="1" stopColor={spec.accent} stopOpacity=".7" />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 40 40"
              to="360 40 40"
              dur="8s"
              repeatCount="indefinite"
            />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id={`${gradientId}-border-glow`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width="80" height="80" rx="11" fill={`url(#${gradientId})`} />
        {spec.classBackdropId ? (
          <g data-class-backdrop={spec.classBackdropId}>
            <rect width="80" height="80" rx="11" fill={spec.glow} opacity=".035" />
            <Dnd5eClassBackdrop classId={spec.classBackdropId} color={spec.accent} glow={spec.glow} />
          </g>
        ) : null}
        {paintedActionAsset ? (
          <image
            href={paintedActionAsset}
            x={paintedAssetIsForeground ? '0' : '-4'}
            y={paintedAssetIsForeground ? '0' : '-4'}
            width={paintedAssetIsForeground ? '80' : '88'}
            height={paintedAssetIsForeground ? '80' : '88'}
            preserveAspectRatio={paintedAssetIsForeground ? 'xMidYMid meet' : 'xMidYMid slice'}
            data-icon-detail={`painted-${paintedAssetDetail}`}
          />
        ) : (
          <>
            <g opacity=".13" stroke={spec.accent} transform={`rotate(${spec.textureRotation} 40 40)`}>
              <path d="M-10 18h100M-10 34h100M-10 50h100M-10 66h100" />
              <path d="M18-10v100M34-10v100M50-10v100M66-10v100" />
            </g>
            <circle cx="40" cy="40" r="31" fill="none" stroke={spec.accent} strokeOpacity=".2" />
            <g filter={`url(#${gradientId}-glow)`}><Motif motif={spec.motif} color={spec.accent} /></g>
            <path d={RUNES[spec.runeIndex]} fill="none" stroke={spec.glow} strokeWidth="1.4" opacity=".75" />
          </>
        )}
        {!paintedActionAsset ? (
          <>
            <path d="M3 63 17 77H3z" fill={spec.backgroundDeep} opacity=".8" />
            <path d="M77 17 63 3h14z" fill={spec.accent} opacity=".15" />
          </>
        ) : null}
        {spec.classBackdropId ? (
          <g data-class-border={spec.classBackdropId}>
            <rect x="2.75" y="2.75" width="74.5" height="74.5" rx="8.75" fill="none" stroke={spec.backgroundDeep} strokeOpacity=".82" strokeWidth="4.8" />
            <rect
              className="dnd5e-class-border-line"
              x="2.75"
              y="2.75"
              width="74.5"
              height="74.5"
              rx="8.75"
              fill="none"
              stroke={`url(#${gradientId}-class-border)`}
              strokeWidth="3.1"
              filter={`url(#${gradientId}-border-glow)`}
            />
            <ClassBorderOrnaments classId={spec.classBackdropId} color={spec.accent} />
          </g>
        ) : spec.rarityBackdropId ? (
          <g data-rarity-border={spec.rarityBackdropId}>
            <rect x="2" y="2" width="76" height="76" rx="9.5" fill="none" stroke={spec.backgroundDeep} strokeOpacity=".9" strokeWidth="4" />
            <rect x="3.5" y="3.5" width="73" height="73" rx="8" fill="none" stroke={spec.glow} strokeOpacity=".95" strokeWidth={spec.rarityBackdropId === 'legendary' || spec.rarityBackdropId === 'artifact' ? '2.8' : '2.1'} filter={`url(#${gradientId}-border-glow)`} />
            <rect x="6.5" y="6.5" width="67" height="67" rx="6" fill="none" stroke={spec.accent} strokeOpacity=".45" strokeWidth="1" />
            <RarityBorderOrnaments rarity={spec.rarityBackdropId} color={spec.accent} />
          </g>
        ) : (
          <rect x="1.5" y="1.5" width="77" height="77" rx="10" fill="none" stroke={spec.accent} strokeOpacity={paintedActionAsset ? '.34' : '.52'} strokeWidth={paintedActionAsset ? '1.5' : '2'} />
        )}
      </svg>
      {level != null ? <span className="absolute bottom-1 left-1 min-w-5 rounded-md border border-white/15 bg-black/70 px-1 text-center text-[10px] font-black text-white shadow">{level}</span> : null}
      {badge != null && badge !== '' ? <span className={`absolute rounded border border-white/15 bg-black/75 text-center font-black text-white shadow ${paintedActionAsset ? 'right-0.5 top-0.5 min-w-4 px-0.5 text-[9px]' : 'right-1 top-1 min-w-5 px-1 text-[10px]'}`}>{badge}</span> : null}
    </span>
  )
}
