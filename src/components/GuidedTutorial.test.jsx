import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GuidedTutorial from './GuidedTutorial.jsx';

function props(overrides = {}) {
  return {
    isHost: false,
    started: false,
    soundMuted: true,
    onEnableSound: vi.fn(),
    onToggleTheme: vi.fn(),
    onBrowse: vi.fn(),
    onWagers: vi.fn(),
    onMenu: vi.fn(),
    onAdvanced: vi.fn(),
    onPause: vi.fn(),
    onDisable: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
}

describe('GuidedTutorial', () => {
  it('teaches sound, browsing, and optional pre-game wagers with real action callbacks', () => {
    const callbacks = props();
    render(<GuidedTutorial {...callbacks} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Keep the group in earshot');
    expect(callbacks.onEnableSound).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound on' }));
    expect(callbacks.onEnableSound).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Browse a trope' }));
    expect(callbacks.onBrowse).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Add a little friendly suspense' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Explore optional wagers' }));
    expect(callbacks.onWagers).toHaveBeenCalledTimes(1);
  });

  it('switches to gameplay steps when the watch starts', () => {
    const callbacks = props();
    const { rerender } = render(<GuidedTutorial {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    rerender(<GuidedTutorial {...callbacks} started />);
    expect(screen.getByRole('heading', { name: 'Keep the group in earshot' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Spot it, then claim it' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore optional wagers' })).toBeNull();
  });

  it('offers host setup controls and a separate optional advanced branch', () => {
    const callbacks = props({ isHost: true, soundMuted: false });
    render(<GuidedTutorial {...callbacks} />);
    expect(screen.getByText('Sound is on.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn sound on' })).toBeNull();
    for (let index = 0; index < 4; index++) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Start when everyone is ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Choose light or dark' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle light/dark mode' }));
    expect(callbacks.onToggleTheme).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Explore advanced options' }));
    expect(screen.getByRole('heading', { name: 'Optional host controls' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open advanced tools' }));
    expect(callbacks.onAdvanced).toHaveBeenCalledTimes(1);
  });

  it('allows skipping, pausing with Escape, and finishing', () => {
    const callbacks = props();
    render(<GuidedTutorial {...callbacks} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(callbacks.onPause).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial on this device' }));
    expect(callbacks.onDisable).toHaveBeenCalledTimes(1);
    while (screen.queryByRole('button', { name: 'Next', exact: true }))
      fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish guide' }));
    expect(callbacks.onFinish).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('teaches calls only after opting into advanced guidance (host: %s)', (isHost) => {
    const callbacks = props({ isHost, started: true });
    render(<GuidedTutorial {...callbacks} />);
    while (screen.queryByRole('button', { name: 'Next', exact: true })) {
      expect(screen.queryByRole('heading', { name: 'Call the next moment' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    }
    expect(screen.queryByRole('heading', { name: 'Call the next moment' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Explore advanced options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    expect(screen.getByRole('heading', { name: 'Call the next moment' })).toBeInTheDocument();
    expect(screen.getByText(/Advanced actions, then Call it next/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open a trope' }));
    expect(callbacks.onBrowse).toHaveBeenCalledTimes(1);
  });

  it.each(['modal', 'game-menu-panel'])(
    'pauses behind %s and resumes without losing the current step',
    async (className) => {
      const { rerender } = render(
        <>
          <GuidedTutorial {...props()} />
          <div />
        </>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      rerender(
        <>
          <GuidedTutorial {...props()} />
          <div className={className}>A gameplay popup</div>
        </>,
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      rerender(
        <>
          <GuidedTutorial {...props()} />
          <div />
        </>,
      );
      expect(await screen.findByRole('dialog')).toHaveAccessibleName('Explore your board');
    },
  );
  it('immediately yields to external celebrations or focus mode and retains its step', async () => {
    const callbacks = props();
    const { rerender } = render(<GuidedTutorial {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    rerender(<GuidedTutorial {...callbacks} suspended />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<GuidedTutorial {...callbacks} suspended={false} />);
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Explore your board');
  });
  it('keeps a tall mobile tip clear of its highlighted control', () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    let targetTop = 263;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(({ top }) => {
      targetTop -= top;
    });
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.dataset.tutorial === 'sound') return new DOMRect(270, targetTop, 36, 40);
      if (this.classList.contains('tutorial-card')) return new DOMRect(12, 0, 296, 300);
      return new DOMRect();
    });
    try {
      render(
        <>
          <button data-tutorial="sound">Sound control</button>
          <GuidedTutorial {...props()} />
        </>,
      );
      const card = screen.getByRole('dialog');
      expect(scroll).toHaveBeenCalledWith({ top: 251, behavior: 'instant' });
      expect(parseFloat(card.style.top)).toBeGreaterThanOrEqual(targetTop + 40 + 12);
      expect(parseFloat(card.style.top) + 300).toBeLessThanOrEqual(600);
    } finally {
      bounds.mockRestore();
      scroll.mockRestore();
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
    }
  });
});
