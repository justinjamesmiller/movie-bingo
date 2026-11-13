export function assessClaimVotes(pendingClaim) {
  const votes = pendingClaim?.votes || {};
  const totalPlayers = pendingClaim?.totalPlayers || 0;
  const agree = Object.values(votes).filter(Boolean).length;
  const votesIn = Object.keys(votes).length;
  const disagree = votesIn - agree;
  const needed = Math.floor(totalPlayers / 2) + 1;
  const majorityReached = agree >= needed;
  const impossible = disagree > totalPlayers - needed;
  const allVoted = votesIn >= totalPlayers;

  return {
    agree,
    disagree,
    votesIn,
    needed,
    majorityReached,
    impossible,
    allVoted,
    shouldResolve: majorityReached || impossible || allVoted,
  };
}
