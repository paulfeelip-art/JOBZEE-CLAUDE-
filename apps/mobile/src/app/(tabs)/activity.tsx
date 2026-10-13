import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { formatLei, STATUS_LABEL } from '@jobzee/shared';
import { Screen } from '@/components/Screen';
import { Card, Row, T, Tag } from '@/components/ui';
import { api, type TaskView } from '@/lib/api';

export default function Activity() {
  const [tasks, setTasks] = useState<TaskView[]>([]);
  useFocusEffect(useCallback(() => { api.myTasks().then(setTasks).catch(() => {}); }, []));
  const open = (t: TaskView) => {
    if (['searching', 'matched'].includes(t.status)) router.push({ pathname: '/request/match', params: { id: t.id } });
    else router.push({ pathname: '/task/[id]', params: { id: t.id } });
  };
  return (
    <Screen>
      <T v="h1">Activitate</T>
      {tasks.length === 0 ? <T mute>Cererile tale apar aici.</T> : null}
      {tasks.map((t) => (
        <Card key={t.id} onPress={() => open(t)} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h3" style={{ flex: 1 }}>{t.title}</T>
            <Tag tone={t.status === 'completed' ? 'ok' : t.status === 'cancelled' ? 'neutral' : 'or'} label={STATUS_LABEL[t.status]} />
          </Row>
          <T v="small" mute>{t.jobzer ? `${t.jobzer.displayName} · ` : ''}{formatLei(t.finalPriceBani ?? t.holdBani, 0)} · {new Date(t.createdAt).toLocaleDateString('ro-RO')}</T>
        </Card>
      ))}
    </Screen>
  );
}
