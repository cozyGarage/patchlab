/** @vitest-environment jsdom */
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { Onboarding } from './Onboarding';

afterEach(cleanup);

describe('Onboarding', () => {
  it('renders skip button when open', () => {
    render(
      <Onboarding
        open={true}
        step={0}
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /skip/i })).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <Onboarding
        open={false}
        step={0}
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows armed chip text on step 1', () => {
    render(
      <Onboarding
        open={true}
        step={1}
        onNext={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText(/tap two ports to patch/i)).toBeTruthy();
  });
});
