export class PlayerLifecycle {
  constructor(context) {
    this.context = context;
  }

  handleAction(playerId, action, player) {
    switch (action.t) {
      case 'changeName':
        return this.changeName(player, action.name);
      case 'changeAvatar':
        return this.changeAvatar(player, action.avatar);
      case 'proposeProfileChange':
        return this.proposeProfileChange(playerId, action.targetId, action.name, action.avatar);
      case 'respondToProfileChange':
        return this.respondToProfileChange(playerId, player, action.accept);
      case 'addHost':
        return this.addHost(playerId, action.targetId, player);
      case 'resignHost':
        return this.resignHost(playerId);
      default:
        return false;
    }
  }

  changeName(player, name) {
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 20) : '';
    if (!trimmed) return true;
    player.name = trimmed;
    this.publishState();
    return true;
  }

  changeAvatar(player, avatar) {
    if (!this.context.avatars.includes(avatar)) return true;
    player.avatar = avatar;
    this.publishState();
    return true;
  }

  proposeProfileChange(hostId, targetId, name, avatar) {
    if (!this.context.isActiveHostId(hostId)) return true;
    const state = this.context.getState();
    const target = state.players[targetId];
    const proposer = state.players[hostId];
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 20) : '';
    if (!target?.connected || !trimmed || !this.context.avatars.includes(avatar)) return true;
    state.pendingProfileChanges ||= {};
    state.pendingProfileChanges[target.id] = {
      name: trimmed,
      avatar,
      proposedBy: proposer.name,
      proposedByAvatar: proposer.avatar,
    };
    this.publishState();
    return true;
  }

  respondToProfileChange(playerId, player, accept) {
    const state = this.context.getState();
    const proposal = state.pendingProfileChanges?.[playerId];
    if (!proposal || !player) return true;
    if (accept) {
      player.name = proposal.name;
      player.avatar = proposal.avatar;
    }
    delete state.pendingProfileChanges[playerId];
    this.publishState();
    return true;
  }

  addHost(hostId, targetId, player) {
    if (!this.context.isActiveHostId(hostId)) return true;
    const state = this.context.getState();
    const target = state.players[targetId];
    if (!target?.connected || this.context.isHostId(targetId)) return true;
    state.hostIds = [...this.context.getHostIds(), targetId];
    this.context.logActivity(`👑 ${this.context.formatPlayerName(target)} is now a host.`);
    this.context.send({ t: 'hostAdded', to: targetId, byName: player.name, byAvatar: player.avatar });
    this.publishState();
    return true;
  }

  resignHost(playerId) {
    const state = this.context.getState();
    const hostIds = this.context.getHostIds();
    if (!this.context.isHostId(playerId) || hostIds.length < 2) return true;
    state.hostIds = hostIds.filter((id) => id !== playerId);
    this.context.logActivity(`👑 ${this.context.formatPlayerName(state.players[playerId])} resigned as host.`);
    this.publishState();
    return true;
  }

  publishState() {
    this.context.emitState();
    this.context.send({ t: 'state', state: this.context.getState() });
  }
}
