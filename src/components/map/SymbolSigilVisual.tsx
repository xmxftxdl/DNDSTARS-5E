import { Circle, Group, Line } from 'react-konva'

/** Vector seal keeps its engraving crisp at every map zoom. */
export function SymbolSigilVisual({ size, activated }: { size: number; activated: boolean }) {
  const ink = activated ? '#fef3c7' : '#ddd6fe'
  return <Group scaleX={size / 100} scaleY={size / 100} listening={false}>
    <Circle radius={32} fillRadialGradientStartRadius={0} fillRadialGradientEndRadius={32}
      fillRadialGradientColorStops={[0, '#5b21b6', 0.65, '#251044', 1, '#100b22']}
      stroke="#a78bfa" strokeWidth={1.6} shadowColor="#a78bfa"
      shadowBlur={activated ? 18 : 5} shadowOpacity={activated ? 0.8 : 0.45} />
    <Circle radius={28} stroke="#c4b5fd" strokeWidth={0.7} opacity={0.6} />
    <Circle radius={21} stroke={ink} strokeWidth={1} opacity={0.75} />
    {[0, 60, 120, 180, 240, 300].map(rotation => <Group key={rotation} rotation={rotation}>
      <Line points={[-2, -25, 0, -27, 2, -25, 0, -23, -2, -25]}
        stroke={ink} strokeWidth={0.9} closed />
      <Line points={[0, -32, 0, -29]} stroke="#fcd34d" strokeWidth={1.4} />
    </Group>)}
    <Line points={[0, -19, 16.45, 9.5, -16.45, 9.5]} closed
      stroke={ink} strokeWidth={1.3} lineJoin="round" />
    <Line points={[0, 19, -16.45, -9.5, 16.45, -9.5]} closed
      stroke="#a78bfa" strokeWidth={1.3} lineJoin="round" />
    <Line points={[0, -12, 7, 0, 0, 12, -7, 0]} closed
      fill="#1e103b" stroke="#fde68a" strokeWidth={1.8} />
    <Circle radius={2.5} fill="#fff7d6" shadowColor="#fcd34d" shadowBlur={8} />
  </Group>
}
