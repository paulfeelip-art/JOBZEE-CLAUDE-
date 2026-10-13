import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Avatar, Button, Card, Notice, Row, T, Tag } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { api } from '@/lib/api';
import { errorText, useStore } from '@/lib/store';
import { usePalette } from '@/lib/theme';

export default function Account() {
  const p = usePalette();
  const { session, setSession, isDemo, place } = useStore();
  const [err, setErr] = useState('');

  const payouts = async () => {
    setErr('');
    try {
      await api.becomeJobzer();
      await Linking.openURL(await api.payoutOnboardingUrl());
    } catch (e) {
      setErr(errorText(e));
    }
  };

  const rows: Array<[IconName, string, string, () => void]> = [
    ['wallet', 'Încasări ca Jobzer', 'Identitate, IBAN și date fiscale, prin Stripe', payouts],
    ['doc', 'Facturi și chitanțe', 'Apar după prima sarcină plătită', () => router.push('/(tabs)/activity')],
    ['shield', 'Siguranță', 'Contacte de încredere, număr mascat, raportări', () => Linking.openURL('https://jobzee.ro/siguranta')],
    ['lock', 'Datele mele', 'Export sau ștergere (GDPR)', () => Linking.openURL('mailto:privacy@jobzee.ro')],
  ];

  return (
    <Screen>
      <Row>
        <Avatar initials={(session?.displayName || 'Eu').slice(0, 2)} size={64} />
        <View style={{ flex: 1 }}>
          <T v="h2">{session?.displayName || 'Contul tău'}</T>
          <T v="small" mute>{session?.phone} · {place.label}</T>
        </View>
      </Row>
      {isDemo ? <Tag tone="or" label="Mod demonstrativ: date și plăți simulate" /> : null}
      <Card style={{ padding: 0 }}>
        {rows.map(([ic, a, b, on], i) => (
          <Row key={a} style={{ padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: p.line }}>
            <Icon name={ic} color={p.ink} />
            <View style={{ flex: 1 }}>
              <T v="h3" style={{ fontSize: 15 }} onPress={on}>{a}</T>
              <T v="xs" mute>{b}</T>
            </View>
            <Icon name="chev" size={18} color={p.mute} />
          </Row>
        ))}
      </Card>
      {err ? <Notice tone="bad" text={err} /> : null}
      <Button title="Ieși din cont" variant="line" onPress={async () => { await api.signOut(); setSession(null); router.replace('/'); }} />
      <T v="xs" mute>Jobzee · pilot. Doar adulți, fără urgențe: pentru urgențe sună la 112.</T>
    </Screen>
  );
}
