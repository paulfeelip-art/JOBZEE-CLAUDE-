import { PGlite, type Transaction } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * In-process Postgres + PostGIS with a minimal stand-in for the parts of
 * Supabase the migrations rely on (auth schema, roles, storage tables).
 * Lets us run the real migrations and exercise RLS and functions in CI
 * without Docker.
 */
const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  phone text,
  phone_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to authenticated;
`;

export async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { postgis } });
  await db.exec(SUPABASE_STUB);
  await db.exec(`set search_path = public, extensions;`);
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(dir, f), 'utf8'));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  // Supabase grants the service role access to everything.
  await db.exec(`
    grant usage on schema public, extensions to service_role;
    grant all on all tables in schema public to service_role;
    grant all on all functions in schema public to service_role;
    grant usage on schema extensions to authenticated, anon;
    grant execute on all functions in schema extensions to authenticated, anon, service_role;
  `);
  return db;
}

export type Who = { uid: string | null; role: 'anon' | 'authenticated' | 'service_role' };

/** Run statements as a given Supabase user, like PostgREST does. */
export async function as<T>(db: PGlite, who: Who, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: who.uid ?? '', role: who.role }),
    ]);
    await tx.exec(`set local role ${who.role}; set local search_path = public, extensions;`);
    return fn(tx);
  });
}

export async function one<T = Record<string, unknown>>(tx: Transaction | PGlite, sql: string, params: unknown[] = []): Promise<T> {
  const r = await tx.query<T>(sql, params);
  return r.rows[0] as T;
}
