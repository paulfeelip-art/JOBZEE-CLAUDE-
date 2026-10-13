import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/Screen';
import { ModeSwitch } from '@/components/ModeSwitch';
import { Button, Card, Chip, Logo, Notice, Row, T, Tag, TierBadge } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { api, type JobzerPublic, type Offer } from '@/lib/api';
import { errorText, useStore } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';
import { formatLei, nextTierProgress } from '@jobzee/shared';

const IDEAS = ['Am de montat un birou IKEA', 'Ajutor cu șase cutii', 'Curățenie două ore', 'Configurare imprimantă'];

export default function Home() {
  const { mode } = useStore();
  return mode === 'help' ? <HelpHome /> : <EarnHome />;
}

function HelpHome() {
  const p = usePalette();
  const { place, locate, updateRequest, resetRequest } = useStore();
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);
  const [voiceHint, setVoiceHint] = useState(false);
  const [photos, setPhotos] = useState<Array<{ uri: string; base64: string; mediaType: 'image/jpeg' }>>([]);

  useEffect(() => { locate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 4, quality: 0.6, base64: true });
    if (!r.canceled) setPhotos(r.assets.filter((a) => a.base64).map((a) => ({ uri: a.uri, base64: a.base64!, mediaType: 'image/jpeg' as const })));
  };

  const start = (value = text) => {
    if (value.trim().length < 4 && !photos.length) return;
    resetRequest();
    updateRequest({ conversation: [{ who: 'me', text: value.trim() || 'Am atașat fotografii.' }] });
    router.push({ pathname: '/request/intake', params: { photos: photos.length ? JSON.stringify(photos.map(({ base64, mediaType }) => ({ base64, mediaType }))) : '' } });
  };

  return (
    <Screen>
      <ModeSwitch />
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Logo size={26} stacked />
        <Pressable accessibilityRole="button" accessibilityLabel={`Zona: ${place.label}. Schimbă`} onPress={locate} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 }}>
          <Icon name="pin" size={18} color={p.ink} />
          <T v="h3" style={{ fontSize: 15 }}>{place.label}</T>
          <Icon name="down" size={15} color={p.ink} />
        </Pressable>
      </View>
      <T v="h1" style={{ textAlign: 'center' }}>Cu ce ai nevoie{'\n'}de ajutor?</T>
      <TextInput
        ref={input}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Scrie, spune sau arată-mi."
        placeholderTextColor={p.mute}
        accessibilityLabel="Descrie ce ai nevoie"
        style={{ minHeight: 96, textAlignVertical: 'top', backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: 18, padding: 16, fontFamily: font.medium, fontSize: 17, color: p.ink }}
      />
      <Row gap={10}>
        <Pressable accessibilityRole="button" onPress={pick} style={{ flex: 1, minHeight: 84, borderRadius: 18, borderWidth: 1.5, borderColor: p.line, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="camera" size={26} color={p.ink} />
          <T v="label" color={p.ink}>{photos.length ? `${photos.length} ${photos.length === 1 ? 'poză' : 'poze'}` : 'Adaugă o poză'}</T>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityHint="Deschide tastatura; apasă microfonul de pe ea ca să dictezi" onPress={() => { input.current?.focus(); setVoiceHint(true); }} style={{ flex: 1, minHeight: 84, borderRadius: 18, borderWidth: 1.5, borderColor: p.line, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="mic" size={26} color={p.ink} />
          <T v="label" color={p.ink}>Vorbește</T>
        </Pressable>
      </Row>
      {voiceHint ? <T v="xs" mute style={{ textAlign: 'center' }}>Apasă microfonul de pe tastatură și spune ce ai nevoie.</T> : null}
      <Button title="Continuă" icon="chev" onPress={() => start()} disabled={text.trim().length < 4 && !photos.length} />
      <Row gap={6} style={{ justifyContent: 'center' }}>
        <Icon name="spark" size={14} color={p.or} />
        <T v="xs" mute>Jobzee AI te ajută să explici cererea.</T>
      </Row>
      <T v="label" mute>Idei rapide</T>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {IDEAS.map((i) => <Chip key={i} label={i} onPress={() => start(i)} />)}
      </Row>
    </Screen>
  );
}

function EarnHome() {
  const p = usePalette();
  const { place, locate, session } = useStore();
  const [on, setOn] = useState(false);
  const [me, setMe] = useState<JobzerPublic | null>(null);

  useEffect(() => { if (session) api.jobzer(session.userId).then(setMe).catch(() => setMe(null)); }, [session]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => { api.myOffers().then(setOffers).catch(() => {}); }, 2000);
    return () => clearInterval(id);
  }, [on]);

  const toggle = async () => {
    setErr('');
    try {
      await api.becomeJobzer();
      const pos = on ? place : await locate();
      await api.setAvailability(!on, pos.lat, pos.lng);
      setOn(!on);
      if (on) setOffers([]);
    } catch (e) {
      setErr(errorText(e));
    }
  };

  const progress = me ? nextTierProgress({ done: me.done, rating: me.rating, onTimePct: me.onTimePct, idVerified: me.idVerified, insured: me.insured }) : null;
  const offer = offers[0];

  return (
    <Screen>
      <ModeSwitch />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <T v="h1" style={{ fontSize: 28 }}>Ai timp să ajuți?</T>
        <T v="small" mute style={{ textAlign: 'center' }}>Arată-le că ești disponibil pentru joburi în zona ta.</T>
      </View>
      <Row gap={14}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
          accessibilityLabel="Sunt disponibil"
          onPress={toggle}
          style={{ width: 60, height: 36, borderRadius: 18, backgroundColor: on ? p.ok : p.fill2, justifyContent: 'center', paddingHorizontal: 3 }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignSelf: on ? 'flex-end' : 'flex-start' }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h3">{on ? 'Sunt disponibil' : 'Nu sunt disponibil'}</T>
          <T v="small" mute>{on ? 'Caut sarcini potrivite în apropiere.' : 'Pornește ca să primești joburi.'}</T>
        </View>
      </Row>
      {err ? <Notice tone="bad" text={err} /> : null}
      {offer ? (
        <Card style={{ gap: 8 }} onPress={() => router.push({ pathname: '/earn/offer', params: { id: offer.id, data: JSON.stringify(offer) } })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Tag tone="ok" icon="check" label="Job nou lângă tine" />
            <T v="xs" mute>{offer.scheduledFor ? 'Programat' : 'Acum'}</T>
          </Row>
          <T v="h2" style={{ fontSize: 20 }}>{offer.title}</T>
          <Row gap={6}><Icon name="pin" size={15} color={p.mute} /><T v="small" mute>{offer.areaLabel} · {(offer.distanceM / 1000).toFixed(1).replace('.', ',')} km</T></Row>
          <T v="big" style={{ fontSize: 26 }}>Primești {formatLei(offer.netBani, 0)}</T>
          <T v="xs" mute>Clientul plătește {formatLei(offer.clientPaysBani, 0)} · comision Jobzee 12%</T>
          <Button title="Vezi detaliile" icon="chev" onPress={() => router.push({ pathname: '/earn/offer', params: { id: offer.id, data: JSON.stringify(offer) } })} />
        </Card>
      ) : (
        <Card style={{ gap: 6 }}>
          <T v="h3">{on ? 'Aștept o ofertă…' : 'Cum primești joburi'}</T>
          <T v="small" mute>{on ? 'Ofertele apar aici. Le poți refuza fără nicio penalizare.' : 'Primești doar sarcini din abilitățile tale, cu suma netă afișată înainte să accepți.'}</T>
        </Card>
      )}
      {progress ? (
        <View style={{ backgroundColor: p.fill, borderRadius: 16, padding: 14, gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}><TierBadge tier={me?.tier ?? 0} big /><T v="label" mute>Până la {progress.next.name}</T></Row>
          {progress.items.map((i) => (
            <Row key={i.label} gap={6}><Icon name={i.met ? 'check' : 'clock'} size={14} color={i.met ? p.ok : p.mute} /><T v="xs">{i.label}</T></Row>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
