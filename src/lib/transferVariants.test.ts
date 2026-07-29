import { describe, expect, it } from 'vitest';
import { missions } from '../missions';
import {
  TRANSFER_DEFS,
  allTransferMissions,
  getTransferMission,
  transfersForParent,
} from './transferVariants';

/** One transfer parent per operational arc (plus existing late-arc coverage). */
const ARC_TRANSFER_PARENTS = [
  'm1-first-lights', // arc 1 copper
  'm6-fiber-first', // arc 2 fiber/power
  'm4-admin-down', // arc 3 admin recovery
  'm11-subnet-ping', // arc 4 addressing
  'm18-deny-host', // arc 5 ACL
  'm13-access-vlan', // arc 6 VLAN
  'm24-wrong-gateway', // arc 7 gateway/uplink
  'm16-trunk-uplink', // arc 7 trunk practice
  'm17-static-nat', // arc 8 NAT
  'm31-pat-overload', // arc 8 PAT
  'm25-host-route', // arc 9 routing
  'm30-floating-static', // arc 9 floating
  'm32-traceroute', // arc 10 capstone
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

  it('covers one transfer parent per arc including thin trunk/NAT arcs', () => {
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

    const trunk = getTransferMission('m16-trunk-uplink-t1', missions);
    expect(trunk!.brief).not.toMatch(/Gi1\/0\/6/);
    expect(trunk!.learning.ticketDetails?.join(' ')).toMatch(/Gi1\/0\/6/);

    const nat = getTransferMission('m17-static-nat-t1', missions);
    expect(nat!.brief).not.toMatch(/203\.0\.113\.11/);
    expect(nat!.learning.ticketDetails?.join(' ')).toMatch(/203\.0\.113\.11/);
  });

  it('resolves transfer missions by id', () => {
    expect(getTransferMission('missing', missions)).toBeUndefined();
    expect(getTransferMission('m6-fiber-first-t1', missions)?.id).toBe(
      'm6-fiber-first-t1',
    );
    expect(getTransferMission('m32-traceroute-t1', missions)?.id).toBe(
      'm32-traceroute-t1',
    );
  });
});
