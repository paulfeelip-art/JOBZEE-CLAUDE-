import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { amountToHold, categoryById, fees, formatLei, isValidCui, lei, type PricingMode } from '@jobzee/shared';
import { Screen } from '@/components/Screen';
import { Button, Card, Chip, FlowHead, MoneyRows, Notice, Row, T, Tag } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { api } from '@/lib/api';
import { errorText, useStore, whenLabel } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

export default function Price() {
  const p = usePalette();
  const { request: r, updateRequest, place } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const d = r.draft;
  if (!d) return null;
  const c = categoryById(d.category);
  const hold = amountToHold(r.pricing === 'fixed' ? { mode: 'fixed', amountBani: lei(r.amountLei) }
    : r.pricing === 'hourly' ? { mode: 'hourly', rateBani: lei(r.rateLei), maxHours: r.maxHours } : { mode: 'quote' });
  const f = fees(hold);
  const cuiOk = !r.needInvoice || isValidCui(r.invoiceCui);
  const addressOk = r.address.trim().length >= 6;

  const option = (mode: PricingMode, icon: IconName, title: string, sub: string, price: string, priceSub: string) => {
    const on = r.pricing === mode;
    return (
      <Pressable
        key={mode}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        onPress={() => updateRequest({ pricing: mode })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: on ? 2 : 1.5, borderColor: on ? p.or : p.line, backgroundColor: on ? p.orSoft : p.surface }}
      >
        <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} color={p.ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Row gap={6}><T v="h3">{title}</T>{d.price?.mode === mode ? <Tag tone="or" label="Recomandat" /> : null}</Row>
          <T v="xs" mute>{sub}</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="h3" style={{ fontSize: 17 }}>{price}</T>
          <T v="xs" mute>{priceSub}</T>
        </View>
      </Pressable>
    );
  };

  const publish = async () => {
    setBusy(true);
    setErr('');
    try {
      const id = await api.createTask({
        title: d.title || c.label, category: d.category, details: d.details, aiNotes: d.photoNotes, people: d.people,
        areaLabel: place.label, lat: place.lat, lng: place.lng, address: r.address.trim(), accessNotes: '',
        scheduledFor: null, pricingMode: r.pricing,
        priceBani: r.pricing === 'fixed' ? lei(r.amountLei) : r.pricing === 'quote' ? 6000 : null,
        rateBani: r.pricing === 'hourly' ? lei(r.rateLei) : null, maxHours: r.pricing === 'hourly' ? r.maxHours : null,
        minTier: r.minTier, needInvoice: r.needInvoice, invoiceCui: r.needInvoice ? r.invoiceCui : null,
      });
      await api.publishTask(id);
      updateRequest({ taskId: id });
      router.replace({ pathname: '/request/match', params: { id } });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const step = (key: 'amountLei' | 'maxHours', delta: number, min: number, max: number) =>
    updateRequest({ [key]: Math.max(min, Math.min(max, r[key] + delta)) } as never);

  return (
    <Screen footer={
      <>
        <Button title={`Găsește Jobzeri · ${r.pricing === 'quote' ? 'diagnostic' : formatLei(hold, 0)}`} onPress={publish} loading={busy} disabled={!cuiOk || !addressOk} />
        <T v="xs" mute style={{ textAlign: 'center' }}>{!addressOk ? 'Completează adresa exactă mai jos ca să continui.' : !cuiOk ? 'Verifică CUI-ul firmei.' : 'Nu plătești nimic acum. Suma se blochează doar când confirmi Jobzerul.'}</T>
      </>
    }>
      <FlowHead title="Prețul" step={3} />
      <View>
        <T v="h2" style={{ fontSize: 19 }}>{d.title || c.label}</T>
        <T v="small" mute>{whenLabel(r.when)} · {place.label}</T>
      </View>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {option('fixed', 'tag', 'Preț fix', 'Știi exact cât plătești', formatLei(lei(r.amountLei), 0), `total ${formatLei(fees(lei(r.amountLei)).total, 0)}`)}
        {option('hourly', 'clock', 'Pe oră, cu plafon', 'Plătești timpul lucrat, maxim plafonul', `${r.rateLei} lei/h`, `max ${r.maxHours} h`)}
        {option('quote', 'spark', 'Diagnostic întâi', 'Vine, vede, îți propune un preț', '60 lei', 'vizita')}
      </View>
      {r.pricing !== 'quote' ? (
        <Row style={{ backgroundColor: p.fill, borderRadius: 16, padding: 12 }}>
          <View style={{ flex: 1 }}>
            <T v="label">{r.pricing === 'fixed' ? 'Ajustează prețul' : `Ore maxim: ${r.maxHours}`}</T>
            <T v="xs" mute>{d.price ? `Jobzee AI estimează ${d.price.lowLei}–${d.price.highLei} lei. ${d.price.why}` : 'Alege suma potrivită.'}</T>
          </View>
          {(['−', '+'] as const).map((s) => (
            <Pressable key={s} accessibilityRole="button" accessibilityLabel={s === '+' ? 'Crește' : 'Scade'}
              onPress={() => r.pricing === 'fixed' ? step('amountLei', s === '+' ? 10 : -10, 20, 5000) : step('maxHours', s === '+' ? 1 : -1, 1, 8)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
              <T v="h2">{s}</T>
            </Pressable>
          ))}
        </Row>
      ) : <T v="xs" mute>Dacă nu accepți propunerea după diagnostic, plătești doar vizita.</T>}
      <Card>
        <MoneyRows rows={[
          [r.pricing === 'hourly' ? `Plafon ${r.maxHours} h × ${r.rateLei} lei` : r.pricing === 'quote' ? 'Vizită de diagnostic' : 'Lucrare', formatLei(hold)],
          ['Taxă de serviciu 4,9%', formatLei(f.service)],
          ['Total maxim', formatLei(f.total), true],
        ]} />
        <T v="xs" mute>Inclus: {c.included}. Nu e inclus: {c.excluded}. Anulare gratuită până pleacă Jobzerul, apoi 15 lei.</T>
      </Card>
      <View style={{ gap: 8 }}>
        <T v="label">Adresa exactă</T>
        <TextInput value={r.address} onChangeText={(v) => updateRequest({ address: v })} placeholder="Strada, numărul, blocul, apartamentul" placeholderTextColor={p.mute}
          accessibilityLabel="Adresa exactă" style={{ backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: 14, padding: 14, fontFamily: font.regular, fontSize: 16, color: p.ink }} />
        <T v="xs" mute>O vede doar Jobzerul confirmat. Ofertele arată doar zona aproximativă.</T>
      </View>
      <View style={{ gap: 8 }}>
        <T v="label">Nivel minim de Jobzer</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {['Oricare', 'Plus+', 'Gold+', 'Black'].map((l, i) => <Chip key={l} label={l} selected={r.minTier === i} onPress={() => updateRequest({ minTier: i })} />)}
        </Row>
      </View>
      <Row>
        <Icon name="doc" color={p.ink} />
        <View style={{ flex: 1 }}>
          <T v="h3" style={{ fontSize: 15 }}>Vreau factură pe firmă</T>
          <T v="xs" mute>Doar Jobzeri cu PFA, II sau SRL</T>
        </View>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: r.needInvoice }} accessibilityLabel="Vreau factură pe firmă"
          onPress={() => updateRequest({ needInvoice: !r.needInvoice })}
          style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: r.needInvoice ? p.ok : p.fill2, justifyContent: 'center', paddingHorizontal: 3 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignSelf: r.needInvoice ? 'flex-end' : 'flex-start' }} />
        </Pressable>
      </Row>
      {r.needInvoice ? (
        <View style={{ gap: 6 }}>
          <TextInput value={r.invoiceCui} onChangeText={(v) => updateRequest({ invoiceCui: v })} placeholder="CUI firmă, ex. RO 14399840" placeholderTextColor={p.mute}
            autoCapitalize="characters" accessibilityLabel="CUI firmă" style={{ backgroundColor: p.surface, borderWidth: 1.5, borderColor: cuiOk ? p.line : p.bad, borderRadius: 14, padding: 14, fontFamily: font.regular, fontSize: 16, color: p.ink }} />
          {!cuiOk && r.invoiceCui ? <T v="xs" color={p.bad}>CUI-ul nu pare valid (cifra de control nu se potrivește).</T> : null}
        </View>
      ) : null}
      {err ? <Notice tone="bad" text={err} /> : null}
    </Screen>
  );
}
