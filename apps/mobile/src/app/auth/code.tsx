import { useState } from 'react';
import { TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { BackButton, Button, Notice, T } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText, useStore } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

export default function Code() {
  const p = usePalette();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { setSession, isDemo } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const verify = async (value = code) => {
    if (!/^\d{6}$/.test(value)) return;
    setBusy(true);
    setErr('');
    try {
      const s = await api.verifyCode(phone, value);
      setSession(s);
      router.replace('/(tabs)');
    } catch (e) {
      setErr(errorText(e) === 'Ceva n-a mers. Încearcă din nou.' ? 'Codul nu e corect sau a expirat.' : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title="Confirmă" onPress={() => verify()} loading={busy} disabled={code.length !== 6} />}>
      <BackButton />
      <T v="h1">Introdu codul</T>
      <T mute>Trimis la {phone}.{isDemo ? ' În demo merge orice cod de 6 cifre.' : ''}</T>
      <TextInput
        value={code}
        onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) verify(d); }}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        accessibilityLabel="Cod de 6 cifre"
        style={{ fontFamily: font.bold, fontSize: 30, letterSpacing: 12, textAlign: 'center', color: p.ink, backgroundColor: p.surface, borderRadius: 16, borderWidth: 1.5, borderColor: p.line, padding: 16 }}
      />
      {err ? <Notice tone="bad" text={err} /> : null}
    </Screen>
  );
}
