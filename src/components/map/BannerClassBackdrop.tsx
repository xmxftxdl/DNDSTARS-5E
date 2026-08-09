import { Dnd5eClassBackdrop } from './Dnd5eActionIcon'

interface BannerClassBackdropProps {
  classId: string
  color: string
  glow: string
}

export default function BannerClassBackdrop({
  classId,
  color,
  glow,
}: BannerClassBackdropProps) {
  return (
    <div
      className="combat-banner-class-backdrop"
      data-combat-class-backdrop={classId}
      aria-hidden="true"
    >
      <svg
        className={`combat-banner-class-backdrop__main${classId === 'bard' ? ' combat-banner-class-backdrop__main--bard' : ''}${classId === 'ranger' ? ' combat-banner-class-backdrop__main--ranger' : ''}${classId === 'rogue' ? ' combat-banner-class-backdrop__main--rogue' : ''}${classId === 'barbarian' ? ' combat-banner-class-backdrop__main--barbarian' : ''}`}
        viewBox="0 0 80 80"
        role="presentation"
      >
        <Dnd5eClassBackdrop classId={classId} color={color} glow={glow} />
      </svg>
      {classId === 'wizard' ? (
        <>
          {(['left', 'right'] as const).map((position) => (
            <svg
              className={`combat-banner-class-backdrop__mini combat-banner-class-backdrop__mini--${position}`}
              viewBox="0 0 80 80"
              role="presentation"
              data-combat-mini-sigil={position}
              key={position}
            >
              <Dnd5eClassBackdrop classId={classId} color={color} glow={glow} />
            </svg>
          ))}
        </>
      ) : null}
      {classId === 'bard' ? (
        <div className="combat-banner-class-backdrop__bard-notes">
          {(['left', 'right'] as const).flatMap((side) => (
            [
              <span
                className={`combat-banner-class-backdrop__bard-note combat-banner-class-backdrop__bard-note--${side}-primary`}
                key={`${side}-primary`}
              >
                🎵
              </span>,
              <span
                className={`combat-banner-class-backdrop__bard-note combat-banner-class-backdrop__bard-note--${side}-secondary`}
                key={`${side}-secondary`}
              >
                ♪
              </span>,
            ]
          ))}
        </div>
      ) : null}
      {classId === 'fighter' ? (
        <div className="combat-banner-class-backdrop__fighter-swords">
          {(['left', 'right'] as const).map((side) => (
            <svg
              className={`combat-banner-class-backdrop__fighter-sword combat-banner-class-backdrop__fighter-sword--${side}`}
              viewBox="0 0 80 80"
              role="presentation"
              data-combat-fighter-sword={side}
              key={side}
            >
              <circle cx="40" cy="9" r="4.5" fill={color} stroke={glow} strokeWidth="1.5" />
              <path
                d="M37 13h6l2 16H35l2-16Z"
                fill={color}
                stroke={glow}
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M24 29q16-7 32 0l-3 6q-13-5-26 0l-3-6Z"
                fill={color}
                stroke={glow}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M35 34h10l-2 42-3 9-3-9-2-42Z"
                fill={color}
                stroke={glow}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M40 38v37" fill="none" stroke="#ffffff" strokeWidth="1.15" strokeLinecap="round" opacity=".68" />
            </svg>
          ))}
        </div>
      ) : null}
      {classId === 'barbarian' ? (
        <>
          <svg
            className="combat-banner-class-backdrop__barbarian-skull"
            viewBox="0 0 180 150"
            preserveAspectRatio="none"
            role="presentation"
            data-combat-barbarian-center="horned-skull"
          >
            <g className="combat-banner-class-backdrop__barbarian-skull-pulse">
              <path d="M73 56C50 57 26 43 14 13c24 12 37 4 47 1-2 16 3 29 12 42Z" fill={color} stroke={glow} strokeWidth="2.4" strokeLinejoin="round" opacity=".72" />
              <path d="M107 56c23 1 47-13 59-43-24 12-37 4-47 1 2 16-3 29-12 42Z" fill={color} stroke={glow} strokeWidth="2.4" strokeLinejoin="round" opacity=".72" />
              <path d="M90 34c-27 0-43 21-39 51l12 36 18 10h18l18-10 12-36c4-30-12-51-39-51Z" fill={color} stroke={glow} strokeWidth="3" strokeLinejoin="round" opacity=".52" />
              <path d="M62 77q15-14 27 2-12 16-29 5l2-7Zm56 0q-15-14-27 2 12 16 29 5l-2-7Z" fill={glow} opacity=".9" />
              <path d="m90 82-9 22 9 7 9-7-9-22Z" fill={glow} stroke={color} strokeWidth="1.5" />
              <path d="M71 118v18m9-14v17m10-17v20m10-20v17m9-21v18" fill="none" stroke={glow} strokeWidth="2.2" strokeLinecap="round" />
              <path className="combat-banner-class-backdrop__barbarian-eye-flare" d="M64 80q13-8 23 0m29 0q-13-8-23 0" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
          <div className="combat-banner-class-backdrop__barbarian-axes">
            {(['left', 'right'] as const).map((side) => (
              <svg
                className={`combat-banner-class-backdrop__barbarian-axe combat-banner-class-backdrop__barbarian-axe--${side}`}
                viewBox="0 0 88 92"
                role="presentation"
                data-combat-barbarian-axe={side}
                key={side}
              >
                <path d="M24 83 53 27" fill="none" stroke={glow} strokeWidth="8" strokeLinecap="round" />
                <path d="M24 83 53 27" fill="none" stroke={color} strokeWidth="4.6" strokeLinecap="round" />
                <path d="M47 18Q66 3 82 10q1 23-18 37L47 35l-5-8 5-9Z" fill={color} stroke={glow} strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M48 21q17-9 29-8-3 17-15 28" fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity=".62" />
                <path d="m29 69 9 5m-13 3 9 5M43 42l9 5" fill="none" stroke={glow} strokeWidth="2.2" strokeLinecap="round" opacity=".78" />
              </svg>
            ))}
          </div>
        </>
      ) : null}
      {classId === 'druid' ? (
        <div className="combat-banner-class-backdrop__druid-saplings">
          {(['left', 'right'] as const).map((side) => (
            <svg
              className={`combat-banner-class-backdrop__druid-sapling combat-banner-class-backdrop__druid-sapling--${side}`}
              viewBox="0 0 80 88"
              role="presentation"
              data-combat-druid-sapling={side}
              key={side}
            >
              <path
                d="M40 80V42m0 13L27 43m13 2 14-15M34 50l-8-17m20 7 9-14"
                fill="none"
                stroke={glow}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M40 80V42m0 13L27 43m13 2 14-15M34 50l-8-17m20 7 9-14"
                fill="none"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M28 42C15 42 11 31 16 21c12 0 19 8 12 21Z" fill={color} stroke={glow} strokeWidth="1.4" />
              <path d="M53 31c-3-13 7-21 19-20 3 11-5 20-19 20Z" fill={color} stroke={glow} strokeWidth="1.4" />
              <path d="M25 34C13 30 12 19 19 12c10 3 14 12 6 22Z" fill={color} stroke={glow} strokeWidth="1.4" />
              <path d="M55 27c-2-11 6-18 16-17 2 9-5 17-16 17Z" fill={color} stroke={glow} strokeWidth="1.4" />
              <path d="M19 70q21-9 42 0M25 76q15-7 30 0" fill="none" stroke={glow} strokeWidth="1.5" strokeLinecap="round" opacity=".72" />
              <path d="M21 26q7 6 17 20M68 15Q58 20 46 39" fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity=".52" />
            </svg>
          ))}
        </div>
      ) : null}
      {classId === 'sorcerer' ? (
        <div className="combat-banner-class-backdrop__sorcerer-waves">
          {(['left', 'right'] as const).map((side) => (
            <svg
              className={`combat-banner-class-backdrop__sorcerer-wave combat-banner-class-backdrop__sorcerer-wave--${side}`}
              viewBox="0 0 120 82"
              role="presentation"
              data-combat-sorcerer-wave={side}
              key={side}
            >
              <g className="combat-banner-class-backdrop__sorcerer-wave-flow">
                <path
                  d="M7 51C23 17 47 13 66 35c15 18 29 20 48-3"
                  fill="none"
                  stroke={glow}
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity=".22"
                />
                <path className="combat-banner-class-backdrop__sorcerer-wave-line combat-banner-class-backdrop__sorcerer-wave-line--primary" d="M7 51C23 17 47 13 66 35c15 18 29 20 48-3" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
                <path className="combat-banner-class-backdrop__sorcerer-wave-line combat-banner-class-backdrop__sorcerer-wave-line--secondary" d="M5 66c23-27 43-28 61-10 15 14 31 11 49-7" fill="none" stroke={glow} strokeWidth="2.1" strokeLinecap="round" />
                <path className="combat-banner-class-backdrop__sorcerer-wave-line combat-banner-class-backdrop__sorcerer-wave-line--tertiary" d="M13 34C30 5 51 9 65 25c14 17 29 17 44-7" fill="none" stroke="#ffffff" strokeWidth="1.35" strokeLinecap="round" opacity=".72" />
                <path d="M66 35c9-9 19-7 22 1 3 9-8 17-16 11-5-4-4-10 1-13" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity=".78" />
              </g>
              <g className="combat-banner-class-backdrop__sorcerer-wave-motes">
                <circle cx="29" cy="18" r="3" fill={glow} />
                <circle cx="52" cy="12" r="2" fill={color} />
                <circle cx="97" cy="24" r="2.6" fill={glow} />
                <circle cx="107" cy="60" r="1.8" fill="#ffffff" />
              </g>
            </svg>
          ))}
        </div>
      ) : null}
      {classId === 'warlock' ? (
        <div className="combat-banner-class-backdrop__warlock-books">
          {(['left', 'right'] as const).map((side) => (
            <svg
              className={`combat-banner-class-backdrop__warlock-book combat-banner-class-backdrop__warlock-book--${side}`}
              viewBox="0 0 100 84"
              role="presentation"
              data-combat-warlock-book={side}
              key={side}
            >
              <path d="M10 69q18-8 40 1 22-9 40-1l-4 8q-17-5-36 1-19-6-36-1l-4-8Z" fill={glow} opacity=".42" />
              <g className="combat-banner-class-backdrop__warlock-book-half combat-banner-class-backdrop__warlock-book-half--left">
                <path d="M50 70Q32 58 11 65l4-39q20-6 35 8v36Z" fill={color} stroke={glow} strokeWidth="2" strokeLinejoin="round" />
                <path d="M46 63Q32 54 19 58l2-25q13-3 25 7v23Z" fill="none" stroke={glow} strokeWidth="1.25" opacity=".72" />
                <path d="M24 40q10-2 18 5M23 47q10-1 19 5" fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity=".55" />
              </g>
              <g className="combat-banner-class-backdrop__warlock-book-half combat-banner-class-backdrop__warlock-book-half--right">
                <path d="M50 70q18-12 39-5l-4-39q-20-6-35 8v36Z" fill={color} stroke={glow} strokeWidth="2" strokeLinejoin="round" />
                <path d="M54 63q14-9 27-5l-2-25q-13-3-25 7v23Z" fill="none" stroke={glow} strokeWidth="1.25" opacity=".72" />
                <path d="M76 40q-10-2-18 5m19 2q-10-1-19 5" fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity=".55" />
              </g>
              <path d="M50 34v37" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" opacity=".72" />
              <path
                className="combat-banner-class-backdrop__warlock-turning-page"
                d="M50 68Q63 50 82 29q-18-3-32 7v32Z"
                fill={color}
                stroke={glow}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <g className="combat-banner-class-backdrop__warlock-book-runes" fill="none" stroke={glow} strokeLinecap="round">
                <circle cx="36" cy="17" r="3" strokeWidth="1.6" />
                <path d="m63 18 4-7 4 7-4 6-4-6ZM48 18l2-6 2 6-2 5-2-5Z" strokeWidth="1.5" strokeLinejoin="round" />
              </g>
            </svg>
          ))}
        </div>
      ) : null}
      {classId === 'ranger' ? (
        <>
          <svg
            className="combat-banner-class-backdrop__ranger-center"
            viewBox="0 0 160 160"
            role="presentation"
            data-combat-ranger-center="hunter-compass"
          >
            <g className="combat-banner-class-backdrop__ranger-compass-orbit">
              <circle cx="80" cy="80" r="58" fill="none" stroke={glow} strokeWidth="2.2" strokeDasharray="11 6 2 6" />
              <circle cx="80" cy="80" r="45" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 5" />
              <circle cx="80" cy="80" r="34" fill="none" stroke={glow} strokeWidth="1" opacity=".68" />
              <path d="M80 10l6 20-6 11-6-11 6-20Zm0 140-6-20 6-11 6 11-6 20ZM10 80l20-6 11 6-11 6-20-6Zm140 0-20 6-11-6 11-6 20 6Z" fill={color} stroke={glow} strokeWidth="1.1" />
              <path d="m31 31 18 9 3 12-12-3-9-18Zm98 98-18-9-3-12 12 3 9 18ZM31 129l9-18 12-3-3 12-18 9Zm98-98-9 18-12 3 3-12 18-9Z" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
            </g>
            <path d="M30 80h100M80 30v100" fill="none" stroke={glow} strokeWidth="1.2" strokeDasharray="3 6" opacity=".72" />
            <path d="m80 53 9 18 18 9-18 9-9 18-9-18-18-9 18-9 9-18Z" fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
            <circle cx="80" cy="80" r="5" fill={glow} stroke="#ffffff" strokeWidth="1" opacity=".9" />
          </svg>
          <div className="combat-banner-class-backdrop__ranger-bows">
            {(['left', 'right'] as const).map((side) => (
              <svg
                className={`combat-banner-class-backdrop__ranger-bow combat-banner-class-backdrop__ranger-bow--${side}`}
                viewBox="0 0 96 88"
                role="presentation"
                data-combat-ranger-bow={side}
                key={side}
              >
                <path d="M25 8q48 36 0 72" fill="none" stroke={glow} strokeWidth="5" strokeLinecap="round" />
                <path d="M25 8q48 36 0 72" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
                <path d="M25 8 48 44 25 80" fill="none" stroke={glow} strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M9 44h68" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
                <path d="m77 44-12-7v14l12-7ZM14 44 5 38m9 6-9 6" fill="none" stroke={glow} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M31 14q9 4 13 12M31 74q9-4 13-12" fill="none" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" opacity=".52" />
              </svg>
            ))}
          </div>
        </>
      ) : null}
      {classId === 'rogue' ? (
        <>
          <svg
            className="combat-banner-class-backdrop__rogue-eye"
            viewBox="0 0 200 100"
            role="presentation"
            data-combat-rogue-center="watchful-eye"
          >
            <g className="combat-banner-class-backdrop__rogue-eye-lid">
              <path d="M10 51Q100-1 190 51Q100 103 10 51Z" fill={color} stroke={glow} strokeWidth="2.8" strokeLinejoin="round" opacity=".28" />
              <path d="M13 51Q100 5 187 51M13 51q87 46 174 0" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
              <path d="M25 39 15 28m31 1-6-15m120 15 6-15m9 25 10-11" fill="none" stroke={glow} strokeWidth="1.6" strokeLinecap="round" opacity=".64" />
            </g>
            <circle cx="100" cy="51" r="27" fill="none" stroke={glow} strokeWidth="2" strokeDasharray="5 5" opacity=".7" />
            <circle cx="100" cy="51" r="15" fill={color} stroke={glow} strokeWidth="1.5" opacity=".5" />
            <path className="combat-banner-class-backdrop__rogue-eye-scan" d="M25 50Q100 12 175 50" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            <g className="combat-banner-class-backdrop__rogue-eye-motes" fill={glow}>
              <circle cx="45" cy="68" r="1.8" />
              <circle cx="158" cy="28" r="2.2" />
              <circle cx="178" cy="68" r="1.5" />
            </g>
          </svg>
          <div className="combat-banner-class-backdrop__rogue-tools">
            {(['left', 'right'] as const).map((side) => (
              <svg
                className={`combat-banner-class-backdrop__rogue-tool combat-banner-class-backdrop__rogue-tool--${side}`}
                viewBox="0 0 100 82"
                role="presentation"
                data-combat-rogue-tool={side}
                key={side}
              >
                <circle cx="18" cy="65" r="9" fill="none" stroke={glow} strokeWidth="3" />
                <circle cx="18" cy="65" r="4" fill="none" stroke={color} strokeWidth="1.5" />
                <path d="M25 59 67 18q8-7 17 0l-7 7q-4-4-8 0L31 65" fill="none" stroke={glow} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".2" />
                <path d="M25 59 67 18q8-7 17 0l-7 7q-4-4-8 0L31 65" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 53 58 26m-5-3 10 7" fill="none" stroke={glow} strokeWidth="2.2" strokeLinecap="round" />
                <path className="combat-banner-class-backdrop__rogue-tool-glint" d="m30 57 38-37" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                <g className="combat-banner-class-backdrop__rogue-tool-sparks" fill={glow}>
                  <circle cx="76" cy="12" r="2.2" />
                  <circle cx="88" cy="31" r="1.6" />
                  <circle cx="48" cy="16" r="1.8" />
                </g>
              </svg>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
