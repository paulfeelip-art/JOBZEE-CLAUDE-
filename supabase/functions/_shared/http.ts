// Small helpers shared by all edge functions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

export const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new HttpError(500, 'missing_config', `Missing environment variable ${name}`);
  return v;
}

/** Client acting as the caller: RLS and auth.uid() apply. */
export function userClient(req: Request): SupabaseClient {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new HttpError(401, 'not_signed_in');
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

/** Backend client with the service role. Never expose its key to apps. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

export async function requireUser(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'not_signed_in');
  return data.user.id;
}

/** Wraps a handler with CORS, method check and uniform errors. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      const msg = e instanceof Error ? e.message : String(e);
      // Postgres errors raised by our functions carry a stable code in the message.
      const known = /^(transition_not_allowed|not_your_task|phone_not_verified|price_out_of_range|outside_romania|chat_closed|offer_closed|not_your_offer|contact_details_not_allowed|verification_incomplete)/.exec(msg);
      if (known) return json({ error: known[1], message: msg }, 409);
      console.error(e);
      return json({ error: 'internal_error' }, 500);
    }
  });
}
