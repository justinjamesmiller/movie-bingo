export class RelayJoinLifecycle {
  constructor(client, options) {
    this.client = client;
    this.options = options;
  }

  async hostGame(
    name,
    genres,
    subgenreSelections,
    freeSpace,
    generalPercents,
    totalTropes,
    customTropes,
    genrePercents,
    subgenrePercents,
    movie,
    hostRecoveryPassword = '',
  ) {
    const client = this.client;
    const {
      sanitizeGenreSelection,
      sanitizeGeneralPercents,
      sanitizeCustomTropes,
      isValidTotalTropes,
      defaultTotalTropes,
      randomCode,
    } = this.options;
    const trimmedName = (name || '').trim();
    if (!trimmedName) throw new Error('Please enter your name.');
    const safe = sanitizeGenreSelection(genres, subgenreSelections);
    const useFreeSpace = !!freeSpace;
    const safeGeneralPercents = sanitizeGeneralPercents(safe.genres, generalPercents);
    const safeTotalTropes = isValidTotalTropes(totalTropes) ? totalTropes : defaultTotalTropes;
    const safeCustomTropes = sanitizeCustomTropes(customTropes);
    const code = randomCode();
    await client._ensureAuthenticated();
    client.code = code;
    client._initHostState(
      code,
      trimmedName,
      safe.genres,
      safe.subgenreSelections,
      useFreeSpace,
      safeGeneralPercents,
      safeTotalTropes,
      safeCustomTropes,
      genrePercents,
      subgenrePercents,
      movie,
    );
    await client._relayRequest('create', {
      code,
      playerId: client.myId,
      state: client.state,
      hostRecoveryPassword: hostRecoveryPassword || undefined,
    });
    client._saveSession(code, trimmedName);
    await client._connectChannel(code);
    client._emitState();
    return code;
  }

  async joinGame(code, name, hostRecoveryPassword = '') {
    const client = this.client;
    const { isValidReplicatedState } = this.options;
    const trimmedName = (name || '').trim();
    if (!trimmedName) return Promise.reject(new Error('Please enter your name.'));
    const normalized = code.trim().toUpperCase();
    await client._ensureAuthenticated();
    const membership = await client._relayRequest('join', {
      code: normalized,
      requestedPlayerId: client.myId,
      newSeat: true,
      name: trimmedName,
      hostRecoveryPassword: hostRecoveryPassword || undefined,
    });
    client.myId = membership.playerId;
    client.code = normalized;
    if (membership.isHost && isValidReplicatedState(membership.state)) {
      client.state = membership.state;
      const me = client.state.players[client.myId];
      me.connected = true;
      me.name = trimmedName;
      await client._connectChannel(normalized);
      client._saveSession(normalized, trimmedName);
      client._emitState();
      await client._send({ t: 'state', state: client.state });
      return { needsChoice: false };
    }
    if (membership.needsApproval || membership.status === 'pending') {
      client._pendingJoin = { awaitingApproval: true, name: trimmedName };
      client._watchJoinApproval(normalized, client.myId, trimmedName).catch(() => {});
      return { needsApproval: true };
    }
    client._pendingJoin = { name: trimmedName };
    try {
      await client._connectChannel(normalized);
    } catch (error) {
      client._pendingJoin = null;
      throw error;
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client._pendingJoin = null;
        reject(
          new Error(
            'No response from a host with that code. Double-check the code and that the host is still connected.',
          ),
        );
      }, this.options.joinTimeoutMs);

      client._pendingJoin = {
        name: trimmedName,
        resolve: () => {
          clearTimeout(timeout);
          client._pendingJoin = null;
          client._saveSession(normalized, trimmedName);
          resolve({ needsChoice: false });
        },
        reject: (error) => {
          clearTimeout(timeout);
          client._pendingJoin = null;
          reject(error);
        },
        choice: (options, allowNew) => {
          clearTimeout(timeout);
          resolve({ needsChoice: true, options, allowNew, name: trimmedName });
        },
        pending: () => {
          clearTimeout(timeout);
          client._pendingJoin.awaitingApproval = true;
          resolve({ needsApproval: true });
        },
      };
      client._send({ t: 'join', from: client.myId, name: trimmedName });
    });
  }

  async watchJoinApproval(code, playerId, name) {
    const client = this.client;
    const { joinTimeoutMs, isValidReplicatedState } = this.options;
    const expiresAt = Date.now() + joinTimeoutMs;
    while (!client._destroyed && client._pendingJoin?.awaitingApproval && Date.now() < expiresAt) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (client._destroyed || !client._pendingJoin?.awaitingApproval) return;
      try {
        const result = await client._relayRequest('join-status', { code, playerId });
        if (result.status === 'revoked') {
          client._pendingJoin = null;
          client.onEvent({ type: 'joinDenied', reason: 'The host declined your request to join.' });
          client.destroy();
          return;
        }
        if (result.status !== 'active' || !isValidReplicatedState(result.state)) continue;
        client.code = code;
        client.myId = playerId;
        client.state = result.state;
        await client._connectChannel(code);
        client._saveSession(code, name);
        client._emitState();
        client._pendingJoin = null;
        client.onEvent({ type: 'joinApproved' });
        return;
      } catch (error) {
        if (Date.now() >= expiresAt) {
          client.onEvent({ type: 'joinDenied', reason: error.message || 'The host did not respond in time.' });
          client.destroy();
          return;
        }
      }
    }
    if (!client._destroyed && client._pendingJoin?.awaitingApproval) {
      client.onEvent({ type: 'joinDenied', reason: 'The host did not respond in time.' });
      client.destroy();
    }
  }

  async confirmNewJoin(name) {
    const client = this.client;
    const trimmedName = (name || '').trim();
    const membership = await client._relayRequest('join', { code: client.code, newSeat: true });
    client.myId = membership.playerId;
    if (membership.needsApproval || membership.status === 'pending') {
      client._pendingJoin = { awaitingApproval: true, name: trimmedName };
      client._watchJoinApproval(client.code, client.myId, trimmedName).catch(() => {});
      return { needsApproval: true };
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client._pendingJoin = null;
        reject(new Error('No response from the host.'));
      }, this.options.joinTimeoutMs);
      client._pendingJoin = {
        name: trimmedName,
        resolve: () => {
          clearTimeout(timeout);
          client._pendingJoin = null;
          client._saveSession(client.code, trimmedName);
          resolve({ needsApproval: false });
        },
        reject: (error) => {
          clearTimeout(timeout);
          client._pendingJoin = null;
          reject(error);
        },
        pending: () => {
          clearTimeout(timeout);
          client._pendingJoin.awaitingApproval = true;
          resolve({ needsApproval: true });
        },
      };
      client._send({ t: 'join', from: client.myId, name: trimmedName, forceNew: true });
    });
  }

  async claimDisconnectedSeat(seatId, name) {
    const client = this.client;
    const trimmedName = (name || '').trim();
    const code = client.code;
    await client._relayRequest('claim-seat', { code, playerId: client.myId, seatId });
    if (client.channel) {
      client.supabase.removeChannel(client.channel);
      client.channel = null;
    }
    client.myId = seatId;
    return new Promise((resolve, reject) => {
      client
        ._connectChannel(code)
        .then(() => {
          const timeout = setTimeout(() => {
            client._pendingJoin = null;
            reject(new Error('No response from that game. It may have ended.'));
          }, this.options.joinTimeoutMs);
          client._pendingJoin = {
            resolve: () => {
              clearTimeout(timeout);
              client._pendingJoin = null;
              client._saveSession(code, trimmedName);
              resolve();
            },
            reject: (error) => {
              clearTimeout(timeout);
              client._pendingJoin = null;
              reject(error);
            },
          };
          client._send({ t: 'rejoin', from: seatId, name: trimmedName });
        })
        .catch(reject);
    });
  }

  async rejoinGame() {
    const client = this.client;
    const { getSavedSession, clearSavedSession, recoveryRequestTimeoutMs, isValidReplicatedState } = this.options;
    const saved = getSavedSession();
    if (!saved) return Promise.reject(new Error('No previous session found to reconnect to.'));
    await client._ensureAuthenticated();
    let membership;
    try {
      membership = await client._relayRequest(
        'join',
        { code: saved.code, requestedPlayerId: saved.myId },
        { timeout: recoveryRequestTimeoutMs },
      );
    } catch (error) {
      if (error.status === 404 || error.status === 410) {
        clearSavedSession();
        throw new Error(error.status === 410 ? 'That game has ended.' : 'No game was found with that code.');
      }
      throw error;
    }
    if (membership.playerId !== saved.myId) throw new Error('This browser is not authorized to reclaim that seat.');
    client.myId = saved.myId;
    client.code = saved.code;
    if (membership.status === 'active' && isValidReplicatedState(membership.state)) {
      client.state = membership.state;
      const me = client.state.players[client.myId];
      if (!me) throw new Error('That player seat is no longer available.');
      const noOtherConnectedPlayers = Object.values(client.state.players).every(
        (player) => player.id === client.myId || !player.connected,
      );
      me.connected = true;
      await client._connectChannel(saved.code);
      client._saveSession(saved.code, me.name);
      client._emitState();
      client._announceSelf();
      if (membership.isHost && noOtherConnectedPlayers) client.onEvent({ type: 'gameRestored' });
      return;
    }
    return new Promise((resolve, reject) => {
      client
        ._connectChannel(saved.code)
        .then(() => {
          const timeout = setTimeout(() => {
            client._pendingJoin = null;
            reject(new Error('Could not reconnect to the game. Your saved seat is preserved; please try again.'));
          }, this.options.joinTimeoutMs);

          client._pendingJoin = {
            resolve: () => {
              clearTimeout(timeout);
              client._pendingJoin = null;
              client._saveSession(saved.code, saved.name);
              resolve();
            },
            reject: (error) => {
              clearTimeout(timeout);
              client._pendingJoin = null;
              reject(error);
            },
          };
          client._send({ t: 'rejoin', from: client.myId, name: saved.name });
        })
        .catch(reject);
    });
  }
}
