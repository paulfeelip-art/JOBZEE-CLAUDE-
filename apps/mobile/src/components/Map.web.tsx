import Svg, { Circle, Rect } from 'react-native-svg';
import { View } from 'react-native';
import { usePalette } from '@/lib/theme';
import type { MapPoint } from './Map';

export type { MapPoint };

/** Web preview: a stylised map. Real maps run on iOS and Android. */
export function JobzeeMap({ points = [], height = 260 }: { center: { lat: number; lng: number }; points?: MapPoint[]; height?: number }) {
  const p = usePalette();
  const blocks: React.ReactNode[] = [];
  for (let x = 0; x < 420; x += 70) for (let y = 0; y < height; y += 62) blocks.push(<Rect key={`${x}-${y}`} x={x + 5} y={y + 5} width={60} height={52} rx={6} fill="#E7E0D6" />);
  return (
    <View style={{ height, borderRadius: 20, overflow: 'hidden', backgroundColor: '#F4F0EA' }} accessibilityLabel="Hartă cu zona ta">
      <Svg width="100%" height={height} viewBox={`0 0 420 ${height}`} preserveAspectRatio="xMidYMid slice">
        {blocks}
        <Rect x={145} y={67} width={130} height={114} rx={8} fill="#DCEFD9" />
        <Circle cx={210} cy={height / 2} r={26} fill={p.or} opacity={0.25} />
        <Circle cx={210} cy={height / 2} r={9} fill="#151515" stroke="#fff" strokeWidth={4} />
        {points.filter((x) => x.kind === 'jobzer').map((_, i) => (
          <Circle key={i} cx={120 + i * 110} cy={height / 2 - 50 + (i % 2) * 90} r={8} fill={p.or} stroke="#fff" strokeWidth={3} />
        ))}
      </Svg>
    </View>
  );
}
