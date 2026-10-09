import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { lazyTool } from './lazyTool.jsx';

describe('deferred tools', () => {
  it('contains a failed chunk and allows a successful retry', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const load = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network unavailable'))
        .mockResolvedValue({ default: () => <h3>Recovered tool</h3> });
      const Tool = lazyTool(load);
      render(<Tool onCancel={vi.fn()} />);
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this tool');
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('heading', { name: 'Recovered tool' })).toBeInTheDocument();
    } finally {
      logger.mockRestore();
    }
  });
  it('shows a cancellable loading state and forwards props when the module resolves', async () => {
    let resolve;
    const loading = new Promise((done) => {
      resolve = done;
    });
    const Tool = lazyTool(() => loading);
    const onCancel = vi.fn();
    render(<Tool title="Ready tool" onCancel={onCancel} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ default: ({ title }) => <h3>{title}</h3> }));
    expect(screen.getByRole('heading', { name: 'Ready tool' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
