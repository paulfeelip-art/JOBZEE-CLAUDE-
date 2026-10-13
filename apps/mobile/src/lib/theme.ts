import { useColorScheme } from 'react-native';

/** Design tokens from the Jobzee design canvas (warm cream, brand orange). */
const light = {
  bg: '#FBF7F2',
  surface: '#FFFFFF',
  fill: '#F5F0E9',
  fill2: '#E8E1D7',
  line: '#ECE6DE',
  ink: '#151515',
  mute: '#686868',
  gray: '#8A8A8A',
  or: '#FF9F0A',
  orInk: '#1A1206',
  orText: '#A85300',
  orSoft: '#FFF2E0',
  orWord: '#F08200',
  ok: '#12804A',
  okSoft: '#E7F5EC',
  bad: '#C0262D',
  badSoft: '#FDECEC',
};
export type Palette = typeof light;

const dark: Palette = {
  bg: '#100E0C',
  surface: '#1B1815',
  fill: '#26221E',
  fill2: '#36312B',
  line: '#2F2A25',
  ink: '#F6F2EC',
  mute: '#ABA49B',
  gray: '#B5AEA5',
  or: '#FFA826',
  orInk: '#1A1206',
  orText: '#FFB54D',
  orSoft: '#35260F',
  orWord: '#FFA826',
  ok: '#3DDC84',
  okSoft: '#10291B',
  bad: '#FF6B6B',
  badSoft: '#331414',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const radius = { sm: 12, md: 16, lg: 20, pill: 999 };
export const space = (n: number) => n * 4;

export const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  start: { bg: '#F1EEE9', fg: '#151515' },
  plus: { bg: '#2E4A7A', fg: '#FFFFFF' },
  gold: { bg: '#7A5600', fg: '#FFFFFF' },
  black: { bg: '#0B0B0B', fg: '#FF9F0A' },
};
