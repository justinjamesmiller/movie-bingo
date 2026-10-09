import { describe, expect, it, vi } from 'vitest';
import { createPhaseTimings } from './performance.js';

describe('sampled request timings', () => {
  it('records phase duration and preserves successful results', async () => {
    const report = vi.fn();
    const timing = createPhaseTimings(report, () => 0);
    timing.setOperation('publish');
    expect(await timing.measure('commit', async () => 'saved')).toBe('saved');
    expect(report).toHaveBeenCalledWith('relay_phase_timing', 'publish', 200, {
      phase: 'commit',
      elapsedMs: expect.any(Number),
    });
  });
  it('avoids logs for unsampled requests and preserves failures', async () => {
    const report = vi.fn();
    const timing = createPhaseTimings(report, () => 1);
    await expect(
      timing.measure('broadcast', async () => {
        throw new Error('failure');
      }),
    ).rejects.toThrow('failure');
    expect(report).not.toHaveBeenCalled();
  });
});
