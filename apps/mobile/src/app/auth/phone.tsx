import { useState } from 'react';
import { TextInput } from 'react-native';
import { router } from 'expo-router';
import { normalizeRoMobile } from '@jobzee/shared';
import { Screen } from '@/components/Screen';
import { BackButton, Button, Notice, T } from '@/components/ui';
import { api } from '@/lib/api';
import { errorText } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

export default function Phone() {
  const p = usePalette();
  const [raw, setRaw] = useState('+40 7');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const phone = normalizeRoMobile(raw);

  const send = async () => {
    if (!phone) return setErr('Numărul pare incomplet. Exemplu: 0712 345 678.');
    setBusy(true);
    setErr('');
    try {
      await api.sendCode(phone);
      router.push({ pathname: '/auth/code', params: { phone } });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title="Trimite codul" onPress={send} loading={busy} disabled={!phone} />}>
      <BackButton />
      <T v="h1">Care e numărul tău?</T>
      <T mute>Îți trimitem un cod prin SMS. Numărul nu e afișat nimănui; apelurile cu Jobzerul trec prin număr mascat.</T>
      <TextInput
        value={raw}
        onChangeText={setRaw}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        accessibilityLabel="Număr de telefon"
        style={{ fontFamily: font.semibold, fontSize: 22, color: p.ink, backgroundColor: p.surface, borderRadius: 16, borderWidth: 1.5, borderColor: p.line, padding: 16 }}
      />
      {err ? <Notice tone="bad" text={err} /> : null}
    </Screen>
  );
}
