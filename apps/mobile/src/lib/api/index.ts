import { createDemoApi } from './demo';
import { createLiveApi } from './live';
import type { JobzeeApi } from './types';

export * from './types';
export { demoAdvance } from './demo';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Live when a Supabase project is configured, otherwise the on-device demo. */
export const api: JobzeeApi = url && key ? createLiveApi(url, key) : createDemoApi();
