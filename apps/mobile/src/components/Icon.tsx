import Svg, { Circle, Path, Rect } from 'react-native-svg';

const STROKE: Record<string, React.ReactNode> = {
  home: <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  activity: <><Rect x={4} y={4} width={16} height={17} rx={3} /><Path d="M8 9h8M8 13h8M8 17h5" /></>,
  chat: <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  user: <><Circle cx={12} cy={8} r={4} /><Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  mic: <><Rect x={9} y={3} width={6} height={12} rx={3} /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  camera: <><Path d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle cx={12} cy={13} r={3.5} /></>,
  pin: <><Path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><Circle cx={12} cy={9.5} r={2.5} /></>,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <Path d="M6 6l12 12M18 6 6 18" />,
  back: <Path d="M15 6l-6 6 6 6" />,
  chev: <Path d="M9 6l6 6-6 6" />,
  down: <Path d="M6 9l6 6 6-6" />,
  arrow: <Path d="M5 12h14M13 6l6 6-6 6" />,
  up: <Path d="M12 19V5M6 11l6-6 6 6" />,
  clock: <><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></>,
  calendar: <><Rect x={4} y={5} width={16} height={16} rx={3} /><Path d="M4 10h16M9 3v4M15 3v4" /></>,
  tag: <><Path d="M3 12V4h8l10 10-8 8z" /><Circle cx={7.5} cy={8.5} r={1.5} /></>,
  shield: <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  flag: <Path d="M5 21V4h11l-2 4 2 4H5" />,
  phone: <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  doc: <><Path d="M6 3h9l4 4v14H6z" /><Path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  wallet: <><Rect x={3} y={6} width={18} height={14} rx={3} /><Path d="M16 13h2M3 10h18" /></>,
  tool: <Path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  bell: <><Path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><Path d="M10 21h4" /></>,
  nav: <Path d="M3 11 21 3l-8 18-2-8z" />,
  card: <><Rect x={3} y={5} width={18} height={14} rx={2.5} /><Path d="M3 10h18M7 15h4" /></>,
  lock: <><Rect x={5} y={11} width={14} height={10} rx={2} /><Path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
};

export type IconName = keyof typeof STROKE | 'star' | 'spark';

export function Icon({ name, size = 22, color, strokeWidth = 1.9 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  if (name === 'star' || name === 'spark') {
    const d = name === 'star'
      ? 'M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z'
      : 'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z';
    return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={d} fill={color} /></Svg>;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {STROKE[name]}
    </Svg>
  );
}

const LOGO_PATH = 'M32 2C16 2 4 14 4 30c0 20 28 48 28 48s28-28 28-48C60 14 48 2 32 2zm10.8 17.4-7.5 7.5 3.8 3.8 7.5-7.5c1.6 5.2-.3 11-5 13.9-3.8 2.4-8.4 2.5-12.2.7L18.8 48.4a4.2 4.2 0 0 1-6-5.9l10.6-10.6c-1.9-3.8-1.7-8.4.7-12.2 2.9-4.7 8.7-6.6 13.9-5z';

export function LogoPin({ height = 32 }: { height?: number }) {
  return (
    <Svg width={height * 0.8} height={height} viewBox="0 0 64 80">
      <Path d={LOGO_PATH} fill="#FF9F0A" />
    </Svg>
  );
}
