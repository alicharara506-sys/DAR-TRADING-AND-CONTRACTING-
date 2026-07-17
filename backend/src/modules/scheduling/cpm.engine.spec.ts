import { computeCpm, computeEvm, CpmCycleError, CpmDependency, CpmTaskInput } from './cpm.engine';

describe('CPM engine', () => {
  it('computes a simple FS chain', () => {
    const tasks: CpmTaskInput[] = [
      { id: 'A', duration: 5 },
      { id: 'B', duration: 3 },
      { id: 'C', duration: 4 },
    ];
    const deps: CpmDependency[] = [
      { predecessorId: 'A', successorId: 'B', type: 'FS', lag: 0 },
      { predecessorId: 'B', successorId: 'C', type: 'FS', lag: 0 },
    ];
    const r = computeCpm(tasks, deps);
    expect(r.projectDuration).toBe(12);
    expect(r.tasks.get('A')).toMatchObject({ earlyStart: 0, earlyFinish: 5, totalFloat: 0, isCritical: true });
    expect(r.tasks.get('C')).toMatchObject({ earlyStart: 8, earlyFinish: 12, isCritical: true });
    expect(r.criticalPath).toEqual(['A', 'B', 'C']);
  });

  it('computes float on parallel branches', () => {
    // A(5) -> C(2); B(3) -> C. B has 2 days float.
    const tasks: CpmTaskInput[] = [
      { id: 'A', duration: 5 },
      { id: 'B', duration: 3 },
      { id: 'C', duration: 2 },
    ];
    const deps: CpmDependency[] = [
      { predecessorId: 'A', successorId: 'C', type: 'FS', lag: 0 },
      { predecessorId: 'B', successorId: 'C', type: 'FS', lag: 0 },
    ];
    const r = computeCpm(tasks, deps);
    expect(r.projectDuration).toBe(7);
    expect(r.tasks.get('B')!.totalFloat).toBe(2);
    expect(r.tasks.get('B')!.freeFloat).toBe(2);
    expect(r.tasks.get('B')!.isCritical).toBe(false);
    expect(r.tasks.get('A')!.isCritical).toBe(true);
  });

  it('handles FS lag', () => {
    const r = computeCpm(
      [
        { id: 'A', duration: 2 },
        { id: 'B', duration: 2 },
      ],
      [{ predecessorId: 'A', successorId: 'B', type: 'FS', lag: 3 }],
    );
    expect(r.tasks.get('B')!.earlyStart).toBe(5);
    expect(r.projectDuration).toBe(7);
  });

  it('handles SS and FF dependencies', () => {
    const ss = computeCpm(
      [
        { id: 'A', duration: 10 },
        { id: 'B', duration: 4 },
      ],
      [{ predecessorId: 'A', successorId: 'B', type: 'SS', lag: 2 }],
    );
    expect(ss.tasks.get('B')!.earlyStart).toBe(2);
    expect(ss.projectDuration).toBe(10);

    const ff = computeCpm(
      [
        { id: 'A', duration: 10 },
        { id: 'B', duration: 4 },
      ],
      [{ predecessorId: 'A', successorId: 'B', type: 'FF', lag: 0 }],
    );
    expect(ff.tasks.get('B')!.earlyFinish).toBe(10);
    expect(ff.tasks.get('B')!.earlyStart).toBe(6);
  });

  it('respects not-earlier-than constraints', () => {
    const r = computeCpm([{ id: 'A', duration: 3, notEarlierThan: 10 }], []);
    expect(r.tasks.get('A')!.earlyStart).toBe(10);
    expect(r.projectDuration).toBe(13);
  });

  it('throws on dependency cycles', () => {
    expect(() =>
      computeCpm(
        [
          { id: 'A', duration: 1 },
          { id: 'B', duration: 1 },
        ],
        [
          { predecessorId: 'A', successorId: 'B', type: 'FS', lag: 0 },
          { predecessorId: 'B', successorId: 'A', type: 'FS', lag: 0 },
        ],
      ),
    ).toThrow(CpmCycleError);
  });

  it('matches the workbook project shape (78 tasks reduce correctly)', () => {
    // Mini version of the DAR schedule: prep -> excavation -> foundations -> structure
    const tasks: CpmTaskInput[] = [
      { id: 'prep', duration: 14 },
      { id: 'excav', duration: 21 },
      { id: 'found', duration: 28 },
      { id: 'struct', duration: 56 },
      { id: 'mep', duration: 63 }, // parallel with structure tail
    ];
    const deps: CpmDependency[] = [
      { predecessorId: 'prep', successorId: 'excav', type: 'FS', lag: 0 },
      { predecessorId: 'excav', successorId: 'found', type: 'FS', lag: 0 },
      { predecessorId: 'found', successorId: 'struct', type: 'FS', lag: 0 },
      { predecessorId: 'found', successorId: 'mep', type: 'SS', lag: 30 },
    ];
    const r = computeCpm(tasks, deps);
    // structure chain: 14+21+28+56 = 119; MEP branch: found ES 35 + SS lag 30 = 65, +63 = 128 → MEP governs
    expect(r.projectDuration).toBe(128);
    expect(r.tasks.get('mep')!.earlyStart).toBe(65);
    expect(r.tasks.get('mep')!.isCritical).toBe(true);
    expect(r.tasks.get('struct')!.totalFloat).toBe(9);
  });
});

describe('EVM formulas (PMBOK)', () => {
  it('computes the workbook example correctly', () => {
    // From Budget Tracker sheet: PV 50682, EV 43890, AC 57200, BAC 104500
    const m = computeEvm({ bac: 104500, pv: 50682, ev: 43890, ac: 57200 });
    expect(m.cv).toBe(-13310);
    expect(m.sv).toBe(-6792);
    expect(m.cpi).toBeCloseTo(0.767, 3);
    expect(m.spi).toBeCloseTo(0.866, 3);
    expect(m.eac).toBeCloseTo(136190, 0); // BAC / CPI ≈ 136,190 (workbook shows 136,190)
    expect(m.etc).toBeCloseTo(78990, 0);
    expect(m.vac).toBeCloseTo(-31690, 0);
  });

  it('handles zero AC and zero PV without division errors', () => {
    const m = computeEvm({ bac: 1000, pv: 0, ev: 0, ac: 0 });
    expect(m.cpi).toBe(1);
    expect(m.spi).toBe(1);
    expect(m.eac).toBe(1000);
  });

  it('flags healthy project', () => {
    const m = computeEvm({ bac: 100000, pv: 48000, ev: 50000, ac: 47000 });
    expect(m.cpi).toBeGreaterThan(1);
    expect(m.spi).toBeGreaterThan(1);
    expect(m.vac).toBeGreaterThan(0);
  });
});
