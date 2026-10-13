// Jobzee AI: turns free text and photos into a structured request.
// Calls the Claude Messages API; falls back to rules when unavailable.
import { intakePrompt, rulesIntake, sanitizeIntake, type IntakeDraft } from './rules/index.ts';
export { rulesIntake };

export interface IntakeRequest {
  conversation: Array<{ who: 'me' | 'ai'; text: string }>;
  draft: Record<string, unknown>;
  area: string;
  when: string;
  questionsAsked: number;
  photos?: Array<{ mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string }>;
}

export function validateIntakeRequest(body: unknown): IntakeRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const conv = Array.isArray(b.conversation) ? b.conversation : [];
  if (!conv.length || conv.length > 30) throw new Error('bad_conversation');
  const conversation = conv.map((m) => {
    const x = m as Record<string, unknown>;
    return { who: x.who === 'ai' ? 'ai' : 'me', text: String(x.text ?? '').slice(0, 600) } as const;
  });
  const photos = (Array.isArray(b.photos) ? b.photos : []).slice(0, 4).map((p) => {
    const x = p as Record<string, unknown>;
    const mediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(String(x.mediaType)) ? String(x.mediaType) : 'image/jpeg';
    const base64 = String(x.base64 ?? '');
    if (base64.length > 7_000_000) throw new Error('photo_too_large'); // ~5 MB
    return { mediaType: mediaType as 'image/jpeg', base64 };
  });
  return {
    conversation,
    draft: (b.draft && typeof b.draft === 'object' ? b.draft : {}) as Record<string, unknown>,
    area: String(b.area ?? '').slice(0, 80),
    when: String(b.when ?? 'Acum').slice(0, 60),
    questionsAsked: Math.max(0, Math.min(10, Number(b.questionsAsked) || 0)),
    photos,
  };
}

export async function runIntake(req: IntakeRequest, opts: { apiKey?: string; model: string; fetchImpl?: typeof fetch }): Promise<IntakeDraft & { source: 'ai' | 'rules' }> {
  if (opts.apiKey) {
    try {
      const prompt = intakePrompt({
        area: req.area, when: req.when, questionsAsked: req.questionsAsked,
        draftJson: JSON.stringify(req.draft).slice(0, 2000),
        conversation: req.conversation.map((m) => `${m.who === 'me' ? 'Utilizator' : 'Jobzee AI'}: ${m.text}`).join('\n'),
        photoCount: req.photos?.length ?? 0,
      });
      const content = [
        ...(req.photos ?? []).map((p) => ({ type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.base64 } })),
        { type: 'text', text: prompt },
      ];
      const res = await (opts.fetchImpl ?? fetch)('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: opts.model, max_tokens: 900, messages: [{ role: 'user', content }] }),
      });
      if (!res.ok) throw new Error(`anthropic_${res.status}`);
      const data = await res.json();
      const text: string = (data.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
      const jsonText = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      return { ...sanitizeIntake(JSON.parse(jsonText), req.questionsAsked), source: 'ai' };
    } catch (e) {
      console.warn('AI intake failed, using rules:', e instanceof Error ? e.message : e);
    }
  }
  return { ...rulesIntake(req), source: 'rules' };
}
