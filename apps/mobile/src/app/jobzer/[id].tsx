import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { categoryById, nextTierProgress, SKILL_LEVEL_LABEL, TIERS } from '@jobzee/shared';
import { Screen } from '@/components/Screen';
import { Avatar, BackButton, Card, Row, T, Tag, TierBadge } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { api, type JobzerPublic, type Review } from '@/lib/api';
import { usePalette } from '@/lib/theme';

const LEGAL: Record<string, string> = { persoana_fizica: 'Persoană fizică', pfa: 'PFA', ii: 'Întreprindere individuală', srl: 'SRL' };

export default function JobzerProfile() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [j, setJ] = useState<JobzerPublic | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    api.jobzer(id).then(setJ).catch(() => {});
    api.reviewsFor(id).then(setReviews).catch(() => {});
  }, [id]);

  if (!j) return <Screen><ActivityIndicator color={p.or} /></Screen>;
  const tier = TIERS[j.tier]!;
  const next = nextTierProgress({ done: j.done, rating: j.rating, onTimePct: j.onTimePct, idVerified: j.idVerified, insured: j.insured });

  return (
    <Screen>
      <BackButton />
      <Row gap={16} style={{ alignItems: 'flex-start' }}>
        <Avatar photo={j.photo} initials={j.displayName.slice(0, 2)} size={104} />
        <View style={{ flex: 1, gap: 6 }}>
          <T v="h1" style={{ fontSize: 26 }}>{j.displayName}</T>
          <TierBadge tier={j.tier} big />
          <T v="small" mute>{LEGAL[j.legalForm]}{j.companyName ? ` · ${j.companyName}` : ''}{j.issuesInvoice ? ' · Factură disponibilă' : ''}</T>
          <Row gap={6}><Icon name="star" size={16} color={p.or} /><T v="h3">{j.rating.toFixed(1).replace('.', ',')}</T><T v="small" mute>{j.reviewCount} recenzii din sarcini finalizate</T></Row>
        </View>
      </Row>
      <Row gap={8}>
        {[[String(j.done), 'sarcini'], [`${j.onTimePct}%`, 'la timp'], [new Date(j.memberSince).getFullYear().toString(), 'pe Jobzee din']].map(([a, b]) => (
          <View key={b} style={{ flex: 1, backgroundColor: p.fill, borderRadius: 14, padding: 12, alignItems: 'center' }}>
            <T v="h2" style={{ fontSize: 20 }}>{a}</T>
            <T v="xs" mute>{b}</T>
          </View>
        ))}
      </Row>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Tag tone={j.idVerified ? 'ok' : 'neutral'} icon={j.idVerified ? 'check' : undefined} label="Identitate" />
        <Tag tone={j.backgroundChecked ? 'ok' : 'neutral'} icon={j.backgroundChecked ? 'check' : undefined} label="Cazier" />
        <Tag tone={j.insured ? 'ok' : 'neutral'} icon={j.insured ? 'check' : undefined} label="Asigurare" />
      </Row>
      <T>{j.bio}</T>
      <View style={{ gap: 8 }}>
        <T v="h3">Competențe <T v="xs" mute>(nivel din lucrări finalizate)</T></T>
        {j.skills.map((s) => (
          <Card key={s.category} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
            <Icon name="tool" color={p.ink} />
            <View style={{ flex: 1 }}>
              <T v="h3" style={{ fontSize: 15 }}>{categoryById(s.category).label}</T>
              <T v="xs" mute>{s.years} {s.years === 1 ? 'an' : 'ani'} de experiență</T>
            </View>
            <Tag tone={s.level === 'calificat' ? 'ok' : 'neutral'} label={SKILL_LEVEL_LABEL[s.level]} />
          </Card>
        ))}
        <T v="xs" mute>„Calificat” apare doar cu un certificat verificat de echipa Jobzee.</T>
      </View>
      <View style={{ backgroundColor: p.fill, borderRadius: 16, padding: 14, gap: 4 }}>
        <T v="label">{tier.requirement}</T>
        {next ? <T v="xs" mute>Următorul nivel: {next.next.name} ({next.next.requirement}).</T> : null}
        <T v="xs" mute>Nivelurile vin doar din lucrări finalizate. Refuzul unei oferte nu contează niciodată.</T>
      </View>
      {j.tools.length ? <View style={{ gap: 8 }}><T v="h3">Unelte</T><Row gap={6} style={{ flexWrap: 'wrap' }}>{j.tools.map((t) => <Tag key={t} label={t} />)}</Row></View> : null}
      <View style={{ gap: 10 }}>
        <T v="h3">Recenzii</T>
        {reviews.map((r) => (
          <Card key={r.id} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={2}>{[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" size={14} color={n <= r.stars ? p.or : p.fill2} />)}</Row>
              <T v="xs" mute>{new Date(r.createdAt).toLocaleDateString('ro-RO')}</T>
            </Row>
            <T v="small"><T v="small" style={{ fontWeight: '700' }}>{r.authorName}</T> · sarcină verificată</T>
            <T v="small">„{r.body}”</T>
            {r.reply ? <View style={{ backgroundColor: p.fill, borderRadius: 12, padding: 10 }}><T v="xs" mute>Răspunsul lui {j.displayName.split(' ')[0]}</T><T v="small">{r.reply}</T></View> : null}
          </Card>
        ))}
        <T v="xs" mute>Doar clienții cu o sarcină finalizată pot lăsa recenzii. Notele apar după ce evaluează ambele părți.</T>
      </View>
    </Screen>
  );
}
