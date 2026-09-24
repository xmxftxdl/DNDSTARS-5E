import { Circle, Ellipse, Group, Line, Path } from 'react-konva'

/** A compact world-space marker: dark portal, braided hemp and a loose tail. */
export function RopeTrickVisual({ x, y, size }: { x: number; y: number; size: number }) {
  const rope = 'M 49 25 C 47 39 53 47 49 59 C 46 70 45 77 53 82 C 61 87 72 80 69 75 C 66 70 57 74 60 79 C 63 84 73 85 80 81'
  return <Group x={x} y={y} scaleX={size / 100} scaleY={size / 100} listening={false}>
    <Ellipse x={58} y={88} radiusX={28} radiusY={6} fill="#080a18" opacity={0.28} />
    <Ellipse x={49} y={25} radiusX={29} radiusY={21} fill="#9273ff" opacity={0.13} />
    <Ellipse x={49} y={25} radiusX={23} radiusY={16} fillLinearGradientStartPoint={{ x: -20, y: -15 }} fillLinearGradientEndPoint={{ x: 20, y: 16 }} fillLinearGradientColorStops={[0, '#e6daff', 0.28, '#9478df', 0.65, '#49367c', 1, '#c2a5ff']} shadowColor="#9c72ff" shadowBlur={9} shadowOpacity={0.65} />
    <Ellipse x={49} y={25} radiusX={19} radiusY={12} fillRadialGradientStartPoint={{ x: 0, y: 4 }} fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientStartRadius={0} fillRadialGradientEndRadius={21} fillRadialGradientColorStops={[0, '#151b3d', 0.65, '#100c24', 1, '#05050e']} />
    <Path data="M 30 20 C 35 9 60 8 69 20" stroke="#f1e5ff" strokeWidth={1.5} opacity={0.85} lineCap="round" />
    <Circle x={40} y={23} radius={1} fill="#b1ceff" opacity={0.8} />
    <Circle x={57} y={19} radius={0.8} fill="#ded0ff" />
    <Path data={rope} x={1.5} y={2} stroke="#100e19" strokeWidth={9} opacity={0.65} lineCap="round" />
    <Path data={rope} stroke="#49331f" strokeWidth={8} lineCap="round" />
    <Path data={rope} stroke="#b48a50" strokeWidth={5.5} lineCap="round" />
    <Path data={rope} x={-0.8} stroke="#f1d49a" strokeWidth={1.8} lineCap="round" />
    {Array.from({ length: 10 }, (_, index) => {
      const sy = 35 + index * 4
      const sx = 49 + Math.sin((sy - 35) / 12) * 1.8 - (sy > 60 ? 2 : 0)
      return <Line key={index} points={[sx - 2.6, sy + 1.5, sx + 2.5, sy - 1.5]} stroke="#594022" strokeWidth={1.4} opacity={0.8} lineCap="round" />
    })}
    <Path data="M 45 57 Q 52 53 53 59 Q 52 63 46 61" stroke="#51351e" strokeWidth={5} lineCap="round" />
    <Path data="M 45 56 Q 52 53 52 59 Q 51 61 47 60" stroke="#dfba79" strokeWidth={2.5} lineCap="round" />
    <Path data="M 78 81 l 6 -3 M 78 82 l 7 1 M 78 83 l 5 4" stroke="#cda56a" strokeWidth={1.3} lineCap="round" />
    <Path data="M 69 14 L 71 9 L 73 14 L 78 16 L 73 18 L 71 23 L 69 18 L 64 16 Z" fill="#e7dcff" opacity={0.9} />
  </Group>
}
