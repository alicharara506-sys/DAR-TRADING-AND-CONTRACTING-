import { Prisma } from '@prisma/client';

export const dec = (v: Prisma.Decimal | number | string | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);

export const round2 = (v: number): number => Math.round(v * 100) / 100;
export const round4 = (v: number): number => Math.round(v * 10000) / 10000;
export const safeDiv = (a: number, b: number): number => (b === 0 ? 0 : a / b);
