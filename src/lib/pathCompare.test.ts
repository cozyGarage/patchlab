import { describe, expect, it } from 'vitest';
import { createEngineState } from '../engine/reducer';
import { baseRack, getMission } from '../missions';
import { compareMissionPath } from './pathCompare';

describe('compareMissionPath', () => {
  it('lists intended endpoints from mission goals', () => {
    const mission = getMission('m1-first-lights')!;
    const state = createEngineState(mission, baseRack);
    const compare = compareMissionPath(state);
    expect(compare.intended.length).toBeGreaterThan(0);
    expect(compare.intended.some((x) => x.includes('panel-1'))).toBe(true);
    expect(compare.summary.length).toBeGreaterThan(0);
  });
});
