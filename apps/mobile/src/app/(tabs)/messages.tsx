import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Avatar, Card, Row, T } from '@/components/ui';
import { api, type TaskView } from '@/lib/api';

const OPEN = ['confirmed', 'en_route', 'in_progress', 'awaiting_confirmation', 'completed', 'disputed'];

export default function Messages() {
  const [tasks, setTasks] = useState<TaskView[]>([]);
  useFocusEffect(useCallback(() => { api.myTasks().then((l) => setTasks(l.filter((t) => t.jobzer && OPEN.includes(t.status)))).catch(() => {}); }, []));
  return (
    <Screen>
      <T v="h1">Mesaje</T>
      {tasks.length === 0 ? <T mute>Poți scrie cu Jobzerul după ce îl confirmi.</T> : null}
      {tasks.map((t) => (
        <Card key={t.id} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: t.id } })}>
          <Row>
            <Avatar photo={t.jobzer!.photo} initials={t.jobzer!.displayName.slice(0, 2)} />
            <Row gap={0} style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start' }}>
              <T v="h3">{t.jobzer!.displayName}</T>
              <T v="small" mute>{t.title}</T>
            </Row>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
