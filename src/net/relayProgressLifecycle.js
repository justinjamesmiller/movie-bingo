export class RelayProgressLifecycle {
  constructor(client, { activityLogLimit }) {
    this.client = client;
    this.activityLogLimit = activityLogLimit;
  }

  logActivity(text) {
    const state = this.client.state;
    if (!Array.isArray(state.activityLog)) state.activityLog = [];
    state.activityLog.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, ts: Date.now() });
    state.activityLog = state.activityLog.slice(-this.activityLogLimit);
  }

  superlativeStats(playerId) {
    const state = this.client.state;
    state.superlativeStats ||= {};
    state.superlativeStats[playerId] ||= {
      views: 0,
      viewedTropes: [],
      submissions: 0,
      rejections: 0,
      approvalVotes: 0,
      otherApprovalVotes: 0,
      acceptedProposals: 0,
      acceptedAfterRejection: 0,
      marksAfterRejection: 0,
    };
    return state.superlativeStats[playerId];
  }

  recordSuperlativeMilestone(kind, playerIds) {
    const milestones = (this.client.state.superlativeMilestones ||= {});
    if (Object.values(milestones).some((milestone) => milestone[kind])) return;
    const ids = [...new Set(playerIds)];
    for (const id of ids) {
      milestones[id] ||= {};
      milestones[id][kind] = true;
      milestones[id][`${kind}Tied`] = ids.length > 1;
    }
  }
}
