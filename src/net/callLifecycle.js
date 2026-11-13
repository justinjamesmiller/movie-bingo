export class CallLifecycle {
  constructor(context) {
    this.context = context;
  }

  finishCall(playerId, status) {
    const state = this.context.getState();
    const text = state.calls?.[playerId];
    if (!text) return;
    state.callHistory ||= {};
    const history = (state.callHistory[playerId] ||= []);
    const entry = history.findLast((call) => call.status === 'active' && call.text === text);
    if (entry) entry.status = status;
    else history.push({ id: `${playerId}-${Date.now()}-legacy`, text, status });
  }

  handleAction(playerId, action, player) {
    const state = this.context.getState();
    if (action.t !== 'toggleCall') return false;
    if (!state.started || state.gameOver || typeof action.text !== 'string') return true;
    if (!player.board.includes(action.text) || state.acceptedTropes.includes(action.text)) return true;
    state.calls ||= {};
    state.callStats ||= {};
    if (state.calls[playerId] === action.text) {
      this.finishCall(playerId, 'withdrawn');
      delete state.calls[playerId];
    } else {
      this.finishCall(playerId, 'changed');
      state.calls[playerId] = action.text;
      state.callStats[playerId] = { ...state.callStats[playerId], made: (state.callStats[playerId]?.made || 0) + 1 };
      state.callHistory ||= {};
      state.callHistory[playerId] ||= [];
      state.callHistory[playerId].push({
        id: `${playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: action.text,
        status: 'active',
      });
    }
    this.context.emitState();
    this.context.send({ t: 'state', state });
    return true;
  }
}
