import { describe, expect, it, vi } from 'vitest';
import { ClaimLifecycle } from './claimLifecycle.js';

describe('ClaimLifecycle replacement actions', () => {
  it('applies the selected replacement and releases the queue', () => {
    const state = {
      gameOver: false,
      players: {
        p1: { id: 'p1', name: 'Alex', board: ['Old trope'], marked: [0], wagered: [0] },
      },
      calls: { p1: 'Old trope' },
      tropePool: ['Old trope'],
      acceptedTropes: ['Old trope'],
      acceptedTropeProposers: { 'Old trope': ['p1'] },
      acceptedCalls: { 'Old trope': [{ id: 'p1' }] },
      pendingReplacement: {
        byId: 'p1',
        oldText: 'Old trope',
        candidates: ['New trope'],
        affectedIds: ['p1'],
      },
      claimQueue: [],
    };
    const context = {
      getState: () => state,
      logActivity: vi.fn(),
      send: vi.fn(),
      emitState: vi.fn(),
      drainQueue: vi.fn(),
      formatPlayerName: (player) => player.name,
    };

    new ClaimLifecycle(context).handleReplacementAction('p1', { t: 'chooseReplacement', text: 'New trope' });

    expect(state.players.p1.board).toEqual(['New trope']);
    expect(state.players.p1.marked).toEqual([]);
    expect(state.players.p1.wagered).toEqual([]);
    expect(state.tropePool).toContain('New trope');
    expect(state.acceptedTropes).toEqual([]);
    expect(state.pendingReplacement).toBeNull();
    expect(state.callHistory.p1).toContainEqual(expect.objectContaining({ text: 'Old trope', status: 'replaced' }));
    expect(context.drainQueue).toHaveBeenCalledOnce();
  });
});
