/**
 * Critical Path Method (CPM) scheduling engine.
 *
 * Pure, framework-free implementation so it can be unit-tested in isolation.
 * Supports FS / SS / FF / SF dependencies with lag, forward & backward pass,
 * total float, free float and critical-path identification.
 *
 * Time is modelled in whole days relative to the project start (day 0).
 */

export interface CpmTaskInput {
  id: string;
  duration: number; // working duration in days (>= 0)
  /** optional constraint: earliest allowed start, days from project start */
  notEarlierThan?: number;
}

export interface CpmDependency {
  predecessorId: string;
  successorId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number; // days, may be negative
}

export interface CpmTaskResult {
  id: string;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

export interface CpmResult {
  tasks: Map<string, CpmTaskResult>;
  projectDuration: number;
  criticalPath: string[]; // task ids in topological order
}

export class CpmCycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Dependency cycle detected: ${cycle.join(' -> ')}`);
  }
}

/** Kahn topological sort; throws CpmCycleError when the graph is cyclic. */
function topoSort(taskIds: string[], deps: CpmDependency[]): string[] {
  const inDegree = new Map<string, number>(taskIds.map((id) => [id, 0]));
  const adj = new Map<string, string[]>(taskIds.map((id) => [id, []]));
  for (const d of deps) {
    if (!inDegree.has(d.predecessorId) || !inDegree.has(d.successorId)) continue;
    adj.get(d.predecessorId)!.push(d.successorId);
    inDegree.set(d.successorId, (inDegree.get(d.successorId) ?? 0) + 1);
  }
  const queue = taskIds.filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const deg = inDegree.get(next)! - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }
  if (order.length !== taskIds.length) {
    const remaining = taskIds.filter((id) => !order.includes(id));
    throw new CpmCycleError(remaining);
  }
  return order;
}

export function computeCpm(tasks: CpmTaskInput[], deps: CpmDependency[]): CpmResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const validDeps = deps.filter((d) => byId.has(d.predecessorId) && byId.has(d.successorId));
  const order = topoSort(
    tasks.map((t) => t.id),
    validDeps,
  );

  const predsOf = new Map<string, CpmDependency[]>();
  const succsOf = new Map<string, CpmDependency[]>();
  for (const d of validDeps) {
    (predsOf.get(d.successorId) ?? predsOf.set(d.successorId, []).get(d.successorId)!).push(d);
    (succsOf.get(d.predecessorId) ?? succsOf.set(d.predecessorId, []).get(d.predecessorId)!).push(d);
  }

  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  // ---- forward pass ----
  for (const id of order) {
    const t = byId.get(id)!;
    let earliest = t.notEarlierThan ?? 0;
    for (const d of predsOf.get(id) ?? []) {
      const pEs = es.get(d.predecessorId)!;
      const pEf = ef.get(d.predecessorId)!;
      let candidate: number;
      switch (d.type) {
        case 'FS': candidate = pEf + d.lag; break;
        case 'SS': candidate = pEs + d.lag; break;
        case 'FF': candidate = pEf + d.lag - t.duration; break;
        case 'SF': candidate = pEs + d.lag - t.duration; break;
      }
      earliest = Math.max(earliest, candidate);
    }
    es.set(id, earliest);
    ef.set(id, earliest + t.duration);
  }

  const projectDuration = Math.max(0, ...order.map((id) => ef.get(id)!));

  // ---- backward pass ----
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const t = byId.get(id)!;
    let latestFinish = projectDuration;
    for (const d of succsOf.get(id) ?? []) {
      const succ = byId.get(d.successorId)!;
      const sLs = ls.get(d.successorId)!;
      const sLf = lf.get(d.successorId)!;
      let candidate: number;
      switch (d.type) {
        case 'FS': candidate = sLs - d.lag; break;
        case 'SS': candidate = sLs - d.lag + t.duration; break;
        case 'FF': candidate = sLf - d.lag; break;
        case 'SF': candidate = sLf - d.lag + t.duration; break;
      }
      latestFinish = Math.min(latestFinish, candidate);
    }
    lf.set(id, latestFinish);
    ls.set(id, latestFinish - t.duration);
  }

  // ---- float & critical path ----
  const results = new Map<string, CpmTaskResult>();
  for (const id of order) {
    const t = byId.get(id)!;
    const totalFloat = ls.get(id)! - es.get(id)!;
    // free float: how much task can slip without delaying ANY successor's early start
    let freeFloat = projectDuration - ef.get(id)!;
    for (const d of succsOf.get(id) ?? []) {
      const succ = byId.get(d.successorId)!;
      let slack: number;
      switch (d.type) {
        case 'FS': slack = es.get(d.successorId)! - (ef.get(id)! + d.lag); break;
        case 'SS': slack = es.get(d.successorId)! - (es.get(id)! + d.lag); break;
        case 'FF': slack = ef.get(d.successorId)! - (ef.get(id)! + d.lag); break;
        case 'SF': slack = ef.get(d.successorId)! - (es.get(id)! + d.lag); break;
      }
      freeFloat = Math.min(freeFloat, slack);
    }
    results.set(id, {
      id,
      earlyStart: es.get(id)!,
      earlyFinish: ef.get(id)!,
      lateStart: ls.get(id)!,
      lateFinish: lf.get(id)!,
      totalFloat,
      freeFloat: Math.max(0, freeFloat),
      isCritical: totalFloat <= 0,
    });
  }

  const criticalPath = order.filter((id) => results.get(id)!.isCritical);
  return { tasks: results, projectDuration, criticalPath };
}

// ============================================================================
// Earned Value Management helpers (PMBOK-standard formulas)
// ============================================================================

export interface EvmInput {
  bac: number; // Budget at Completion
  pv: number; // Planned Value  (BCWS)
  ev: number; // Earned Value   (BCWP)
  ac: number; // Actual Cost    (ACWP)
}

export interface EvmMetrics extends EvmInput {
  cv: number;   // Cost Variance          EV - AC
  sv: number;   // Schedule Variance      EV - PV
  cpi: number;  // Cost Performance Index EV / AC
  spi: number;  // Schedule Perf. Index   EV / PV
  eac: number;  // Estimate at Completion BAC / CPI
  etc: number;  // Estimate to Complete   EAC - AC
  vac: number;  // Variance at Completion BAC - EAC
  tcpi: number; // To-Complete Perf Index (BAC-EV)/(BAC-AC)
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function computeEvm(input: EvmInput): EvmMetrics {
  const { bac, pv, ev, ac } = input;
  const cpi = ac > 0 ? ev / ac : ev > 0 ? Infinity : 1;
  const spi = pv > 0 ? ev / pv : 1;
  const safeCpi = Number.isFinite(cpi) && cpi > 0 ? cpi : 1;
  const eac = safeCpi > 0 ? bac / safeCpi : bac;
  const etc = Math.max(0, eac - ac);
  const denominator = bac - ac;
  const tcpi = denominator !== 0 ? (bac - ev) / denominator : 1;
  return {
    bac: r2(bac), pv: r2(pv), ev: r2(ev), ac: r2(ac),
    cv: r2(ev - ac), sv: r2(ev - pv),
    cpi: r3(Number.isFinite(cpi) ? cpi : 1), spi: r3(spi),
    eac: r2(eac), etc: r2(etc), vac: r2(bac - eac), tcpi: r3(tcpi),
  };
}
