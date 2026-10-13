import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { categoryById } from '@jobzee/shared';
import { Screen } from '@/components/Screen';
import { Button, Card, Chip, FlowHead, Notice, Row, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { api, type IntakeInput } from '@/lib/api';
import { errorText, useStore, whenLabel } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

export default function Intake() {
  const p = usePalette();
  const params = useLocalSearchParams<{ photos?: string }>();
  const { request, updateRequest, place } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reply, setReply] = useState('');
  const asked = useRef(false);
  const d = request.draft;

  const turn = async (conversation = request.conversation, photos?: IntakeInput['photos']) => {
    setBusy(true);
    setErr('');
    try {
      const r = await api.intake({
        conversation, draft: d ?? {}, area: place.label, when: whenLabel(request.when),
        questionsAsked: request.questionsAsked, photos,
      });
      const priceLei = r.price?.suggestedLei ? Math.round(r.price.suggestedLei / 10) * 10 : request.amountLei;
      updateRequest({
        draft: r,
        conversation: [...conversation, { who: 'ai', text: r.reply + (r.question ? `\n${r.question.text}` : '') }],
        questionsAsked: request.questionsAsked + (r.question ? 1 : 0),
        pricing: r.price?.mode ?? categoryById(r.category).mode,
        amountLei: priceLei,
        rateLei: r.price && r.price.mode === 'hourly' ? Math.round((r.price.lowLei + r.price.highLei) / 2 / 5) * 5 : request.rateLei,
        maxHours: r.price?.hours ? Math.round(r.price.hours) : request.maxHours,
      });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (asked.current || d) return;
    asked.current = true;
    const photos = params.photos ? (JSON.parse(params.photos) as IntakeInput['photos']) : undefined;
    turn(request.conversation, photos);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (text: string) => {
    if (!text.trim() || busy) return;
    setReply('');
    turn([...request.conversation, { who: 'me', text: text.trim() }]);
  };

  const ready = !!d?.ready && !busy;

  return (
    <Screen
      footer={
        d?.regulated ? <Button title="Modific cererea" variant="line" onPress={() => router.back()} /> : (
          <Button
            title={ready ? 'Verifică cererea' : busy ? 'Jobzee AI se gândește…' : 'Jobzee AI mai are o întrebare'}
            icon={ready ? 'chev' : undefined}
            disabled={!ready}
            onPress={() => router.push('/request/price')}
          />
        )
      }
    >
      <FlowHead title="Creează cererea" step={2} />
      {d ? (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: p.line }}>
            <T v="label" mute>{categoryById(d.category).label}</T>
            <T v="h2" style={{ fontSize: 20 }}>{d.title || 'Cererea ta'}</T>
          </View>
          {[
            ['activity', 'Detalii', d.details.map((x) => `• ${x}`).join('\n')],
            ['clock', 'Durată estimată', [d.duration, d.people > 1 ? `${d.people} persoane` : ''].filter(Boolean).join(' · ')],
            ['tool', 'Unelte', d.tools],
            ['pin', 'Zona', `${place.label} · adresa exactă doar după confirmare`],
            ...(d.photoNotes ? [['camera', 'Jobzee AI vede', d.photoNotes]] : []),
          ].filter(([, , v]) => v).map(([ic, k, v]) => (
            <Row key={k} gap={12} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: p.line, alignItems: 'flex-start' }}>
              <Icon name={ic as 'pin'} size={20} color={p.mute} />
              <View style={{ flex: 1 }}>
                <T v="label" mute>{k}</T>
                <T v="small">{v}</T>
              </View>
            </Row>
          ))}
          <Row gap={6} style={{ padding: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d.source === 'ai' ? p.ok : p.mute }} />
            <T v="xs" mute>{d.source === 'ai' ? 'Jobzee AI · completat automat' : 'Jobzee AI · reguli locale'}</T>
          </Row>
        </Card>
      ) : null}

      {request.conversation.map((m, i) =>
        m.who === 'me' ? (
          <View key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: p.fill, borderRadius: 18, borderTopRightRadius: 4, paddingVertical: 10, paddingHorizontal: 14 }}>
            <T>{m.text}</T>
          </View>
        ) : (
          <Row key={i} gap={8} style={{ alignItems: 'flex-start' }}>
            <Icon name="spark" size={22} color={p.or} />
            <View style={{ flex: 1, backgroundColor: p.orSoft, borderRadius: 18, borderTopLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 14 }}>
              <T>{m.text}</T>
            </View>
          </Row>
        ),
      )}
      {busy ? (
        <Row gap={8}><ActivityIndicator color={p.or} /><T v="small" mute>Jobzee AI se gândește…</T></Row>
      ) : null}
      {err ? <Notice tone="bad" text={err} /> : null}
      {d?.regulated ? (
        <Notice tone="bad" text="Lucrările la instalații electrice, gaze sau apă cer un specialist autorizat (de exemplu ANRE). În pilot nu le preluăm, dar te putem ajuta cu ce e în jur: mutat mobilă, curățenie, montaje fără instalații." />
      ) : null}
      {d?.question && !busy ? (
        <Row gap={8} style={{ flexWrap: 'wrap', paddingLeft: 30 }}>
          {d.question.options.map((o) => <Chip key={o} label={o} onPress={() => answer(o)} />)}
        </Row>
      ) : null}
      {!d?.regulated ? (
        <Row gap={6} style={{ backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: 16, paddingLeft: 14, paddingRight: 5, paddingVertical: 5 }}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            onSubmitEditing={() => answer(reply)}
            editable={!busy}
            placeholder={ready ? 'Mai adaugi ceva?' : 'Răspunde sau adaugă detalii'}
            placeholderTextColor={p.mute}
            accessibilityLabel="Răspunde lui Jobzee AI"
            style={{ flex: 1, minHeight: 44, fontFamily: font.regular, fontSize: 16, color: p.ink }}
          />
          <Button title="Trimite" accessibilityLabel="Trimite" onPress={() => answer(reply)} disabled={!reply.trim() || busy} style={{ minHeight: 42, paddingHorizontal: 16 }} />
        </Row>
      ) : null}
    </Screen>
  );
}
