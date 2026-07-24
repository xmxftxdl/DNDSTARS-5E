interface BannerRibbonTailProps {
  side: 'left' | 'right'
}

const LEFT_PATHS = {
  ribbon: 'M180 11 C147 14 122 21 96 19 C68 17 42 8 24 15 C34 23 36 31 27 36 C20 40 10 41 0 42 C12 43 21 46 27 51 C37 59 33 69 24 77 C48 72 68 66 96 67 C124 68 149 73 180 75 Z',
  fold: 'M176 18 C156 20 141 25 127 31 C137 39 138 50 128 61 C145 59 161 64 178 70 C168 55 168 33 176 18 Z',
  front: 'M146 12 C158 16 168 15 179 10 C171 26 170 57 179 75 C168 70 157 69 146 73 C154 54 154 31 146 12 Z',
  highlight: 'M150 17 C158 20 166 19 174 15 C168 31 168 54 174 69',
} as const

const RIGHT_PATHS = {
  ribbon: 'M0 11 C33 14 58 21 84 19 C112 17 138 8 156 15 C146 23 144 31 153 36 C160 40 170 41 180 42 C168 43 159 46 153 51 C143 59 147 69 156 77 C132 72 112 66 84 67 C56 68 31 73 0 75 Z',
  fold: 'M4 18 C24 20 39 25 53 31 C43 39 42 50 52 61 C35 59 19 64 2 70 C12 55 12 33 4 18 Z',
  front: 'M34 12 C22 16 12 15 1 10 C9 26 10 57 1 75 C12 70 23 69 34 73 C26 54 26 31 34 12 Z',
  highlight: 'M30 17 C22 20 14 19 6 15 C12 31 12 54 6 69',
} as const

export default function BannerRibbonTail({ side }: BannerRibbonTailProps) {
  const paths = side === 'left' ? LEFT_PATHS : RIGHT_PATHS
  return (
    <div className={`kill-streak-banner__tail kill-streak-banner__tail--${side}`}>
      <svg
        className="kill-streak-banner__tail-svg"
        viewBox="0 0 180 84"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-ribbon-side={side}
      >
        <path
          className="kill-streak-banner__tail-ribbon"
          d={paths.ribbon}
          transform="translate(0 7)"
          data-ribbon-layer="rear"
        />
        <path className="kill-streak-banner__tail-fold" d={paths.fold} />
        <path className="kill-streak-banner__tail-front" d={paths.front} />
        <path className="kill-streak-banner__tail-highlight" d={paths.highlight} />
      </svg>
    </div>
  )
}
