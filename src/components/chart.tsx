import { useMemo } from 'react';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export interface ChartPoint {
  t: number; // ms epoch, ascending
  v: number; // balance in minor units
}

/**
 * Minimal balance-over-time line chart. Points are pre-sorted by time;
 * y-axis is inverted so a falling line = debt going down.
 */
export function BalanceChart({
  points,
  width = 320,
  height = 120,
}: {
  points: ChartPoint[];
  width?: number;
  height?: number;
}) {
  const colors = useTheme();

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const vMax = Math.max(...points.map((p) => p.v));
    const vMin = Math.min(0, ...points.map((p) => p.v));
    const spanT = t1 - t0 || 1;
    const spanV = vMax - vMin || 1;
    const pad = 6;
    const xy = points.map((p) => {
      const x = pad + ((p.t - t0) / spanT) * (width - pad * 2);
      const y = pad + (1 - (p.v - vMin) / spanV) * (height - pad * 2);
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as const;
    });
    const line = xy.map(([x, y]) => `${x},${y}`).join(' ');
    const area = `0,${height} ${line} ${width},${height}`;
    return { line, area, last: xy[xy.length - 1] };
  }, [points, width, height]);

  if (!geo) return null;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polygon points={geo.area} fill={colors.accentSoft} />
        <Polyline
          points={geo.line}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 12 },
});
