export class BoardRecoveryLifecycle {
  constructor(context) {
    this.context = context;
  }

  publishState() {
    this.context.emitState();
    this.context.send({ t: 'state', state: this.context.getState() });
  }

  requestBoardRecovery(hostId, sourceId, targetId, timeoutSeconds) {
    const state = this.context.getState();
    if (!Object.hasOwn(state.players, sourceId) || !Object.hasOwn(state.players, targetId)) return;
    const target = state.players[targetId];
    if (
      !this.context.isActiveHostId(hostId) ||
      ![0, 10, 30, 300].includes(timeoutSeconds) ||
      !state.started ||
      state.gameOver ||
      state.pendingClaim ||
      state.pendingReplacement ||
      state.claimQueue?.length ||
      state.pendingBoardRecovery ||
      state.pendingJoinRequest ||
      !target?.connected ||
      sourceId === targetId ||
      this.context.isHostId(sourceId) ||
      state.pendingProfileChanges?.[sourceId] ||
      state.pendingProfileChanges?.[targetId]
    )
      return;
    const createdAt = Date.now();
    state.pendingBoardRecovery = {
      id: `${state.code}-recovery-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
      byId: hostId,
      sourceId,
      targetId,
      expiresAt: createdAt + timeoutSeconds * 1000,
    };
    if (timeoutSeconds === 0) this.completeBoardRecovery();
    else this.publishState();
  }

  respondToBoardRecovery(playerId, requestId) {
    const state = this.context.getState();
    const recovery = state.pendingBoardRecovery;
    if (!recovery || recovery.sourceId !== playerId || recovery.id !== requestId || recovery.expiresAt <= Date.now())
      return;
    state.pendingBoardRecovery = null;
    this.context.logActivity(
      `${this.context.formatPlayerName(state.players[playerId])} confirmed they are still playing; recovery cancelled.`,
    );
    this.publishState();
  }

  cancelBoardRecovery(hostId, requestId) {
    const state = this.context.getState();
    if (!this.context.isActiveHostId(hostId) || state.pendingBoardRecovery?.id !== requestId) return;
    state.pendingBoardRecovery = null;
    this.publishState();
  }

  completeBoardRecovery() {
    const state = this.context.getState();
    const recovery = state?.pendingBoardRecovery;
    if (!recovery || recovery.expiresAt > Date.now()) return;
    state.pendingBoardRecovery = null;
    const source = state.players[recovery.sourceId];
    const target = state.players[recovery.targetId];
    if (
      !source ||
      !target?.connected ||
      !this.context.isHostId(recovery.byId) ||
      this.context.isHostId(source.id) ||
      state.gameOver ||
      !state.started ||
      state.pendingClaim ||
      state.pendingReplacement ||
      state.claimQueue?.length ||
      state.pendingProfileChanges?.[source.id] ||
      state.pendingProfileChanges?.[target.id]
    ) {
      this.context.logActivity('Player recovery cancelled because a required seat or host is no longer available.');
      this.publishState();
      return;
    }

    for (const key of ['calls', 'callStats', 'callHistory', 'superlativeStats', 'superlativeMilestones']) {
      if (state[key]) delete state[key][target.id];
    }
    for (const callers of Object.values(state.acceptedCalls || {})) {
      for (let index = callers.length - 1; index >= 0; index--) {
        if (callers[index].id === target.id) callers.splice(index, 1);
      }
    }
    for (const proposers of Object.values(state.acceptedTropeProposers || {})) {
      for (let index = proposers.length - 1; index >= 0; index--) {
        if (proposers[index] === target.id) proposers.splice(index, 1);
      }
    }
    state.bingoEvents = (state.bingoEvents || []).filter((event) => event.playerId !== target.id);
    for (const watch of state.marathon?.watches || []) {
      watch.players = watch.players
        .filter((player) => player.id !== target.id)
        .map((player) => (player.id === source.id ? { ...player, id: target.id } : player));
    }
    state.lastBoardRecovery = { id: recovery.id, sourceId: source.id, targetId: target.id };
    this.restoreDisconnectedBoard(recovery.byId, target.id, source.id, true);
  }

  restoreDisconnectedBoard(hostId, targetId, sourceId, approvedRecovery = false) {
    const state = this.context.getState();
    const source = state.players[sourceId];
    const target = state.players[targetId];
    if (
      (!this.context.isActiveHostId(hostId) && !(approvedRecovery && this.context.isHostId(hostId))) ||
      !state.started ||
      state.gameOver ||
      state.pendingClaim ||
      state.pendingReplacement ||
      state.claimQueue?.length ||
      !source ||
      !target ||
      sourceId === targetId ||
      (!approvedRecovery && source.connected) ||
      (!approvedRecovery && this.context.hasPendingDisconnect(sourceId)) ||
      target.connected !== true ||
      this.context.isHostId(sourceId) ||
      state.pendingProfileChanges?.[sourceId] ||
      state.pendingProfileChanges?.[targetId]
    )
      return;

    target.board = [...source.board];
    target.marked = [...source.marked];
    target.wagered = [...source.wagered];
    if (approvedRecovery) {
      target.name = source.name;
      target.avatar = source.avatar;
    }

    state.calls ||= {};
    this.context.finishCall(targetId, 'changed');
    if (state.calls[sourceId]) state.calls[targetId] = state.calls[sourceId];
    else delete state.calls[targetId];
    delete state.calls[sourceId];
    state.callHistory ||= {};
    state.callHistory[targetId] = [...(state.callHistory[targetId] || []), ...(state.callHistory[sourceId] || [])];
    delete state.callHistory[sourceId];

    state.callStats ||= {};
    const oldCallStats = state.callStats[sourceId];
    const currentCallStats = state.callStats[targetId] || {};
    if (oldCallStats) {
      state.callStats[targetId] = {
        made: (currentCallStats.made || 0) + (oldCallStats.made || 0),
        correct: (currentCallStats.correct || 0) + (oldCallStats.correct || 0),
      };
    }
    delete state.callStats[sourceId];

    state.superlativeStats ||= {};
    const oldStats = state.superlativeStats[sourceId];
    const currentStats = state.superlativeStats[targetId];
    if (oldStats) {
      const mergedStats = { ...oldStats, ...currentStats };
      for (const key of Object.keys(oldStats)) {
        if (key !== 'viewedTropes' && typeof oldStats[key] === 'number') {
          mergedStats[key] = (oldStats[key] || 0) + (currentStats?.[key] || 0);
        }
      }
      mergedStats.viewedTropes = [
        ...new Set([...(oldStats.viewedTropes || []), ...(currentStats?.viewedTropes || [])]),
      ];
      state.superlativeStats[targetId] = mergedStats;
    }
    delete state.superlativeStats[sourceId];

    state.superlativeMilestones ||= {};
    if (state.superlativeMilestones[sourceId]) {
      state.superlativeMilestones[targetId] = {
        ...state.superlativeMilestones[sourceId],
        ...state.superlativeMilestones[targetId],
      };
    }
    delete state.superlativeMilestones[sourceId];

    for (const proposers of Object.values(state.acceptedTropeProposers || {})) {
      for (let index = 0; index < proposers.length; index++) {
        if (proposers[index] === sourceId) proposers[index] = targetId;
      }
    }
    for (const callers of Object.values(state.acceptedCalls || {})) {
      const oldCaller = callers.find((caller) => caller.id === sourceId);
      if (oldCaller && !callers.some((caller) => caller.id === targetId)) {
        callers.push({ ...oldCaller, id: targetId, name: target.name, avatar: target.avatar });
      }
      for (let index = callers.length - 1; index >= 0; index--) {
        if (callers[index].id === sourceId) callers.splice(index, 1);
      }
    }
    for (const event of state.bingoEvents || []) {
      if (event.playerId === sourceId) event.playerId = targetId;
    }
    for (const entry of state.claimHistory || []) {
      entry.proposerIds = (entry.proposerIds || []).map((id) => (id === sourceId ? targetId : id));
      entry.proposerIds = [...new Set(entry.proposerIds)];
      for (const proposer of entry.proposers || []) {
        if (proposer.id === sourceId)
          Object.assign(proposer, { id: targetId, name: target.name, avatar: target.avatar });
      }
      for (const context of entry.sceneContexts || []) {
        if (context.playerId === sourceId) context.playerId = targetId;
      }
    }

    delete state.players[sourceId];
    this.context.clearPendingDisconnect(sourceId);
    state.seatOrder = state.seatOrder.filter((id) => id !== sourceId);
    this.context.logActivity(
      `🔄 ${this.context.formatPlayerName(target)} recovered the player seat from ${this.context.formatPlayerName(source)}.`,
    );
    this.publishState();
  }
}
