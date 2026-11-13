import { assessClaimVotes } from '../utils/claimVoting.js';
import { formatPlayerName } from '../utils/playerName.js';

function approvedPlayersFromVotes(players, votes) {
  return Object.entries(votes)
    .filter(([, agree]) => agree)
    .map(([id]) => ({ id, name: players[id]?.name || 'Unknown player', avatar: players[id]?.avatar || '👤' }));
}

function formatNameList(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function approvalSentence(approvedBy) {
  const names = approvedBy.map((player) => formatPlayerName(player));
  return names.length > 0 ? ` Approved by ${formatNameList(names)}.` : '';
}

export class ClaimResolutionLifecycle {
  constructor(context) {
    this.context = context;
  }

  recordBingoEvents(previousBingoLines, claimId) {
    const state = this.context.getState();
    if (!Array.isArray(state.bingoEvents)) state.bingoEvents = [];
    const firstBingo = state.bingoEvents.length === 0;
    const firstBingoIds = [];
    for (const player of Object.values(state.players)) {
      const lines = this.context.getCompletedLines(player.marked);
      const newlyCompleted = lines.filter((line) => !previousBingoLines[player.id]?.has(line.join(',')));
      if (firstBingo && newlyCompleted.length > 0) firstBingoIds.push(player.id);
      for (let index = 0; index < newlyCompleted.length; index++) {
        const count = lines.length - newlyCompleted.length + index + 1;
        state.bingoEvents.push({
          id: `${claimId}-${player.id}-${count}`,
          playerId: player.id,
          playerName: player.name,
          playerAvatar: player.avatar,
          count,
          claimId,
          newLines: newlyCompleted.length,
          totalLines: lines.length,
          ts: Date.now(),
        });
      }
    }
    if (firstBingo) this.context.recordSuperlativeMilestone('firstBingo', firstBingoIds);
    state.bingoEvents = state.bingoEvents.slice(-50);
  }

  resolveClaim(claimId) {
    const state = this.context.getState();
    const pendingClaim = state.pendingClaim;
    if (!pendingClaim || pendingClaim.claimId !== claimId) return;
    if (pendingClaim.serverManaged && !this.context.isServerMode()) {
      return this.context.send({
        t: 'action',
        from: this.context.getPlayerId(),
        action: { t: 'settleClaim' },
      });
    }
    this.context.clearClaimTimeout();
    const approved = assessClaimVotes(pendingClaim).majorityReached;
    const approvedBy = approvedPlayersFromVotes(state.players, pendingClaim.votes);
    const disagreeRationaleCounts = approved ? {} : pendingClaim.disagreeRationaleCounts || {};
    const approvedByText = approvalSentence(approvedBy);
    const wagerFreedIds = [];
    const missedCalls = [];
    const previousBingoLines = Object.fromEntries(
      Object.values(state.players).map((player) => [
        player.id,
        new Set(this.context.getCompletedLines(player.marked).map((line) => line.join(','))),
      ]),
    );

    if (approved) {
      if (pendingClaim.kind === 'replace') {
        this.context.beginReplacement(pendingClaim, approvedByText);
      } else if (pendingClaim.kind === 'wagerChange') {
        const proposer = state.players[pendingClaim.byId];
        if (proposer) {
          proposer.wagered = proposer.wagered.filter((index) => !pendingClaim.remove.includes(index));
          for (const index of pendingClaim.add) {
            if (proposer.wagered.length >= 5) break;
            if (proposer.wagered.includes(index) || proposer.marked.includes(index)) continue;
            proposer.wagered.push(index);
          }
          this.context.logActivity(`🎯 ${formatPlayerName(proposer)} updated their wagers.${approvedByText}`);
        }
      } else if (pendingClaim.kind === 'reroll') {
        const proposer = state.players[pendingClaim.byId];
        if (proposer) {
          proposer.board = this.context.buildPlayerBoard(state.tropePool, state.freeSpace);
          proposer.marked = state.freeSpace ? [this.context.centerIndex] : [];
          this.context.markAlreadyAcceptedTropes(proposer.board, proposer.marked, state.acceptedTropes);
          if (proposer.wagered.length > 0) wagerFreedIds.push(proposer.id);
          proposer.wagered = [];
          this.context.logActivity(`🔀 ${formatPlayerName(proposer)} was dealt a fresh board.${approvedByText}`);
        }
      } else {
        for (const player of Object.values(state.players)) {
          const index = player.board.indexOf(pendingClaim.text);
          if (index === -1) continue;
          if (pendingClaim.kind === 'unmark') {
            const markedIndex = player.marked.indexOf(index);
            if (markedIndex !== -1) player.marked.splice(markedIndex, 1);
          } else if (!player.marked.includes(index)) {
            player.marked.push(index);
          }
        }
        if (pendingClaim.kind === 'unmark') {
          state.acceptedTropes = state.acceptedTropes.filter((text) => text !== pendingClaim.text);
          delete state.acceptedTropeProposers?.[pendingClaim.text];
          delete state.acceptedCalls?.[pendingClaim.text];
          this.context.logActivity(`↩️ "${pendingClaim.text}" was unmarked.${approvedByText}`);
        } else {
          const newlyAccepted = !state.acceptedTropes.includes(pendingClaim.text);
          if (newlyAccepted) {
            state.acceptedTropes.push(pendingClaim.text);
            const proposerIds = pendingClaim.proposedBy || [pendingClaim.byId];
            state.acceptedTropeProposers ||= {};
            state.acceptedTropeProposers[pendingClaim.text] = [...proposerIds];
            for (const proposerId of proposerIds) {
              const stats = this.context.superlativeStats(proposerId);
              stats.acceptedProposals = (stats.acceptedProposals || 0) + 1;
              if (stats.rejections > 0) stats.acceptedAfterRejection += 1;
            }
            for (const voter of approvedBy) {
              const stats = this.context.superlativeStats(voter.id);
              stats.approvalVotes += 1;
              if (!proposerIds.includes(voter.id)) stats.otherApprovalVotes = (stats.otherApprovalVotes || 0) + 1;
            }
            for (const player of Object.values(state.players)) {
              const stats = state.superlativeStats?.[player.id];
              if (stats?.rejections > 0 && player.board.includes(pendingClaim.text)) stats.marksAfterRejection += 1;
            }
            if (state.acceptedTropes.length === 1)
              this.context.recordSuperlativeMilestone('firstAccepted', proposerIds);
            const wagerHits = Object.values(state.players).filter((player) =>
              player.wagered.includes(player.board.indexOf(pendingClaim.text)),
            );
            this.context.recordSuperlativeMilestone(
              'firstWagerHit',
              wagerHits.map((player) => player.id),
            );
          }
          if (pendingClaim.custom) {
            if (!state.tropePool.includes(pendingClaim.text)) state.tropePool.push(pendingClaim.text);
            this.context.logActivity(`📝 "${pendingClaim.text}" was added as a new custom trope.${approvedByText}`);
          } else {
            this.context.logActivity(`✅ "${pendingClaim.text}" was marked as happened.${approvedByText}`);
          }
          for (const [playerId, calledText] of Object.entries(state.calls || {})) {
            if (calledText !== pendingClaim.text) {
              if (newlyAccepted) missedCalls.push({ playerId, text: calledText });
              continue;
            }
            this.context.finishCall(playerId, 'scored');
            state.callStats ||= {};
            state.callStats[playerId] = {
              ...state.callStats[playerId],
              correct: (state.callStats[playerId]?.correct || 0) + 1,
            };
            state.acceptedCalls ||= {};
            state.acceptedCalls[pendingClaim.text] ||= [];
            const caller = state.players[playerId];
            if (!state.acceptedCalls[pendingClaim.text].some((entry) => entry.id === playerId)) {
              state.acceptedCalls[pendingClaim.text].push({
                id: playerId,
                name: caller?.name || 'Unknown player',
                avatar: caller?.avatar || '👤',
              });
            }
            delete state.calls[playerId];
          }
          this.recordBingoEvents(previousBingoLines, pendingClaim.claimId);
        }
      }
    } else if (['mark', 'unmark', 'replace'].includes(pendingClaim.kind)) {
      for (const id of pendingClaim.proposedBy || [pendingClaim.byId])
        this.context.superlativeStats(id).rejections += 1;
      const proposers = (pendingClaim.proposedBy || [pendingClaim.byId]).map((id) =>
        formatPlayerName(state.players[id]),
      );
      const proposal =
        pendingClaim.kind === 'replace'
          ? `replacing "${pendingClaim.text}"`
          : pendingClaim.kind === 'unmark'
            ? `unmarking "${pendingClaim.text}"`
            : pendingClaim.custom
              ? `adding "${pendingClaim.text}" as a custom trope`
              : `"${pendingClaim.text}" as happened`;
      const reasons = Object.entries(disagreeRationaleCounts).map(([reason, count]) => `${reason} (${count})`);
      const reasonText = reasons.length ? ` Reasons: ${reasons.join(', ')}.` : ' No decline reasons were provided.';
      this.context.logActivity(
        `❌ ${formatNameList(proposers)} proposed ${proposal}, but it did not reach majority approval.${reasonText}`,
      );
    }

    state.pendingClaim = null;
    state.claimHistory ||= [];
    state.claimHistory.push({
      id: pendingClaim.claimId,
      text: pendingClaim.text,
      kind: pendingClaim.kind,
      approved,
      proposerIds: pendingClaim.proposedBy || [pendingClaim.byId],
      proposers: (pendingClaim.proposedBy || [pendingClaim.byId]).map((id) => ({
        id,
        name: state.players[id]?.name || 'Unknown player',
        avatar: state.players[id]?.avatar || '👤',
      })),
      sceneContexts: pendingClaim.sceneContexts || [],
      reasons: disagreeRationaleCounts,
      ts: Date.now(),
    });
    state.claimHistory = state.claimHistory.slice(-100);
    const sceneText = (pendingClaim.sceneContexts || [])
      .map((context) => [context.timestamp, context.note].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join(' | ');
    if (sceneText && state.activityLog?.length) state.activityLog.at(-1).text += ` Scene: ${sceneText}`;
    const payload = {
      text: pendingClaim.text,
      kind: pendingClaim.kind,
      custom: !!pendingClaim.custom,
      byId: pendingClaim.byId,
      approved,
      approvedBy,
      disagreeRationaleCounts,
      wagerFreedIds,
      missedCalls,
      proposedBy: pendingClaim.proposedBy || [pendingClaim.byId],
    };
    this.context.onEvent({
      type: 'claimResolved',
      ...payload,
      wagerFreed: wagerFreedIds.includes(this.context.getPlayerId()),
    });
    this.context.send({ t: 'resolved', ...payload });
    this.context.emitState();
    this.context.send({ t: 'state', state });
    this.context.drainQueue();
  }
}
