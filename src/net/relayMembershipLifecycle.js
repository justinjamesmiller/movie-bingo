export class RelayMembershipLifecycle {
  constructor(
    client,
    {
      isValidPlayerId,
      pickTropePool,
      buildPlayerBoard,
      centerIndex,
      defaultSessionLifetimeHours,
      randomAvatar,
      randomCode,
      markAlreadyAcceptedTropes,
      formatPlayerName,
    },
  ) {
    this.client = client;
    this.isValidPlayerId = isValidPlayerId;
    this.pickTropePool = pickTropePool;
    this.buildPlayerBoard = buildPlayerBoard;
    this.centerIndex = centerIndex;
    this.defaultSessionLifetimeHours = defaultSessionLifetimeHours;
    this.randomAvatar = randomAvatar;
    this.randomCode = randomCode;
    this.markAlreadyAcceptedTropes = markAlreadyAcceptedTropes;
    this.formatPlayerName = formatPlayerName;
  }

  initHostState(
    code,
    name,
    genres,
    subgenreSelections,
    freeSpace,
    generalPercents,
    totalTropes,
    customTropes = [],
    genrePercents = {},
    subgenrePercents = {},
    movie = null,
  ) {
    const client = this.client;
    const tropePool = Array.from(
      new Set([
        ...this.pickTropePool(
          genres,
          subgenreSelections,
          generalPercents,
          totalTropes,
          genrePercents,
          subgenrePercents,
        ),
        ...customTropes,
      ]),
    );
    const board = this.buildPlayerBoard(tropePool, freeSpace);
    const marked = freeSpace ? [this.centerIndex] : [];
    client.state = {
      code,
      rev: 0,
      serverRevision: 0,
      genres,
      subgenreSelections,
      freeSpace,
      generalPercents,
      genrePercents,
      subgenrePercents,
      totalTropes,
      tropePool,
      players: {
        [client.myId]: {
          id: client.myId,
          name,
          seat: 0,
          connected: true,
          avatar: this.randomAvatar(),
          board,
          wagered: [],
          marked,
        },
      },
      seatOrder: [client.myId],
      hostIds: [client.myId],
      started: false,
      gameOver: false,
      pendingClaim: null,
      claimQueue: [],
      claimHistory: [],
      pendingReplacement: null,
      pendingJoinRequest: null,
      pendingProfileChanges: {},
      acceptedTropes: [],
      acceptedTropeProposers: {},
      acceptedCalls: {},
      calls: {},
      callStats: {},
      callHistory: {},
      superlativeStats: {},
      superlativeMilestones: {},
      bingoEvents: [],
      activityLog: [],
      movie,
      marathon: { watches: [] },
      sessionExtended: false,
      sessionLifetimeHours: this.defaultSessionLifetimeHours,
      sessionExpiresAt: Date.now() + this.defaultSessionLifetimeHours * 60 * 60 * 1000,
    };
  }

  handleJoin(newId, name, forceNew) {
    const client = this.client;
    if (!client.state || !this.isValidPlayerId(newId)) return;
    if (Object.hasOwn(client.state.players, newId)) {
      if (!forceNew) client._handleRejoin(newId, name);
      return;
    }
    if (!forceNew) {
      const disconnectedPlayers = client.state.seatOrder
        .map((id) => client.state.players[id])
        .filter((player) => player && !player.connected);
      if (disconnectedPlayers.length > 0) {
        client._send({
          t: 'claimOffer',
          to: newId,
          options: disconnectedPlayers.map(({ id, name: playerName, avatar, seat }) => ({
            id,
            name: playerName,
            avatar,
            seat,
          })),
          allowNew: true,
        });
        return;
      }
    }
    const safeName = (typeof name === 'string' ? name.trim().slice(0, 20) : '') || 'Player';
    if (client.state.started) {
      if (client.state.pendingJoinRequest) {
        client._send({ t: 'joinRejected', to: newId, reason: 'busy' });
        return;
      }
      client.state.pendingJoinRequest = {
        id: newId,
        name: safeName,
        avatar: this.randomAvatar(Object.values(client.state.players).map((player) => player.avatar)),
      };
      client._send({ t: 'joinPending', to: newId });
      client._emitState();
      client._send({ t: 'state', state: client.state });
      return;
    }
    const board = this.buildPlayerBoard(client.state.tropePool, client.state.freeSpace);
    const marked = client.state.freeSpace ? [this.centerIndex] : [];
    this.markAlreadyAcceptedTropes(board, marked, client.state.acceptedTropes);
    const seat = client.state.seatOrder.length;
    client.state.players[newId] = {
      id: newId,
      name: safeName,
      seat,
      connected: true,
      avatar: this.randomAvatar(Object.values(client.state.players).map((player) => player.avatar)),
      board,
      wagered: [],
      marked,
    };
    client.state.seatOrder.push(newId);

    client._send({ t: 'welcome', to: newId, state: client.state });
    client._emitState();
    client._send({ t: 'state', state: client.state });
  }

  handleRejoin(id, name) {
    const client = this.client;
    const player =
      client.state && this.isValidPlayerId(id) && Object.hasOwn(client.state.players, id)
        ? client.state.players[id]
        : null;
    if (!player) {
      client._send({ t: 'rejoinFailed', to: id });
      return;
    }
    player.connected = true;
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 20) : '';
    if (trimmed) player.name = trimmed;
    if (!player.avatar) {
      player.avatar = this.randomAvatar(
        Object.values(client.state.players)
          .filter((entry) => entry.id !== id)
          .map((entry) => entry.avatar),
      );
    }

    client._send({ t: 'welcome', to: id, state: client.state });
    client._emitState();
    client._send({ t: 'state', state: client.state });
    client._drainClaimQueue();
  }

  handleHostAction(fromId, action) {
    const client = this.client;
    const state = client.state;
    if (action.t === 'kick') {
      if (!client._isActiveHostId(fromId)) return true;
      const targetId = action.targetId;
      if (targetId === fromId || !state.players[targetId]) return true;
      const removedName = this.formatPlayerName(state.players[targetId]);
      delete state.players[targetId];
      state.seatOrder = state.seatOrder.filter((id) => id !== targetId);
      state.hostIds = client._hostIds().filter((id) => id !== targetId);
      delete state.pendingProfileChanges?.[targetId];
      if (state.pendingClaim && state.pendingClaim.byId === targetId) {
        clearTimeout(client.claimTimeout);
        state.pendingClaim = null;
      }
      this.rotateCode(`🚪 ${removedName} was removed from the game.`);
      return true;
    }

    if (action.t === 'approveJoin') {
      if (!client._isActiveHostId(fromId)) return true;
      const request = state.pendingJoinRequest;
      if (!request) return true;
      const board = this.buildPlayerBoard(state.tropePool, state.freeSpace);
      const marked = state.freeSpace ? [this.centerIndex] : [];
      this.markAlreadyAcceptedTropes(board, marked, state.acceptedTropes);
      const seat = state.seatOrder.length;
      state.players[request.id] = {
        id: request.id,
        name: request.name,
        seat,
        connected: true,
        avatar: request.avatar || this.randomAvatar(Object.values(state.players).map((player) => player.avatar)),
        board,
        wagered: [],
        marked,
      };
      state.seatOrder.push(request.id);
      state.pendingJoinRequest = null;
      client._logActivity(`🙋 ${this.formatPlayerName(state.players[request.id])} joined mid-game.`);
      client._send({ t: 'welcome', to: request.id, state });
      client._emitState();
      client._send({ t: 'state', state: client.state });
      return true;
    }

    if (action.t === 'denyJoin') {
      if (!client._isActiveHostId(fromId)) return true;
      const request = state.pendingJoinRequest;
      if (!request) return true;
      state.pendingJoinRequest = null;
      client._send({ t: 'joinRejected', to: request.id, reason: 'denied' });
      if (action.rotateCode) {
        this.rotateCode(`🔒 The game code was rotated after denying ${this.formatPlayerName(request)}.`);
      } else {
        client._emitState();
        client._send({ t: 'state', state: client.state });
      }
      return true;
    }

    return false;
  }

  rotateCode(activityText) {
    const client = this.client;
    const state = client.state;
    const newCode = this.randomCode();
    state.code = newCode;
    if (activityText) client._logActivity(activityText);
    const migration = client._send({ t: 'migrate', newCode, state });
    client._emitState();
    client.onEvent({ type: 'codeChanged', code: newCode });
    migration.then((sent) => sent && client._migrateToCode(newCode).catch(() => {}));
  }
}
