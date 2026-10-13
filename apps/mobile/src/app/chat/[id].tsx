import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { containsContactDetails } from '@jobzee/shared';
import { Screen } from '@/components/Screen';
import { BackButton, Button, Notice, Row, T } from '@/components/ui';
import { api, type Message } from '@/lib/api';
import { errorText } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

export default function Chat() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => api.messages(id).then(setMsgs).catch(() => {}), [id]);
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setErr('');
    try {
      await api.sendMessage(id, body);
      setText('');
      load();
    } catch (e) {
      setErr(errorText(e));
    }
  };

  return (
    <Screen footer={
      <Row gap={6}>
        <TextInput value={text} onChangeText={setText} onSubmitEditing={send} placeholder="Scrie un mesaj" placeholderTextColor={p.mute} accessibilityLabel="Mesaj"
          style={{ flex: 1, minHeight: 48, backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.line, borderRadius: 16, paddingHorizontal: 14, fontFamily: font.regular, fontSize: 16, color: p.ink }} />
        <Button title="Trimite" onPress={send} disabled={!text.trim()} style={{ minHeight: 48 }} />
      </Row>
    }>
      <Row><BackButton /><T v="h3">Mesaje</T></Row>
      <T v="xs" mute>Conversația rămâne în Jobzee, ca să te putem ajuta dacă apare o problemă. Apelurile trec prin număr mascat.</T>
      {containsContactDetails(text) ? <Notice text="Pare că trimiți date de contact. Nu e nevoie: poți scrie și suna din aplicație." /> : null}
      {msgs.map((m) => (
        <View key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: m.mine ? p.fill : p.orSoft, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 }}>
          <T>{m.body}</T>
          <T v="xs" mute>{new Date(m.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</T>
        </View>
      ))}
      {!msgs.length ? <T v="small" mute>Niciun mesaj încă.</T> : null}
      {err ? <Notice tone="bad" text={err} /> : null}
    </Screen>
  );
}
