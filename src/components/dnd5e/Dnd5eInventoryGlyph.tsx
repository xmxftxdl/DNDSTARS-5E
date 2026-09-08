import type { ReactNode, SVGProps } from 'react'
import type { Dnd5eInventoryIconId } from '../../types/inventory'

const INK = '#111827'
const METAL = '#B8C7D9'
const METAL_LIGHT = '#EEF6FF'
const METAL_DARK = '#64748B'
const GOLD = '#F5C451'
const GOLD_LIGHT = '#FFF1A8'
const LEATHER = '#9A5A2B'
const LEATHER_DARK = '#5B3018'
const WOOD = '#A96532'
const WOOD_DARK = '#5E321D'
const GLASS = '#D8F5FF'
const MAGIC = '#A78BFA'
const MAGIC_LIGHT = '#F0E5FF'

const outlined = {
  stroke: INK,
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Bottle({ liquid, children }: { liquid: string; children?: ReactNode }) {
  return (
    <g data-glyph-part="bottle">
      <path d="M31 10h18v9l-4 5v7c10 5 16 15 16 26 0 8-5 12-13 12H32c-8 0-13-4-13-12 0-11 6-21 16-26v-7l-4-5Z" fill={GLASS} {...outlined} />
      <path d="M22 47c10 3 26-4 36 0 2 4 3 8 3 12 0 7-5 10-13 10H32c-8 0-13-3-13-10 0-4 1-8 3-12Z" fill={liquid} stroke="none" />
      <path d="M29 49c8 2 20-3 27-1" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".72" />
      <path d="M31 10h18v9H31z" fill={WOOD} {...outlined} />
      <path d="M35 25h10" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".65" />
      {children}
    </g>
  )
}

/**
 * Original multicolour semantic inventory artwork. The shapes intentionally do
 * not include a background or frame so the same glyph can inherit mundane,
 * rarity, selection, and disabled treatments from its host.
 */
export function Dnd5eInventoryGlyphShapes({ icon }: { icon: Dnd5eInventoryIconId }) {
  const rootProps = {
    'data-inventory-glyph': icon,
    'data-icon-tone': 'multicolor',
  }
  switch (icon) {
    case 'weapon': return <g {...rootProps}>
      <path d="m19 63 9-9 8 8-9 9Z" fill={LEATHER} {...outlined} />
      <path d="m28 54 9-9 8 8-9 9Z" fill={GOLD} {...outlined} />
      <path d="M37 46 61 12l7 1 1 7-25 33Z" fill={METAL} {...outlined} />
      <path d="m43 45 19-27" stroke={METAL_LIGHT} strokeWidth="3" strokeLinecap="round" />
    </g>
    case 'sword': return <g {...rootProps}>
      <path d="m19 68 8-14 10 9-12 10Z" fill={LEATHER} {...outlined} />
      <path d="m26 55 8-9 11 10-8 9Z" fill={GOLD} {...outlined} />
      <path d="m35 48 26-37 8 1 1 8-28 36Z" fill={METAL} {...outlined} />
      <path d="m43 47 20-29" stroke={METAL_LIGHT} strokeWidth="3" strokeLinecap="round" />
      <path d="m24 48 7-7 20 18-7 7Z" fill={GOLD_LIGHT} {...outlined} />
    </g>
    case 'dagger': return <g {...rootProps}>
      <path d="M33 53h14v18H33z" fill={LEATHER} {...outlined} />
      <path d="m28 48 12-7 12 7-12 8Z" fill={GOLD} {...outlined} />
      <path d="m40 9 15 19-15 18-15-18Z" fill={METAL} {...outlined} />
      <path d="M40 14v29l8-15Z" fill={METAL_LIGHT} />
      <path d="M29 69h22" stroke={GOLD_LIGHT} strokeWidth="4" strokeLinecap="round" />
    </g>
    case 'club': return <g {...rootProps}>
      <path d="M28 70 42 23l16 5-15 47Z" fill={WOOD} {...outlined} />
      <path d="M39 27c-8-5-10-13-5-20 11 1 21 4 29 10 1 8-3 14-11 17Z" fill="#8B4D2A" {...outlined} />
      <path d="m35 14 22 8M33 62l12 4" stroke={GOLD_LIGHT} strokeWidth="3" opacity=".7" />
      <circle cx="43" cy="16" r="3" fill={METAL_DARK} />
      <circle cx="54" cy="21" r="3" fill={METAL_DARK} />
    </g>
    case 'staff': return <g {...rootProps}>
      <path d="m29 72 16-61 10 3-16 60Z" fill={WOOD} {...outlined} />
      <path d="M45 11c-8 8-6 16 4 21 10-5 13-13 8-22-4 4-8 4-12 1Z" fill="#8C552E" {...outlined} />
      <path d="M34 55c7-3 11-1 12 5M40 36c7-3 11-1 12 5" fill="none" stroke={GOLD_LIGHT} strokeWidth="3" />
      <path d="M47 16c4 2 6 5 5 9" fill="none" stroke="#D99B55" strokeWidth="3" />
    </g>
    case 'hammer': return <g {...rootProps}>
      <path d="m27 70 11 3 15-45-11-4Z" fill={WOOD} {...outlined} />
      <path d="m34 65 13-38" stroke={GOLD_LIGHT} strokeWidth="2.5" opacity=".68" />
      <path d="M18 13h42l8 9-8 16H18L10 28Z" fill={METAL_DARK} {...outlined} />
      <path d="M20 17h36l5 6-4 7H17l-3-3Z" fill={METAL} />
      <path d="M37 20h18" stroke={METAL_LIGHT} strokeWidth="3" />
      <path d="m38 25 17 5-5 13-16-5Z" fill={GOLD} {...outlined} />
    </g>
    case 'sickle': return <g {...rootProps}>
      <path d="m27 70 11 3 13-39-11-4Z" fill={WOOD} {...outlined} />
      <path d="M43 36C44 15 59 8 71 12c-2 18-12 30-29 36Z" fill={METAL} {...outlined} />
      <path d="M48 33c3-10 10-16 18-17-3 10-9 17-18 22Z" fill={METAL_LIGHT} />
      <path d="m36 30 16 5-5 12-15-5Z" fill={GOLD} {...outlined} />
    </g>
    case 'spear': return <g {...rootProps}>
      <path d="m18 70 7 4 36-53-8-5Z" fill={WOOD} {...outlined} />
      <path d="m52 18 12-10 7 5-5 15Z" fill={METAL} {...outlined} />
      <path d="m61 13 4 3-7 7Z" fill={METAL_LIGHT} />
      <path d="m48 20 13 9-7 9-12-9Z" fill={GOLD} {...outlined} />
      <path d="m23 64 8 5" stroke={GOLD_LIGHT} strokeWidth="3" />
    </g>
    case 'polearm': return <g {...rootProps}>
      <path d="m18 71 8 4 34-58-9-5Z" fill={WOOD} {...outlined} />
      <path d="M52 17c7-10 14-11 21-5-7 4-10 11-9 22l-12-7Z" fill={METAL} {...outlined} />
      <path d="m58 15 8-5-5 12Z" fill={METAL_LIGHT} />
      <path d="m47 20 16 9-7 11-15-9Z" fill={GOLD} {...outlined} />
      <path d="M55 29 70 44" stroke={METAL_DARK} strokeWidth="4" strokeLinecap="round" />
    </g>
    case 'trident': return <g {...rootProps}>
      <path d="M35 72h10V22H35z" fill={WOOD} {...outlined} />
      <path d="M40 8v20M23 10v12c0 9 7 14 17 14s17-5 17-14V10M23 10l-5 9m39-9 5 9" fill="none" stroke={METAL} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 8v18M23 10v10m34-10v10" stroke={METAL_LIGHT} strokeWidth="2" strokeLinecap="round" />
      <path d="M30 29h20v12H30z" fill={GOLD} {...outlined} />
    </g>
    case 'flail': return <g {...rootProps}>
      <path d="m17 68 9 6 18-29-9-6Z" fill={WOOD} {...outlined} />
      <path d="m33 40 13-6 5 9-12 7Z" fill={GOLD} {...outlined} />
      <path d="M47 35c2-9 6-15 13-19m-8 22c5-8 10-12 16-13" fill="none" stroke={METAL_DARK} strokeWidth="5" strokeLinecap="round" />
      <circle cx="64" cy="17" r="11" fill={METAL} {...outlined} />
      <path d="m64 2 3 8m11 0-7 5m7 12-8-3m-8 8 2-8m-13 3 7-5m-6-12 8 4" stroke={METAL_LIGHT} strokeWidth="3.5" strokeLinecap="round" />
    </g>
    case 'bow': return <g {...rootProps}>
      <path d="M24 9c25 14 25 48 0 62 12-20 12-42 0-62Z" fill={WOOD} {...outlined} />
      <path d="M25 10 61 40 25 71" fill="none" stroke="#E8D7B4" strokeWidth="2.5" />
      <path d="M16 40h47" stroke={METAL_DARK} strokeWidth="4" strokeLinecap="round" />
      <path d="m63 40-11-7v14Z" fill={METAL} {...outlined} />
      <path d="M30 24c7 10 7 22 0 32" fill="none" stroke={GOLD_LIGHT} strokeWidth="3" />
    </g>
    case 'crossbow': return <g {...rootProps}>
      <path d="M14 19c15 8 37 8 52 0-4 15-13 23-26 23S18 34 14 19Z" fill={WOOD} {...outlined} />
      <path d="M15 20 40 40 65 20" fill="none" stroke="#E8D7B4" strokeWidth="2.5" />
      <path d="m36 33 11-1 8 39-12 2Z" fill={WOOD_DARK} {...outlined} />
      <path d="M40 10v49" stroke={METAL} strokeWidth="4" strokeLinecap="round" />
      <path d="m40 9-6 10h12Z" fill={METAL_LIGHT} {...outlined} />
      <path d="M35 35h14v12H35z" fill={GOLD} {...outlined} />
    </g>
    case 'sling': return <g {...rootProps}>
      <path d="M16 13c17 11 25 26 23 45M64 13C47 24 39 39 41 58" fill="none" stroke="#D6A867" strokeWidth="5" strokeLinecap="round" />
      <path d="M27 57c8-5 18-5 26 0l-4 14H31Z" fill={LEATHER} {...outlined} />
      <path d="M32 60c5-2 11-2 16 0" stroke={GOLD_LIGHT} strokeWidth="2.5" />
      <circle cx="16" cy="13" r="5" fill={GOLD} {...outlined} />
      <circle cx="64" cy="13" r="5" fill={GOLD} {...outlined} />
    </g>
    case 'sling-bullets': return <g {...rootProps}>
      <path d="M18 29c10-7 34-7 44 0l-5 36c-9 8-25 8-34 0Z" fill={LEATHER} {...outlined} />
      <path d="M18 29c12 6 32 6 44 0l-5 12c-10 5-24 5-34 0Z" fill="#C98142" {...outlined} />
      <path d="M25 22c9 4 21 4 30 0M24 24l-5-9m37 9 5-9" fill="none" stroke={GOLD_LIGHT} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="31" cy="38" r="6.5" fill={METAL_DARK} {...outlined} /><circle cx="43" cy="39" r="6.5" fill={METAL} {...outlined} />
      <circle cx="52" cy="34" r="6" fill={METAL_DARK} {...outlined} /><circle cx="37" cy="49" r="6.5" fill={METAL} {...outlined} />
      <circle cx="29" cy="36" r="2" fill={METAL_LIGHT} /><circle cx="41" cy="37" r="2" fill={METAL_LIGHT} /><circle cx="50" cy="32" r="2" fill={METAL_LIGHT} />
    </g>
    case 'dart': return <g {...rootProps}>
      <path d="m17 64 37-37 7 7-37 37Z" fill={METAL} {...outlined} />
      <path d="m56 29 8-18 8-3-3 10-7 17Z" fill={METAL_LIGHT} {...outlined} />
      <path d="m16 52 12 12-16 7Z" fill="#E5484D" {...outlined} />
      <path d="m27 42 12 12" stroke={GOLD} strokeWidth="5" />
    </g>
    case 'whip': return <g {...rootProps}>
      <path d="M19 64c-8-12-5-25 7-34 12-9 29-9 40-2 9 6 8 15 2 20-6 5-16 5-22 0" fill="none" stroke={LEATHER} strokeWidth="7" strokeLinecap="round" />
      <path d="M18 63c5 1 9 4 12 9" fill="none" stroke={GOLD} strokeWidth="6" strokeLinecap="round" />
      <path d="M21 36c11-9 25-10 37-5" fill="none" stroke="#D99B55" strokeWidth="2.5" opacity=".7" />
      <path d="m42 48 8-8" stroke={LEATHER_DARK} strokeWidth="4" />
    </g>
    case 'blowgun': return <g {...rootProps}>
      <path d="m13 57 45-39 9 10-45 39Z" fill={WOOD} {...outlined} />
      <path d="m56 18 8-7 12 13-9 7Z" fill={METAL_DARK} {...outlined} />
      <path d="m20 55 9 10" stroke={GOLD} strokeWidth="6" />
      <path d="M36 43 65 17" stroke={GOLD_LIGHT} strokeWidth="2" opacity=".65" />
      <path d="m10 18 20 10m-17-17 14 7" stroke="#F87171" strokeWidth="3" strokeLinecap="round" />
    </g>
    case 'net': return <g {...rootProps}>
      <path d="M16 16h48v48H16z" fill="#5A875E" fillOpacity=".2" {...outlined} />
      <path d="m16 28 12-12m-12 24 24-24M16 52l36-36M16 64l48-48M28 64l36-36M40 64l24-24M52 64l12-12M28 16l36 36M16 16l48 48M16 28l36 36M16 40l24 24M40 16l24 24M52 16l12 12" fill="none" stroke="#8CC08D" strokeWidth="2.6" />
      <circle cx="16" cy="16" r="4" fill={GOLD} {...outlined} /><circle cx="64" cy="16" r="4" fill={GOLD} {...outlined} /><circle cx="16" cy="64" r="4" fill={GOLD} {...outlined} /><circle cx="64" cy="64" r="4" fill={GOLD} {...outlined} />
    </g>
    case 'ammunition': return <g {...rootProps}>
      {[0, 1, 2].map((index) => <g key={index} transform={`translate(${index * 10 - 10} ${index * 2})`}>
        <path d="M27 65 51 22" stroke={WOOD} strokeWidth="5" strokeLinecap="round" />
        <path d="m52 23 5-14 7 5-8 12Z" fill={METAL} {...outlined} />
        <path d="m24 67-1-13 10 6Z" fill="#E5484D" {...outlined} />
      </g>)}
    </g>
    case 'light-armor': return <g {...rootProps}>
      <path d="M29 14 16 23l7 15 8-5-2 34h22l-2-34 8 5 7-15-13-9-6 7H35Z" fill="#A96A3A" {...outlined} />
      <path d="M34 20c2 7 10 7 12 0M29 43h22M28 55h24" fill="none" stroke={GOLD_LIGHT} strokeWidth="2.6" />
      <path d="m22 26 7 4m29-4-7 4" stroke={LEATHER_DARK} strokeWidth="3" />
    </g>
    case 'medium-armor': return <g {...rootProps}>
      <path d="M28 14 16 23l7 15 8-5-1 34h20l-1-34 8 5 7-15-12-9-7 6H35Z" fill="#7A96A8" {...outlined} />
      {[0, 1, 2, 3].map((row) => <path key={row} d={`M27 ${34 + row * 8}c8-5 18-5 26 0-8 5-18 5-26 0Z`} fill={row % 2 ? METAL_DARK : METAL} stroke={INK} strokeWidth="1.5" />)}
      <path d="m31 16 9 10 9-10" fill="none" stroke={GOLD} strokeWidth="3" />
    </g>
    case 'heavy-armor': return <g {...rootProps}>
      <path d="M27 14 15 24l7 16 8-5v32h20V35l8 5 7-16-12-10-8 6H35Z" fill={METAL_DARK} {...outlined} />
      <path d="M30 20h20l3 17-5 30H32l-5-30Z" fill={METAL} {...outlined} />
      <path d="M40 20v47M29 38h22M31 51h18" stroke={METAL_LIGHT} strokeWidth="2.5" />
      <path d="m30 17 10 9 10-9" fill="none" stroke={GOLD} strokeWidth="3.5" />
    </g>
    case 'armor': return <g {...rootProps}>
      <path d="M28 14 16 23l6 15 8-5v34h20V33l8 5 6-15-12-9-7 6H35Z" fill={METAL} {...outlined} />
      <path d="M35 20c2 6 8 6 10 0v47H35Z" fill={METAL_DARK} opacity=".55" />
      <path d="M26 40h28M28 52h24" stroke={METAL_LIGHT} strokeWidth="2.2" opacity=".8" />
      <path d="m31 16 9 10 9-10" fill="none" stroke={GOLD} strokeWidth="3" />
    </g>
    case 'shield': return <g {...rootProps}>
      <path d="M40 10c9 7 18 9 25 10v19c0 16-9 25-25 32-16-7-25-16-25-32V20c7-1 16-3 25-10Z" fill="#3977A8" {...outlined} />
      <path d="M40 15v50c12-6 18-13 18-26V25c-6-1-12-4-18-10Z" fill="#255173" />
      <path d="M40 20v40M24 39h32" stroke={GOLD_LIGHT} strokeWidth="4" strokeLinecap="round" />
    </g>
    case 'backpack': return <g {...rootProps}>
      <path d="M27 22c0-9 5-13 13-13s13 4 13 13" fill="none" stroke={LEATHER_DARK} strokeWidth="5" />
      <path d="M20 25c0-6 5-10 11-10h18c6 0 11 4 11 10v39H20Z" fill={LEATHER} {...outlined} />
      <path d="M22 27h36v12H22zM27 45h26v18H27z" fill="#C98142" {...outlined} />
      <path d="M40 15v48M34 50h12" stroke={GOLD_LIGHT} strokeWidth="2.4" />
    </g>
    case 'bedroll': return <g {...rootProps}>
      <path d="M15 34c0-8 6-14 14-14h24c8 0 14 6 14 14v24H29c-8 0-14-6-14-14Z" fill="#4E8B6D" {...outlined} />
      <circle cx="29" cy="44" r="14" fill="#79B992" {...outlined} />
      <circle cx="29" cy="44" r="7" fill="#D5F0DD" {...outlined} />
      <path d="M48 21v36M58 23v34" stroke="#F0C86A" strokeWidth="4" />
    </g>
    case 'clothing': return <g {...rootProps}>
      <path d="M29 14 16 22 8 38l13 7 6-9-2 34h30l-2-34 6 9 13-7-8-16-13-8-5 8H34Z" fill="#4F8C83" {...outlined} />
      <path d="M34 15c1 8 11 8 12 0l5 7-5 10H34l-5-10Z" fill="#D9F4EC" {...outlined} />
      <path d="M25 42h30v28H25z" fill="#6D5AA7" opacity=".82" />
      <path d="M40 32v38M26 45h28M28 58h24" fill="none" stroke="#D9C6FF" strokeWidth="2.6" opacity=".85" />
      <path d="m12 37 10 4m46-4-10 4" stroke={GOLD_LIGHT} strokeWidth="3" strokeLinecap="round" />
      <path d="M31 68h18" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" />
    </g>
    case 'rope': return <g {...rootProps}>
      <circle cx="40" cy="40" r="27" fill="none" stroke="#C89452" strokeWidth="8" />
      <circle cx="40" cy="40" r="14" fill="none" stroke="#E8BF79" strokeWidth="7" />
      <path d="M17 58c9 10 17 8 22 1 5-8 13-6 18 1 4 6 8 7 12 5" fill="none" stroke="#9A642E" strokeWidth="6" strokeLinecap="round" />
      <path d="M20 24c7 4 11 3 17-2m13 1c5 4 9 4 13 1" fill="none" stroke={GOLD_LIGHT} strokeWidth="2" opacity=".75" />
    </g>
    case 'string': return <g {...rootProps}>
      <path d="M25 16h30l-5 10v28l6 10H24l6-10V26Z" fill={WOOD} {...outlined} />
      <path d="M30 27h20v27H30z" fill="#E8D7B4" {...outlined} />
      <path d="M31 31h18M30 36h20M30 41h20M30 46h20M31 51h18" stroke="#C7A66A" strokeWidth="2.4" />
      <path d="M25 16h30M24 64h32" stroke={GOLD_LIGHT} strokeWidth="4" strokeLinecap="round" />
      <path d="M48 52c12 3 17 9 15 18-1 5-7 5-9 1-2-5 3-8 8-6" fill="none" stroke="#E8D7B4" strokeWidth="3" strokeLinecap="round" />
    </g>
    case 'nails': return <g {...rootProps}>
      <g transform="rotate(-34 38 40)">
        <path d="M20 35h41l8 5-8 5H20z" fill={METAL} {...outlined} />
        <path d="M14 30h10v20H14c-5 0-7-5-7-10s2-10 7-10Z" fill={METAL_DARK} {...outlined} />
        <path d="M25 38h35" stroke={METAL_LIGHT} strokeWidth="2.5" />
      </g>
      <g transform="rotate(39 42 42)">
        <path d="M24 39h35l9 4-9 5H24z" fill="#94A9BF" {...outlined} />
        <path d="M18 34h10v19H18c-5 0-7-5-7-10s2-9 7-9Z" fill="#50657A" {...outlined} />
      </g>
      <circle cx="40" cy="41" r="5" fill={GOLD_LIGHT} stroke={INK} strokeWidth="2" />
    </g>
    case 'pickaxe': return <g {...rootProps}>
      <path d="m27 69 10 3 16-45-10-4Z" fill={WOOD} {...outlined} />
      <path d="m33 66 14-39" stroke={GOLD_LIGHT} strokeWidth="2.5" opacity=".7" />
      <path d="M10 31c12-16 28-23 47-20l13 8c-18-3-35 3-49 18Z" fill={METAL} {...outlined} />
      <path d="M14 29c13-11 28-16 44-14" fill="none" stroke={METAL_LIGHT} strokeWidth="3" />
      <path d="m58 11 12 8-8 4Z" fill={METAL_DARK} {...outlined} />
      <path d="m42 23 11 4-5 9-10-4Z" fill={GOLD} {...outlined} />
    </g>
    case 'axe': return <g {...rootProps}>
      <path d="m27 70 12 2 12-48-10-3Z" fill={WOOD} {...outlined} />
      <path d="m33 66 11-41" stroke={GOLD_LIGHT} strokeWidth="2.5" opacity=".65" />
      <path d="M39 15c12-7 23-5 31 4-8 5-10 14-7 27-9 3-17 0-24-8Z" fill={METAL} {...outlined} />
      <path d="M45 17c8-3 14-1 20 3-6 5-8 11-7 20" fill="none" stroke={METAL_LIGHT} strokeWidth="3" />
      <path d="m36 17 13 4-5 20-13-4Z" fill={GOLD} {...outlined} />
    </g>
    case 'torch': return <g {...rootProps}>
      <path d="M34 35h12l6 34H28Z" fill={WOOD} {...outlined} />
      <path d="M31 38h18M32 46h16" stroke={GOLD_LIGHT} strokeWidth="3" />
      <path d="M40 8c12 10 15 20 8 28-3 4-7 6-11 5-9-2-12-11-7-19 1 5 4 7 7 7-2-7 0-14 3-21Z" fill="#FF7A2F" {...outlined} />
      <path d="M41 20c6 6 6 11 2 15-4 3-9 0-8-5 1 2 3 2 4 1-1-4 0-8 2-11Z" fill="#FFE36E" />
    </g>
    case 'tinderbox': return <g {...rootProps}>
      <path d="M16 32h48v32H16z" fill={WOOD} {...outlined} />
      <path d="M13 27h54v12H13z" fill="#D88B45" {...outlined} />
      <path d="M29 48h22v16H29z" fill={LEATHER_DARK} {...outlined} />
      <path d="m52 16 3-8m3 14 8-5m-22 4-7-6" stroke="#FFD75A" strokeWidth="4" strokeLinecap="round" />
      <circle cx="51" cy="25" r="4" fill="#FF7A2F" />
    </g>
    case 'oil-flask': return <g {...rootProps}>
      <path d="M30 12h20v10l-5 6v5c10 5 15 14 15 25 0 8-5 12-13 12H33c-8 0-13-4-13-12 0-11 5-20 15-25v-5l-5-6Z" fill="#B7D7DE" {...outlined} />
      <path d="M22 46c10 3 26-3 36 0 2 4 2 8 2 12 0 7-5 10-13 10H33c-8 0-13-3-13-10 0-4 0-8 2-12Z" fill="#C27A20" />
      <path d="M29 49c8 2 18-3 27-1" fill="none" stroke="#FFD27A" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M30 12h20v10H30z" fill={WOOD_DARK} {...outlined} />
      <path d="M40 39c6 8 8 12 8 16a8 8 0 0 1-16 0c0-4 2-8 8-16Z" fill="#F5B642" {...outlined} />
      <path d="M39 47c-3 5-3 9 0 12" fill="none" stroke="#FFF1A8" strokeWidth="2.5" strokeLinecap="round" />
    </g>
    case 'waterskin': return <g {...rootProps}>
      <path d="M32 11h16l-2 10c9 7 14 19 14 31 0 11-8 17-20 17s-20-6-20-17c0-12 5-24 14-31Z" fill="#4D91C8" {...outlined} />
      <path d="M32 11h16v10H32z" fill={LEATHER} {...outlined} />
      <path d="M23 49c10 5 24-4 34 0" fill="none" stroke="#A9E8FF" strokeWidth="4" />
      <path d="M29 30c-6 9-7 17-5 23" fill="none" stroke="#DDF8FF" strokeWidth="3" opacity=".7" />
    </g>
    case 'rations': return <g {...rootProps}>
      <path d="M12 54c4-13 14-22 27-22 12 0 23 9 29 22-9 11-46 11-56 0Z" fill="#D9A35F" {...outlined} />
      <path d="M20 48c9-8 29-11 40 0" fill="none" stroke={GOLD_LIGHT} strokeWidth="3" />
      <path d="M25 28c0-10 7-17 16-17s16 7 16 17c-10-4-22-4-32 0Z" fill="#E6BC77" {...outlined} />
      <path d="M33 14c3 4 4 8 2 12m12-12c-3 4-4 8-2 12" stroke="#FFF0BE" strokeWidth="2" />
    </g>
    case 'healers-kit': return <g {...rootProps}>
      <path d="M17 25h46v40H17z" fill="#E9F1F7" {...outlined} />
      <path d="M28 25v-7c0-5 4-8 9-8h6c5 0 9 3 9 8v7" fill="none" stroke={METAL_DARK} strokeWidth="5" />
      <path d="M34 33h12v9h9v12h-9v9H34v-9h-9V42h9Z" fill="#E5484D" {...outlined} />
      <path d="M17 31h46" stroke={METAL_DARK} strokeWidth="3" />
    </g>
    case 'ball-bearings': return <g {...rootProps}>
      {[[22, 28], [39, 19], [56, 29], [29, 45], [49, 47], [39, 62], [62, 57], [17, 59]].map(([cx, cy], index) => (
        <g key={index}><circle cx={cx} cy={cy} r="8" fill={METAL} {...outlined} /><circle cx={cx - 2} cy={cy - 2} r="2.4" fill={METAL_LIGHT} /></g>
      ))}
    </g>
    case 'caltrops': return <g {...rootProps}>
      <path d="m40 9 7 27 23 15-27-3-20 20 8-27-15-23 24 14Z" fill={METAL} {...outlined} />
      <path d="m40 16 2 24 19 10-21-6-13 15 9-18-13-17 16 12Z" fill={METAL_LIGHT} opacity=".72" />
      <circle cx="40" cy="42" r="7" fill={METAL_DARK} {...outlined} />
    </g>
    case 'hunting-trap': return <g {...rootProps}>
      <path d="M14 41c6-13 16-20 26-20s20 7 26 20c-6 13-16 20-26 20S20 54 14 41Z" fill={METAL_DARK} {...outlined} />
      <path d="m17 41 9-8 4 10 6-14 5 15 7-14 4 13 10-9" fill={METAL_LIGHT} {...outlined} />
      <circle cx="40" cy="43" r="9" fill="#7C4A26" {...outlined} />
      <path d="M40 52v18h20" fill="none" stroke={METAL_DARK} strokeWidth="5" />
    </g>
    case 'acid': return <g {...rootProps}><Bottle liquid="#77D65B"><circle cx="34" cy="57" r="3" fill="#D9FF83" /><circle cx="47" cy="52" r="2" fill="#D9FF83" /></Bottle></g>
    case 'alchemists-fire': return <g {...rootProps}>
      <Bottle liquid="#F04438"><path d="M40 38c9 7 11 14 6 20-3 4-9 4-12 0-4-5-2-11 2-16 0 4 2 6 4 6-1-4-1-7 0-10Z" fill="#FFD452" {...outlined} /></Bottle>
      <path d="M51 10c4-7 10-7 14-2-6 0-8 3-8 8" fill="#FF8A34" {...outlined} />
    </g>
    case 'holy-water': return <g {...rootProps}>
      <Bottle liquid="#54B9E8"><path d="M36 43h8v7h7v8h-7v7h-8v-7h-7v-8h7Z" fill={GOLD_LIGHT} stroke={INK} strokeWidth="1.8" /></Bottle>
      <path d="m26 40 4-4m24 4-4-4" stroke="#FFFFFF" strokeWidth="2.5" />
    </g>
    case 'antitoxin': return <g {...rootProps}>
      <Bottle liquid="#23B7A4"><path d="M29 56c7-10 15 9 23-4-3 10-9 13-17 8" fill="none" stroke="#E4FFF8" strokeWidth="3" strokeLinecap="round" /></Bottle>
      <path d="m20 31 8 3-6 5m38-8-8 3 6 5" fill={GOLD} {...outlined} />
    </g>
    case 'poison': return <g {...rootProps}>
      <Bottle liquid="#7C3FB5"><circle cx="40" cy="53" r="8" fill="#EEE3FF" {...outlined} /><circle cx="37" cy="51" r="1.8" fill={INK} /><circle cx="43" cy="51" r="1.8" fill={INK} /><path d="m37 58 3-2 3 2" fill="none" stroke={INK} strokeWidth="1.8" /></Bottle>
    </g>
    case 'healing-potion': return <g {...rootProps}>
      <Bottle liquid="#DE3C55"><path d="M36 42h8v7h7v8h-7v7h-8v-7h-7v-8h7Z" fill="#FFF3F3" stroke={INK} strokeWidth="1.8" /></Bottle>
      <path d="m26 37 3-4m25 4-3-4" stroke="#FFB4BE" strokeWidth="3" />
    </g>
    case 'perfume': return <g {...rootProps}>
      <path d="M25 29h30l6 10v26c0 4-3 7-7 7H26c-4 0-7-3-7-7V39Z" fill={GLASS} {...outlined} />
      <path d="M21 49h38v16c0 3-2 5-5 5H26c-3 0-5-2-5-5Z" fill="#F59BC4" />
      <path d="M30 18h20v12H30z" fill={GOLD} {...outlined} />
      <path d="M34 10h12v9H34z" fill={METAL} {...outlined} />
      <path d="M46 13h15M61 13l7-5m-7 5 7 5" fill="none" stroke={METAL_DARK} strokeWidth="3" strokeLinecap="round" />
      <path d="M27 39h26M29 53c7 3 15 3 22 0" fill="none" stroke="#FFFFFF" strokeWidth="2.3" opacity=".75" />
      <path d="m40 43 3 5 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1Z" fill="#FFF1F7" stroke="#A83E70" strokeWidth="1.4" />
    </g>
    case 'small-knife': return <g {...rootProps}>
      <path d="m17 62 9 10 25-24-10-10Z" fill={WOOD} {...outlined} />
      <path d="m21 59 10 10M28 52l10 10" stroke={GOLD_LIGHT} strokeWidth="2.5" />
      <path d="m38 40 9-9 9 9-9 10Z" fill={GOLD} {...outlined} />
      <path d="M48 32 67 11c4 12 1 24-11 34Z" fill={METAL} {...outlined} />
      <path d="M54 31 65 15c1 8-2 16-9 24Z" fill={METAL_LIGHT} />
      <circle cx="29" cy="60" r="2.5" fill={METAL_DARK} />
    </g>
    case 'dulcimer': return <g {...rootProps}>
      <path d="m19 24 42 0 11 39H8Z" fill={WOOD} {...outlined} />
      <path d="m24 30 32 0 7 27H17Z" fill="#D9954F" {...outlined} />
      <circle cx="40" cy="43" r="7" fill={WOOD_DARK} {...outlined} />
      <path d="M25 27 19 60M33 27l-4 33M40 27v33M47 27l4 33M55 27l6 33" stroke={GOLD_LIGHT} strokeWidth="1.8" />
      <path d="m15 14 10 7M65 14l-10 7" stroke={METAL_DARK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="13" cy="12" r="5" fill={METAL} {...outlined} /><circle cx="67" cy="12" r="5" fill={METAL} {...outlined} />
      <path d="M13 17 30 42M67 17 50 42" stroke={WOOD_DARK} strokeWidth="3.5" strokeLinecap="round" />
    </g>
    case 'spellcasting-focus': return <g {...rootProps}>
      <path d="m40 8 18 22-7 34-11 8-11-8-7-34Z" fill="#7DD3FC" {...outlined} />
      <path d="m40 8 5 24-5 40-11-8 6-31Z" fill="#BAE6FD" />
      <path d="m40 8 18 22-13 3Z" fill={MAGIC_LIGHT} opacity=".82" />
      <path d="M12 50h10m46 0H58M18 23l8 6m36-6-8 6" stroke={GOLD_LIGHT} strokeWidth="3" />
    </g>
    case 'magic-ring': return <g {...rootProps}>
      <circle cx="40" cy="45" r="22" fill="none" stroke={GOLD} strokeWidth="10" />
      <circle cx="40" cy="45" r="16" fill="none" stroke={GOLD_LIGHT} strokeWidth="2.5" opacity=".9" />
      <path d="m29 24 11-15 11 15-11 10Z" fill="#67E8F9" {...outlined} />
      <path d="m40 9 3 15-3 10-4-10Z" fill="#D8FAFF" />
    </g>
    case 'magic-potion': return <g {...rootProps}>
      <Bottle liquid="#8B5CF6">
        <path d="m40 40 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill={MAGIC_LIGHT} stroke={INK} strokeWidth="1.6" />
      </Bottle>
      <circle cx="19" cy="32" r="3" fill="#67E8F9" /><circle cx="63" cy="38" r="2.5" fill="#F9A8D4" />
    </g>
    case 'magic-wand': return <g {...rootProps}>
      <path d="m17 65 38-42 9 8-39 42Z" fill={WOOD_DARK} {...outlined} />
      <path d="m47 31 8-8 9 8-8 9Z" fill={GOLD} {...outlined} />
      <path d="m58 16 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill={MAGIC_LIGHT} stroke={MAGIC} strokeWidth="2" />
      <circle cx="45" cy="16" r="3" fill="#67E8F9" /><circle cx="68" cy="39" r="2.5" fill="#F9A8D4" />
    </g>
    case 'magic-staff': return <g {...rootProps}>
      <path d="M34 70 43 24l8 2-9 46Z" fill={WOOD} {...outlined} />
      <path d="M46 27c-10-7-10-17 0-20 10 3 10 13 0 20Z" fill={MAGIC} {...outlined} />
      <path d="M46 10c5 4 5 9 0 14-4-4-4-9 0-14Z" fill={MAGIC_LIGHT} />
      <path d="M43 31c-9-1-14-6-15-14 8 0 14 4 18 10m3 4c9-1 14-6 15-14-8 0-14 4-18 10" fill="none" stroke="#70C98B" strokeWidth="4" />
    </g>
    case 'magic-rod': return <g {...rootProps}>
      <path d="m24 68 31-45 10 7-31 45Z" fill={METAL_DARK} {...outlined} />
      <path d="m29 65 29-41" stroke={METAL_LIGHT} strokeWidth="3" opacity=".7" />
      <path d="m51 24 8-15 12 9-7 14Z" fill={GOLD} {...outlined} />
      <path d="m60 10 7-3 5 7-3 7Z" fill={MAGIC} {...outlined} />
      <path d="m28 58 12 9-7 9-12-8Z" fill={GOLD_LIGHT} {...outlined} />
      <path d="m51 16-8-5m20 28 7 5" stroke="#67E8F9" strokeWidth="3" strokeLinecap="round" />
    </g>
    case 'magic-scroll': return <g {...rootProps}>
      <path d="M23 15h38c-6 4-7 11-2 16v35H21c6-5 7-12 2-17Z" fill="#F3E4B5" {...outlined} />
      <path d="M23 15c-8 0-10 10-3 14h39c-6-4-4-14 2-14ZM21 66c-7-4-5-14 2-17h36c-6 4-7 12 0 17Z" fill="#D5B873" {...outlined} />
      <path d="M31 36h20M31 44h16M31 52h18" stroke="#7C4A32" strokeWidth="2.6" />
      <path d="m43 25 3 5 6 1-4 4 1 6-6-3-5 3 1-6-4-4 6-1Z" fill={MAGIC} />
    </g>
    case 'magic-wondrous': return <g {...rootProps}>
      <circle cx="40" cy="40" r="24" fill={MAGIC} {...outlined} />
      <circle cx="34" cy="33" r="12" fill={MAGIC_LIGHT} opacity=".65" />
      <path d="m40 14 5 16 17-3-13 11 10 14-16-7-7 16-1-18-18 2 16-9-10-14 15 9Z" fill="#FFF2A8" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="40" cy="40" r="5" fill="#FFFFFF" />
    </g>
    case 'container': return <g {...rootProps}>
      <path d="M14 31h52v36H14z" fill={WOOD} {...outlined} />
      <path d="M18 18h44l7 13H11Z" fill="#D58A45" {...outlined} />
      <path d="M18 38h44M40 31v36" fill="none" stroke={WOOD_DARK} strokeWidth="3" />
      <path d="M34 43h12v13H34z" fill={GOLD} {...outlined} />
      <path d="M38 47h4v6h-4z" fill={INK} />
      <path d="M17 24h46" stroke={GOLD_LIGHT} strokeWidth="2.5" opacity=".8" />
    </g>
    case 'book': return <g {...rootProps}>
      <path d="M10 18c11-4 22-2 30 5v46c-8-7-19-9-30-5Z" fill="#F3E4B5" {...outlined} />
      <path d="M70 18c-11-4-22-2-30 5v46c8-7 19-9 30-5Z" fill="#E4C987" {...outlined} />
      <path d="M40 23v46" stroke={WOOD_DARK} strokeWidth="3" />
      <path d="M17 31c6-1 11 0 16 3M17 40c6-1 11 0 16 3M47 34c5-3 11-4 16-3M47 43c5-3 11-4 16-3" fill="none" stroke="#8A6238" strokeWidth="2.4" strokeLinecap="round" />
      <path d="m40 20 5-8 5 8-5 10Z" fill={GOLD} {...outlined} />
    </g>
    case 'instrument': return <g {...rootProps}>
      <path d="M31 45c-11 4-16 13-11 22 5 8 17 8 25 2 8-7 8-18 1-25Z" fill="#C77A38" {...outlined} />
      <circle cx="33" cy="57" r="7" fill={WOOD_DARK} {...outlined} />
      <path d="m42 46 17-34 8 4-16 35Z" fill={WOOD} {...outlined} />
      <path d="m57 15 8-7 7 5-4 10Z" fill={GOLD} {...outlined} />
      <path d="M45 44 64 15M41 48l18 12" stroke={GOLD_LIGHT} strokeWidth="2.2" />
      <path d="M19 32c5-6 10-7 15-3m-18-9c7-7 14-8 21-3" fill="none" stroke={MAGIC_LIGHT} strokeWidth="3" strokeLinecap="round" />
    </g>
    case 'tool': return <g {...rootProps}>
      <path d="M13 38h54v31H13z" fill={LEATHER} {...outlined} />
      <path d="M25 38v-8c0-6 5-10 11-10h8c6 0 11 4 11 10v8" fill="none" stroke={METAL_DARK} strokeWidth="5" />
      <path d="M13 45h54M34 45v9h12v-9" fill="none" stroke={GOLD} strokeWidth="4" />
      <path d="m23 14 8-5 15 25-8 5Z" fill={WOOD} {...outlined} />
      <path d="M16 9h20v13H16z" fill={METAL} {...outlined} />
      <path d="M18 11h15" stroke={METAL_LIGHT} strokeWidth="3" />
      <path d="m51 12 7-4 10 18-7 4Z" fill={METAL_DARK} {...outlined} />
    </g>
    case 'gaming-set': return <g {...rootProps}>
      <rect x="10" y="38" width="31" height="31" rx="5" fill="#F2E7CF" {...outlined} transform="rotate(-8 25.5 53.5)" />
      <circle cx="20" cy="48" r="3" fill={INK} /><circle cx="32" cy="59" r="3" fill={INK} /><circle cx="19" cy="64" r="3" fill={INK} />
      <path d="M49 20h19v19H49z" fill="#E5484D" {...outlined} transform="rotate(9 58.5 29.5)" />
      <path d="m58 23 3 5 5 2-4 4 1 6-5-3-5 3 1-6-4-4 5-2Z" fill={GOLD_LIGHT} />
      <path d="M50 67h23M55 60h13l-3-9h-7Z" fill={GOLD} {...outlined} />
      <circle cx="61.5" cy="45" r="7" fill={METAL_LIGHT} {...outlined} />
    </g>
    case 'mount': return <g {...rootProps}>
      <path d="M27 68c-5-15-4-31 3-46l10-12 9 12c10 6 16 16 17 30-7 13-20 20-39 16Z" fill="#9B6339" {...outlined} />
      <path d="m31 25-12-13 2 22m27-11 13-12-3 23" fill="#B77A48" {...outlined} />
      <path d="M34 43c7 4 14 4 21 0l-2 14c-6 7-13 8-20 1Z" fill="#D6A06B" {...outlined} />
      <circle cx="34" cy="37" r="3" fill={INK} /><circle cx="53" cy="37" r="3" fill={INK} />
      <path d="M20 52c14 10 31 12 48 2" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
      <path d="M40 59v12" stroke={LEATHER_DARK} strokeWidth="3" />
    </g>
    case 'vehicle': return <g {...rootProps}>
      <path d="M12 25h49l8 28H18Z" fill="#B87336" {...outlined} />
      <path d="M19 28h40l4 16H16Z" fill="#D99A55" {...outlined} />
      <path d="M21 21h37M25 13v17M54 13v17" fill="none" stroke={WOOD_DARK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="25" cy="59" r="12" fill={METAL_DARK} {...outlined} />
      <circle cx="57" cy="59" r="12" fill={METAL_DARK} {...outlined} />
      <circle cx="25" cy="59" r="5" fill={GOLD} {...outlined} /><circle cx="57" cy="59" r="5" fill={GOLD} {...outlined} />
      <path d="M68 37h8" stroke={GOLD_LIGHT} strokeWidth="4" strokeLinecap="round" />
    </g>
    case 'ship': return <g {...rootProps}>
      <path d="M13 50h57L58 67H25Z" fill={WOOD} {...outlined} />
      <path d="M39 10h5v42h-5z" fill={WOOD_DARK} {...outlined} />
      <path d="M44 14c13 5 21 14 23 28H44Z" fill="#F2E7CF" {...outlined} />
      <path d="M38 19c-10 5-17 12-20 23h20Z" fill="#D8ECF4" {...outlined} />
      <path d="M20 58c13 4 27 4 41 0" fill="none" stroke={GOLD_LIGHT} strokeWidth="3" />
      <path d="M10 72c8-5 16-5 24 0 8-5 16-5 24 0 6-4 12-4 18-1" fill="none" stroke="#67C4E8" strokeWidth="4" strokeLinecap="round" />
    </g>
    case 'generic': return <g {...rootProps}>
      <path d="M14 27 40 13l26 14-26 15Z" fill="#D39455" {...outlined} />
      <path d="M14 27v31l26 14V42Z" fill="#9B5C2E" {...outlined} />
      <path d="M66 27v31L40 72V42Z" fill="#B8753C" {...outlined} />
      <path d="m31 18 26 14v13l-8 4V37L23 23Z" fill={GOLD_LIGHT} opacity=".78" />
      <path d="M40 42v30" stroke="#F2C07C" strokeWidth="2.5" />
    </g>
  }
}

interface Dnd5eInventoryGlyphProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  icon: Dnd5eInventoryIconId
}

export default function Dnd5eInventoryGlyph({ icon, className = '', ...props }: Dnd5eInventoryGlyphProps) {
  return (
    <svg viewBox="0 0 80 80" className={className} role="img" {...props}>
      <Dnd5eInventoryGlyphShapes icon={icon} />
    </svg>
  )
}
