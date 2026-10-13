// POST { conversation, draft, area, when, questionsAsked, photos? } → structured request draft.
import { HttpError, json, requireUser, serve, userClient } from '../_shared/http.ts';
import { runIntake, validateIntakeRequest } from '../_shared/ai.ts';

serve(async (req) => {
  await requireUser(userClient(req)); // signed-in users only, to protect the AI budget
  let body: unknown;
  try { body = await req.json(); } catch { throw new HttpError(400, 'bad_json'); }
  let input;
  try { input = validateIntakeRequest(body); } catch (e) { throw new HttpError(400, (e as Error).message); }
  const draft = await runIntake(input, {
    apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5',
  });
  return json(draft);
});
