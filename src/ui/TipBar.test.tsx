/** @vitest-environment jsdom */
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { TipBar } from './TipBar';

afterEach(cleanup);

const baseInventory = {
  copper_cat6: 4,
  fiber_om4: 2,
  power_c13: 2,
  console_rj45: 1,
};

describe('TipBar', () => {
  it('renders armed chip when armedLabel is provided', () => {
    render(
      <TipBar
        inventory={baseInventory}
        goalsMet={[]}
        goalLabels={[]}
        armedLabel="ToR-1 sw-1"
      />,
    );
    expect(screen.getByText(/Armed: ToR-1 sw-1/)).toBeTruthy();
  });

  it('shows undo button when canUndo is true', () => {
    const onUndo = vi.fn();
    render(
      <TipBar
        inventory={baseInventory}
        goalsMet={[]}
        goalLabels={[]}
        onUndo={onUndo}
        canUndo={true}
      />,
    );
    expect(screen.getByRole('button', { name: /undo/i })).toBeTruthy();
  });

  it('does not show undo button when canUndo is false', () => {
    render(
      <TipBar
        inventory={baseInventory}
        goalsMet={[]}
        goalLabels={[]}
        onUndo={vi.fn()}
        canUndo={false}
      />,
    );
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });

  it('renders cable log chips', () => {
    render(
      <TipBar
        inventory={baseInventory}
        goalsMet={[]}
        goalLabels={[]}
        cableLog={['Cable connected', 'Cable unplugged']}
      />,
    );
    expect(screen.getByText('Cable connected')).toBeTruthy();
    expect(screen.getByText('Cable unplugged')).toBeTruthy();
  });
});
