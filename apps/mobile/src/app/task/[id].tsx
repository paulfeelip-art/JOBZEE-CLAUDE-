import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { fees, formatLei, STATUS_LABEL } from '@jobzee/shared';
import { Screen } from '@/components/Screen';
import { Avatar, BackButton, Button, Card, Chip, MoneyRows, Notice, Row, T, TierBadge } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { JobzeeMap } from '@/components/Map';
import { api, demoAdvance, type TaskView } from '@/lib/api';
import { errorText, useStore } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

const STEPS = ['Confirmat', 'Pe drum', 'Lucrează', 'Gata'];
const stepOf = (s: TaskView['status']) => ({ confirmed: 0, en_route: 1, in_progress: 2, awaiting_confirmation: 3, completed: 3 } as Record<string, number>)[s] ?? 0;

export default function Task() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { place, isDemo, resetRequest } = useStore();
  const [t, setT] = useState<TaskView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(false);

  useEffect(() => {
    api.getTask(id).then(setT).catch((e) => setErr(errorText(e)));
    return api.watchTask(id, setT);
  }, [id]);

  if (!t) return <Screen><ActivityIndicator color={p.or} /></Screen>;
  const j = t.jobzer;
  const first = j?.displayName.split(' ')[0] ?? 'Jobzerul';
  const f = fees(t.finalPriceBani ?? t.holdBani);
  const step = stepOf(t.status);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try { await fn(); setT(await api.getTask(id)); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };

  const head = {
    confirmed: `${first} a confirmat`, en_route: `${first} e pe drum`, in_progress: `${first} lucrează acum`,
    awaiting_confirmation: `${first} a terminat`, completed: 'Gata, mulțumim!', cancelled: 'Sarcină anulată', disputed: 'În analiză la echipa Jobzee',
  }[t.status as string] ?? STATUS_LABEL[t.status];

  if (t.status === 'completed') {
    return (
      <Screen footer={rated ? <Button title="Înapoi acasă" onPress={() => { resetRequest(); router.replace('/(tabs)'); }} /> : (
        <Button title="Trimite recenzia" disabled={!stars} loading={busy} onPress={() => run(async () => { await api.submitReview(t.id, stars, tags, comment); setRated(true); })} />
      )}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Avatar photo={j?.photo} initials={first.slice(0, 2)} size={96} />
          <T v="h2">{rated ? 'Mulțumim pentru recenzie!' : `Cum a fost cu ${first}?`}</T>
          <T v="small" mute style={{ textAlign: 'center' }}>Ai plătit {formatLei(f.total)}. Documentele sunt în Cont → Facturi și chitanțe. Recenzia apare după ce evaluează și {first}.</T>
        </View>
        {!rated ? (
          <>
            <Row gap={6} style={{ justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} stele`} onPress={() => setStars(n)} style={{ padding: 4 }}>
                  <Icon name="star" size={40} color={n <= stars ? p.or : p.fill2} />
                </Pressable>
              ))}
            </Row>
            <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              {['Punctual', 'Curat', 'Comunicativ', 'Rapid', 'Atent'].map((x) => (
                <Chip key={x} label={x} selected={tags.includes(x)} onPress={() => setTags(tags.includes(x) ? tags.filter((y) => y !== x) : [...tags, x])} />
              ))}
            </Row>
            <TextInput value={comment} onChangeText={setComment} multiline placeholder="Spune-le și altora cum a fost (opțional)" placeholderTextColor={p.mute}
              style={{ minHeight: 90, textAlignVertical: 'top', backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: 14, padding: 14, fontFamily: font.regular, fontSize: 16, color: p.ink }} />
          </>
        ) : null}
        {err ? <Notice tone="bad" text={err} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Row><BackButton onPress={() => router.replace('/(tabs)')} /><T v="h3" style={{ flex: 1 }}>{t.title}</T></Row>
      {['confirmed', 'en_route'].includes(t.status) ? <JobzeeMap center={place} height={200} points={[{ lat: place.lat, lng: place.lng, kind: 'me' }, { lat: place.lat + 0.006, lng: place.lng - 0.008, kind: 'jobzer' }]} /> : null}
      <T v="h2">{head}</T>
      <View style={{ gap: 6 }}>
        <Row gap={6}>{STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 5, borderRadius: 5, backgroundColor: i <= step ? p.or : p.fill2 }} />)}</Row>
        <Row style={{ justifyContent: 'space-between' }}>{STEPS.map((s, i) => <T key={s} v="xs" style={{ fontFamily: font.semibold }} color={i <= step ? p.ink : p.mute}>{s}</T>)}</Row>
      </View>
      {j ? (
        <Card onPress={() => router.push({ pathname: '/jobzer/[id]', params: { id: j.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
          <Avatar photo={j.photo} initials={first.slice(0, 2)} />
          <View style={{ flex: 1 }}>
            <T v="h3">{j.displayName}</T>
            <T v="xs" mute>★ {j.rating.toFixed(1).replace('.', ',')} · {j.issuesInvoice ? 'emite factură' : 'chitanță Jobzee'}</T>
          </View>
          <TierBadge tier={j.tier} />
        </Card>
      ) : null}
      {t.startCode && ['confirmed', 'en_route'].includes(t.status) ? (
        <Row style={{ backgroundColor: p.orSoft, borderRadius: 16, padding: 14 }}>
          <View style={{ flex: 1 }}>
            <T v="h3" style={{ fontSize: 15 }}>Cod de start</T>
            <T v="xs" mute>Spune-l doar când {first} e la ușă.</T>
          </View>
          <T style={{ fontFamily: font.extrabold, fontSize: 28, letterSpacing: 6 }}>{t.startCode}</T>
        </Row>
      ) : null}
      <Row gap={8}>
        <Button title="Mesaj" icon="chat" variant="line" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: t.id } })} />
        <Button title="Problemă" icon="flag" variant="danger" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => run(async () => { await api.reportProblem(t.id, 'Raportat din ecranul sarcinii'); setErr('Am primit sesizarea. Echipa Jobzee te contactează în aplicație; plata rămâne blocată până rezolvăm. Pentru urgențe sună la 112.'); })} />
      </Row>
      {t.status === 'awaiting_confirmation' ? (
        <>
          <Card>
            <MoneyRows rows={[['Lucrare', formatLei(f.price)], ['Taxă de serviciu', formatLei(f.service)], ['Total', formatLei(f.total), true]]} />
          </Card>
          <Button title={`Confirm finalizarea · ${formatLei(f.total)}`} loading={busy} onPress={() => run(() => api.completeTask(t.id))} />
          <T v="xs" mute style={{ textAlign: 'center' }}>Fără răspuns în 48 de ore, se confirmă automat. Dacă ceva nu e în regulă, apasă „Problemă”.</T>
        </>
      ) : (
        <Card>
          <MoneyRows rows={[['Lucrare', formatLei(t.holdBani)], ['Taxă de serviciu', formatLei(t.serviceBani)], ['Blocat pe card', formatLei(fees(t.holdBani).total), true]]} />
          <T v="xs" mute>Se încasează doar după ce confirmi finalizarea.</T>
        </Card>
      )}
      {['confirmed', 'en_route'].includes(t.status) ? (
        <Button title={t.status === 'confirmed' ? 'Anulează gratuit' : 'Anulează (15 lei, Jobzerul e pe drum)'} variant="danger" loading={busy}
          onPress={() => run(async () => { await api.cancelTask(t.id, 'client'); router.replace('/(tabs)'); })} />
      ) : null}
      {isDemo && ['en_route', 'in_progress'].includes(t.status) ? (
        <Button title="Demo: următorul pas al Jobzerului" variant="ghost" onPress={() => run(() => demoAdvance(api, t))} />
      ) : null}
      {err ? <Notice tone="bad" text={err} /> : null}
    </Screen>
  );
}
