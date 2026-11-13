import { describe, expect, it } from 'vitest';
import { assessClaimVotes } from './claimVoting.js';

describe('claim voting rules', () => {
  it('counts votes and sets the strict-majority threshold', () => {
    expect(assessClaimVotes({ totalPlayers: 10, votes: { p1: true, p2: false, p3: true } })).toEqual({
      agree: 2,
      disagree: 1,
      votesIn: 3,
      needed: 6,
      majorityReached: false,
      impossible: false,
      allVoted: false,
      shouldResolve: false,
    });
  });

  it('resolves immediately when an approval majority is reached', () => {
    expect(assessClaimVotes({ totalPlayers: 3, votes: { p1: true, p2: true } })).toMatchObject({
      agree: 2,
      needed: 2,
      majorityReached: true,
      shouldResolve: true,
    });
  });

  it('resolves when the remaining possible votes cannot reach a majority', () => {
    expect(assessClaimVotes({ totalPlayers: 5, votes: { p1: false, p2: false, p3: false } })).toMatchObject({
      agree: 0,
      disagree: 3,
      needed: 3,
      impossible: true,
      allVoted: false,
      shouldResolve: true,
    });
  });

  it('resolves when every player has voted even if the group split', () => {
    expect(assessClaimVotes({ totalPlayers: 4, votes: { p1: true, p2: true, p3: false, p4: false } })).toMatchObject({
      agree: 2,
      disagree: 2,
      needed: 3,
      majorityReached: false,
      impossible: true,
      allVoted: true,
      shouldResolve: true,
    });
  });
});
