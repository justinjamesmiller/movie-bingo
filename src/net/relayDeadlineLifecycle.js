export class RelayDeadlineLifecycle {
  constructor(client, { maxTimerDelayMs, clearSavedSession }) {
    this.client = client;
    this.maxTimerDelayMs = maxTimerDelayMs;
    this.clearSavedSession = clearSavedSession;
  }

  scheduleBoardRecovery() {
    const client = this.client;
    clearTimeout(client._boardRecoveryTimer);
    const recovery = client.state?.pendingBoardRecovery;
    if (!recovery) return;
    client._boardRecoveryTimer = setTimeout(
      () => {
        if (client._serverGameplayEnabled) client._dispatch({ t: 'settleClaim' });
        else if (client._currentHostId() === client.myId) client._completeBoardRecovery();
      },
      Math.max(0, recovery.expiresAt - Date.now()),
    );
  }

  scheduleSessionExpiry() {
    const client = this.client;
    clearTimeout(client._sessionExpiryTimer);
    const expiresAt = client.state?.sessionExpiresAt;
    if (!expiresAt) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      this.expireSession();
      return;
    }
    client._sessionExpiryTimer = setTimeout(
      () => {
        if (delay > this.maxTimerDelayMs) {
          this.scheduleSessionExpiry();
          return;
        }
        this.expireSession();
      },
      Math.min(delay, this.maxTimerDelayMs),
    );
  }

  scheduleServerManagedClaim() {
    const client = this.client;
    if (!client.state?.pendingClaim?.serverManaged) return;
    clearTimeout(client.claimTimeout);
    const claim = client.state.pendingClaim;
    client.claimTimeout = setTimeout(
      () => client._resolveClaim(claim.claimId),
      Math.max(0, claim.expiresAt - Date.now()),
    );
  }

  expireSession() {
    const client = this.client;
    this.clearSavedSession();
    client.onEvent({ type: 'sessionExpired' });
    client.destroy();
  }
}
