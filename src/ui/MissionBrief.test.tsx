/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { getMission } from '../missions';
import { MissionBrief } from './MissionBrief';

afterEach(cleanup);

describe('MissionBrief', () => {
  it('shows learning.impact instead of ticketDetails[0] on challenge/boss', () => {
    const mission = getMission('m5-change-window')!;
    render(
      <MissionBrief
        mission={mission}
        campaignPace="standard"
        onBack={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    const impact = screen.getByText(/Impact:/i).closest('p');
    expect(impact).toHaveTextContent(/abandoned copper/i);
    expect(impact).not.toHaveTextContent(/A-08|Gi1\/0\/8/i);
    const details = screen.getByText(/Ticket details/i).closest('details');
    expect(details).not.toHaveAttribute('open');
  });

  it('keeps ticket recipes collapsed on Standard pace', () => {
    const mission = getMission('m32-traceroute')!;
    render(
      <MissionBrief
        mission={mission}
        campaignPace="standard"
        onBack={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    const details = screen.getByText(/Ticket details/i).closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText(/Symptom:/i).closest('p')).toHaveTextContent(
      /BRANCH is dark/i,
    );
  });
});
