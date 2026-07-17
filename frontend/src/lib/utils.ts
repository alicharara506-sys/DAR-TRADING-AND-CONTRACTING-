import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ON_TRACK: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  PASSED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  IN_PROGRESS: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  SENT: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  SUBMITTED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  IN_USE: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  MONITOR: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  AT_RISK: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  OPEN: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  DELAYED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  OVER_BUDGET: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  ESCALATED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  NOT_STARTED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  DRAFT: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  CLOSED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  PLANNING: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
};
