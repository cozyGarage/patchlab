import { describe, expect, it } from 'vitest';
import { missions } from '../missions';
import {
  allTransferMissions,
  getTransferMission,
  transfersForParent,
} from './transferVariants';

describe('transferVariants', () => {
  it('builds transfer missions from cleared parents', () => {
    const transfers = transfersForParent('m1-first-lights', missions);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.id).toBe('m1-first-lights-t1');
    expect(transfers[0]?.goals[0]).toMatchObject({
      type: 'link_up',
      a: { portId: 'panel-2' },
    });
  });

  it('resolves transfer missions by id', () => {
    expect(getTransferMission('missing', missions)).toBeUndefined();
    expect(getTransferMission('m11-subnet-ping-t1', missions)?.brief).toMatch(
      /10\.10\.10\.40/,
    );
    expect(allTransferMissions(missions).length).toBeGreaterThanOrEqual(4);
  });
});
