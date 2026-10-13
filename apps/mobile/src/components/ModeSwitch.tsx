import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { useStore } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

export function ModeSwitch() {
  const p = usePalette();
  const { mode, setMode } = useStore();
  const item = (m: 'help' | 'earn', label: string) => {
    const on = mode === m;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => setMode(m)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: on ? p.or : 'transparent' }}
      >
        <Icon name={m === 'help' ? 'user' : 'wallet'} size={16} color={on ? p.orInk : p.ink} strokeWidth={on ? 2.2 : 1.9} />
        <Text style={{ fontFamily: on ? font.bold : font.semibold, fontSize: 14.5, color: on ? p.orInk : p.ink }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ alignSelf: 'center', flexDirection: 'row', backgroundColor: p.fill, borderRadius: 999, padding: 4 }} accessibilityRole="tablist">
      {item('help', 'Ajutor')}
      {item('earn', 'Câștig')}
    </View>
  );
}
