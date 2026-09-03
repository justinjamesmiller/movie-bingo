import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Landing from './Landing.jsx';

function renderLanding(overrides = {}) {
  return render(
    <Landing
      onHost={vi.fn()}
      onJoin={vi.fn()}
      error=""
      busy={false}
      savedSession={null}
      onRejoin={vi.fn()}
      {...overrides}
    />,
  );
}

describe('Landing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scrolls to the top when the join/host page loads', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });

  it('shows the reconnect option near the top when a saved session exists', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderLanding({ savedSession: { code: 'ABCD', name: 'Sidney' } });
    expect(screen.getByRole('heading', { name: 'Reconnect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect to ABCD' })).toBeInTheDocument();
  });
});
