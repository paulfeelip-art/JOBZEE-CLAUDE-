import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { categoryById, fees, formatLei } from '@jobzee/shared';
import { Screen } from '@/components/Screen';
import { BackButton, Button, Card, MoneyRows, Notice, Row, T, Tag } from '@/components/ui';
import { api, type Offer } from '@/lib/api';
import { errorText } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

export default function OfferScreen() {
  const p = usePalette();
  const { data } = useLocalSearchParams<{ data: string }>();
  const o = JSON.parse(data) as Offer;
  const [left, setLeft] = useState(Math.max(0, Math.round((new Date(o.expiresAt).getTime() - Date.now()) / 1000)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const f = fees(o.clientPaysBani);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const respond = async (accept: boolean) => {
    setBusy(true);
    try {
      const ok = await api.respondOffer(o.id, accept);
      if (accept && !ok) setMsg('Altcineva a acceptat mai repede. Nu contează la nimic, primești următoarea ofertă.');
      else router.back();
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={
      <>
        <Button title="Acceptă" onPress={() => respond(true)} loading={busy} disabled={left === 0} />
        <Button title="Refuz · fără nicio penalizare" variant="ghost" onPress={() => respond(false)} disabled={busy} />
      </>
    }>
      <BackButton />
      <T v="label" mute style={{ textAlign: 'center' }}>Sarcină nouă pentru tine</T>
      <View style={{ alignSelf: 'center', width: 190, height: 190, borderRadius: 95, borderWidth: 8, borderColor: left > 10 ? p.ink : p.or, alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel={`Primești ${formatLei(o.netBani, 0)}. Mai ai ${left} secunde.`}>
        <T style={{ fontFamily: font.extrabold, fontSize: 52, lineHeight: 56 }}>{Math.round(o.netBani / 100)}</T>
        <T v="small" mute>lei pentru tine</T>
        <T v="xs" mute>{left}s</T>
      </View>
      <T v="h2" style={{ textAlign: 'center' }}>{o.title}</T>
      <Row gap={6} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <Tag label={`${o.areaLabel}, ${(o.distanceM / 1000).toFixed(1).replace('.', ',')} km`} />
        <Tag label={o.scheduledFor ? new Date(o.scheduledFor).toLocaleString('ro-RO') : 'Acum'} />
        <Tag label={categoryById(o.category).label} />
      </Row>
      <Card style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h3">{o.clientFirstName}</T>
          <Tag tone="ok" icon="check" label="Plata se blochează la confirmare" />
        </Row>
        {o.details.map((d) => <T key={d} v="small">• {d}</T>)}
        <T v="xs" mute>Adresa exactă apare după ce clientul confirmă.</T>
      </Card>
      <Card>
        <MoneyRows rows={[['Clientul plătește', formatLei(f.price)], ['Comision Jobzee 12%', `−${formatLei(f.commission)}`], ['Primești', formatLei(f.net), true]]} />
      </Card>
      {msg ? <Notice text={msg} /> : null}
    </Screen>
  );
}
