import { describe, expect, it } from 'vitest';
import { missions } from '../missions';
import {
  TRANSFER_DEFS,
  allTransferMissions,
  getTransferMission,
  transfersForParent,
} from './transferVariants';

const ARC_TRANSFER_PARENTS = [
  'm1-first-lights',
  'm11-subnet-ping',
  'm13-access-vlan',
  'm19-broken-address',
  'm18-deny-host',
  'm24-wrong-gateway',
  'm25-host-route',
  'm31-pat-overload',
  'm30-floating-static',
  'm32-traceroute',
] as const;

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

  it('covers one transfer parent per late arc plus early arcs', () => {
    for (const parentId of ARC_TRANSFER_PARENTS) {
      expect(
        TRANSFER_DEFS.some((def) => def.parentId === parentId),
        `missing transfer for ${parentId}`,
      ).toBe(true);
    }
    expect(allTransferMissions(missions).length).toBeGreaterThanOrEqual(
      ARC_TRANSFER_PARENTS.length,
    );
  });

  it('keeps transfer briefs symptom-first with values in ticket details', () => {
    const transfer = getTransferMission('m11-subnet-ping-t1', missions);
    expect(transfer).toBeTruthy();
    expect(transfer!.brief).not.toMatch(/10\.10\.10\.40/);
    expect(transfer!.learning.ticketDetails?.join(' ')).toMatch(/10\.10\.10\.40/);

    const deny = getTransferMission('m18-deny-host-t1', missions);
    expect(deny!.brief).not.toMatch(/10\.10\.10\.10\/32/);
    expect(deny!.learning.ticketDetails?.join(' ')).toMatch(/10\.10\.10\.10\/32/);
  });

  it('resolves transfer missions by id', () => {
    expect(getTransferMission('missing', missions)).toBeUndefined();
    expect(getTransferMission('m32-traceroute-t1', missions)?.id).toBe(
      'm32-traceroute-t1',
    );
  });
});
