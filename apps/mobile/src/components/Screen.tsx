import { KeyboardAvoidingView, Platform, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/lib/theme';

/** Standard screen: safe area, cream background, scrollable content with a bottom action area. */
export function Screen({ children, footer, scroll = true, style, surface }: {
  children: React.ReactNode; footer?: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; surface?: boolean;
}) {
  const p = usePalette();
  const body = <View style={[{ padding: 20, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' }, style]}>{children}</View>;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: surface ? p.surface : p.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>{body}</ScrollView> : <View style={{ flex: 1 }}>{body}</View>}
        {footer ? <View style={{ padding: 20, paddingTop: 8, gap: 8, maxWidth: 680, width: '100%', alignSelf: 'center' }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
