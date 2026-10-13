/**
 * Task lifecycle. The database enforces the same transitions in
 * `public.advance_task` so neither app can skip a step.
 */
export type TaskStatus =
  | 'draft' // being written with Jobzee AI
  | 'searching' // offers sent to Jobzers, payment not yet held
  | 'matched' // a Jobzer accepted, waiting for the client to confirm and authorise payment
  | 'confirmed' // payment authorised (held), address shared with the Jobzer
  | 'en_route'
  | 'in_progress' // started with the client's start code
  | 'awaiting_confirmation' // Jobzer marked done, client checks
  | 'completed' // payment captured, payout scheduled
  | 'cancelled'
  | 'disputed';

export type Actor = 'client' | 'jobzer' | 'system' | 'ops';

const T: Record<TaskStatus, Partial<Record<TaskStatus, Actor[]>>> = {
  draft: { searching: ['client'], cancelled: ['client'] },
  searching: { matched: ['jobzer', 'system'], cancelled: ['client', 'system'] },
  matched: { confirmed: ['client'], searching: ['client', 'system'], cancelled: ['client', 'jobzer'] },
  confirmed: { en_route: ['jobzer'], cancelled: ['client', 'jobzer', 'ops'] },
  en_route: { in_progress: ['jobzer'], cancelled: ['client', 'jobzer', 'ops'] },
  in_progress: { awaiting_confirmation: ['jobzer'], disputed: ['client', 'jobzer'] },
  awaiting_confirmation: { completed: ['client', 'system'], disputed: ['client'] },
  completed: {},
  cancelled: {},
  disputed: { completed: ['ops'], cancelled: ['ops'] },
};

export function canTransition(from: TaskStatus, to: TaskStatus, actor: Actor): boolean {
  return (T[from][to] ?? []).includes(actor);
}

export function nextStatuses(from: TaskStatus, actor: Actor): TaskStatus[] {
  return (Object.keys(T[from]) as TaskStatus[]).filter((to) => canTransition(from, to, actor));
}

/** Late cancellation fee applies once the Jobzer has left. */
export const jobzerHasLeft = (s: TaskStatus): boolean => s === 'en_route';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  draft: 'Ciornă',
  searching: 'Caut Jobzeri',
  matched: 'Jobzer găsit',
  confirmed: 'Confirmat',
  en_route: 'Pe drum',
  in_progress: 'În lucru',
  awaiting_confirmation: 'Așteaptă confirmarea',
  completed: 'Finalizat',
  cancelled: 'Anulat',
  disputed: 'În analiză',
};

/** 4-digit code the client tells the Jobzer at the door, so the task starts only on site. */
export function makeStartCode(random: () => number = Math.random): string {
  return String(1000 + Math.floor(random() * 9000));
}
