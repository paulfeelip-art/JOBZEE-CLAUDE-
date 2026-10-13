import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { categoryById, fees, formatLei } from '@jobzee/shared';
import { Screen } from '@/components/Screen';
import { Button, Card, FlowHead, MoneyRows, Notice, Row, T, Tag, TierBadge } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { JobzeeMap } from '@/components/Map';
import { api, type TaskView } from '@/lib/api';
import { authoriseWithSheet } from '@/lib/payments';
import { errorText, useStore } from '@/lib/store';
import { usePalette } from '@/lib/theme';

const LEGAL: Record<string, string> = { persoana_fizica: 'Persoană fizică', pfa: 'PFA', ii: 'II', srl: 'SRL' };

export default function Match() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { place } = useStore();
  const [t, setT] = useState<TaskView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.getTask(id).then(setT).catch((e) => setErr(errorText(e)));
    return api.watchTask(id, (nt) => {
      setT(nt);
      if (['confirmed', 'en_route'].includes(nt.status)) router.replace({ pathname: '/task/[id]', params: { id } });
    });
  }, [id]);

  if (!t) return <Screen><ActivityIndicator color={p.or} /></Screen>;
  const j = t.jobzer;
  const skill = j?.skills.find((s) => s.category === t.category);

  const confirm = async () => {
    setBusy(true);
    setErr('');
    try {
      const { clientSecret } = await api.authorisePayment(t.id);
      if (clientSecret) {
        const r = await authoriseWithSheet(clientSecret);
        if (r === 'cancelled') return;
        if (typeof r === 'object') throw new Error(r.error);
      }
      // The task switches to "confirmed" when the payment authorisation arrives (realtime update).
    } catch (e) {
      setErr(e instanceof Error && !e.message.includes('_') ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (t.status === 'searching' || !j) {
    return (
      <Screen footer={<Button title="Anulează, fără cost" variant="line" onPress={async () => { await api.cancelTask(t.id, 'client cancelled search'); router.replace('/(tabs)'); }} />}>
        <FlowHead title="Rezultatele tale" step={4} />
        <JobzeeMap center={place} points={[{ lat: place.lat, lng: place.lng, kind: 'me' }, { lat: place.lat + 0.004, lng: place.lng - 0.006, kind: 'jobzer' }, { lat: place.lat - 0.003, lng: place.lng + 0.005, kind: 'jobzer' }]} />
        <Row gap={10}><ActivityIndicator color={p.or} /><T v="h2" style={{ fontSize: 20 }}>Caut un Jobzer potrivit</T></Row>
        <T mute>Întrebăm câte 3 Jobzeri, după competență, nivel și distanță. Fiecare are 45 de secunde să răspundă.</T>
      </Screen>
    );
  }

  return (
    <Screen footer={
      <>
        <Row gap={10}>
          <Button title="Vezi profilul" variant="line" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/jobzer/[id]', params: { id: j.id, task: t.id } })} />
          <Button title="Confirmă Jobzerul" style={{ flex: 1.4 }} loading={busy} onPress={confirm} />
        </Row>
        <Button title="Altă variantă" variant="ghost" onPress={() => api.rejectMatch(t.id).catch((e) => setErr(errorText(e)))} />
      </>
    }>
      <FlowHead title="Rezultatele tale" step={4} />
      <View style={{ alignItems: 'center' }}>
        <T v="h2">Ajutor potrivit pentru tine</T>
        <T v="small" mute>{j.displayName.split(' ')[0]} e liber acum{t.etaMin ? ` și ajunge în ~${t.etaMin} min` : ''}.</T>
      </View>
      <Card style={{ padding: 10, gap: 10 }}>
        <View style={{ height: 170, borderRadius: 16, overflow: 'hidden', backgroundColor: p.fill }}>
          {j.photo ? <Image source={typeof j.photo === 'string' ? { uri: j.photo } : j.photo} style={{ flex: 1 }} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors /> : null}
          <View style={{ position: 'absolute', left: 10, top: 10 }}><TierBadge tier={j.tier} /></View>
          <View style={{ position: 'absolute', right: 10, top: 10 }}><Tag tone="ok" label="Online" /></View>
        </View>
        <View style={{ paddingHorizontal: 6, gap: 2 }}>
          <T v="h2" style={{ fontSize: 19 }}>{j.displayName} <T v="small" mute>· {LEGAL[j.legalForm]}</T></T>
          <Row gap={6}><Icon name="star" size={15} color={p.or} /><T v="h3" style={{ fontSize: 15 }}>{j.rating.toFixed(1).replace('.', ',')}</T><T v="small" mute>({j.reviewCount} recenzii)</T></Row>
          <Row gap={6}><Icon name="doc" size={15} color={j.issuesInvoice ? p.ok : p.mute} /><T v="small" color={j.issuesInvoice ? p.ok : p.mute}>{j.issuesInvoice ? 'Factură disponibilă' : 'Chitanță Jobzee'}</T></Row>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: p.line, paddingTop: 10, paddingHorizontal: 6, gap: 8 }}>
          <Row gap={10}><Icon name="tool" size={20} color={p.ink} /><T v="small">{categoryById(t.category).label}{skill ? ` · ${skill.level === 'calificat' ? 'Calificat' : skill.level === 'experimentat' ? 'Experimentat' : 'Începător'} · ${skill.years} ani` : ''}</T></Row>
          <Row gap={10}><Icon name="check" size={20} color={p.ink} /><T v="small">{j.done} sarcini · {j.onTimePct}% la timp</T></Row>
          <Row gap={10}><Icon name="shield" size={20} color={p.ink} /><T v="small">{[j.idVerified && 'Identitate verificată', j.insured && 'asigurare activă'].filter(Boolean).join(' · ') || 'Telefon verificat'}</T></Row>
        </View>
        <Row style={{ borderTopWidth: 1, borderTopColor: p.line, paddingTop: 10, paddingHorizontal: 6 }}>
          <T v="big">{formatLei(t.holdBani, 0)}</T>
          <T v="xs" mute style={{ flex: 1 }}>{t.pricingMode === 'hourly' ? 'Maxim, plătești timpul lucrat' : 'Preț final, include manopera și deplasarea'}</T>
        </Row>
      </Card>
      <Card>
        <MoneyRows rows={[['Lucrare', formatLei(t.holdBani)], ['Taxă de serviciu', formatLei(t.serviceBani)], ['Se blochează pe card', formatLei(fees(t.holdBani).total), true]]} />
        <T v="xs" mute>Suma e doar blocată. Se încasează după ce confirmi că lucrarea e gata.</T>
      </Card>
      {err ? <Notice tone="bad" text={err} /> : null}
    </Screen>
  );
}
