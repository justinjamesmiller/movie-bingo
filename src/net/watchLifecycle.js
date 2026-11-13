import { getCompletedLines } from '../utils/bingoLines.js';

export function recordMarathonWatch(state) {
  if (!state.started) return;
  if (!state.marathon) state.marathon = { watches: [] };
  const watchNumber = state.marathon.watches.length + 1;
  const players = Object.values(state.players).map((player) => {
    const tropes = player.board.filter(
      (text, index) => player.marked.includes(index) && state.acceptedTropes.includes(text),
    ).length;
    const bingos = getCompletedLines(player.marked).length;
    const wagerHits = player.wagered.filter((index) => player.marked.includes(index)).length;
    const calls = state.callStats?.[player.id] || {};
    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      tropes,
      bingos,
      wagerHits,
      callsMade: calls.made || 0,
      correctCalls: calls.correct || 0,
    };
  });
  state.marathon.watches.push({ number: watchNumber, movie: state.movie, completedAt: Date.now(), players });
}

export class WatchLifecycle {
  constructor(context) {
    this.context = context;
  }

  start(hostId) {
    if (!this.context.isActiveHostId(hostId)) return;
    const state = this.context.getState();
    state.started = true;
    this.context.logActivity('🎬 The host started the game.');
    this.publishState();
  }

  reset(hostId, action) {
    if (!this.context.isActiveHostId(hostId)) return;
    const state = this.context.getState();
    this.context.clearClaimTimeout();
    state.pendingBoardRecovery = null;
    this.context.recordMarathonWatch(state);
    const safe = this.context.sanitizeGenreSelection(action.genres, action.subgenreSelections);
    state.genres = safe.genres;
    state.subgenreSelections = safe.subgenreSelections;
    if (typeof action.freeSpace === 'boolean') state.freeSpace = action.freeSpace;
    state.generalPercents = this.context.sanitizeGeneralPercents(state.genres, action.generalPercents);
    state.movie = action.movie || null;
    state.genrePercents = action.genrePercents || {};
    state.subgenrePercents = action.subgenrePercents || {};
    state.totalTropes = this.context.validateTotalTropes(action.totalTropes, state.totalTropes);
    const customTropes = this.context.sanitizeCustomTropes(action.customTropes);
    state.tropePool = Array.from(
      new Set([
        ...this.context.pickTropePool(
          state.genres,
          state.subgenreSelections,
          state.generalPercents,
          state.totalTropes,
          state.genrePercents,
          state.subgenrePercents,
        ),
        ...customTropes,
      ]),
    );
    for (const player of Object.values(state.players)) {
      player.board = this.context.buildPlayerBoard(state.tropePool, state.freeSpace);
      player.wagered = [];
      player.marked = state.freeSpace ? [this.context.centerIndex] : [];
    }
    Object.assign(state, {
      started: false,
      gameOver: false,
      pendingClaim: null,
      claimQueue: [],
      claimHistory: [],
      pendingJoinRequest: null,
      pendingProfileChanges: {},
      acceptedTropes: [],
      acceptedTropeProposers: {},
      acceptedCalls: {},
      calls: {},
      callStats: {},
      callHistory: {},
      superlativeStats: {},
      viewBatches: {},
      superlativeMilestones: {},
      bingoEvents: [],
      activityLog: [],
    });
    this.context.logActivity(
      state.marathon?.watches.length > 0
        ? `🏁 Watch ${state.marathon.watches.length} was added to the marathon standings.`
        : '🔄 The host reset the game.',
    );
    this.context.onEvent({ type: 'gameReset' });
    this.context.send({ t: 'gameReset' });
    this.publishState();
  }

  updateSessionLifetime(hostId, hours) {
    if (!this.context.isActiveHostId(hostId)) return;
    const state = this.context.getState();
    state.sessionLifetimeHours = this.context.validateSessionLifetime(hours)
      ? hours
      : this.context.defaultSessionLifetimeHours;
    state.sessionExtended = state.sessionLifetimeHours !== this.context.defaultSessionLifetimeHours;
    state.sessionExpiresAt = Date.now() + state.sessionLifetimeHours * 60 * 60 * 1000;
    this.publishState();
    this.context.onEvent({
      type: 'sessionLifetimeUpdated',
      extended: state.sessionExtended,
      hours: state.sessionLifetimeHours,
    });
  }

  updateMovie(hostId, movie) {
    if (!this.context.isActiveHostId(hostId)) return;
    const state = this.context.getState();
    const title = typeof movie?.title === 'string' ? movie.title.trim().slice(0, 120) : '';
    const themeSelection = this.context.sanitizeGenreSelection(movie?.genres, movie?.subgenreSelections);
    state.movie = title
      ? {
          title,
          year: movie.year || null,
          type: movie.type || null,
          poster: movie.poster || null,
          imdbID: movie.imdbID || null,
          director: movie.director || null,
          actors: movie.actors || null,
          genres: Array.isArray(movie.genres) ? movie.genres : [],
          unmapped: Array.isArray(movie.unmapped) ? movie.unmapped : [],
          subgenreSelections: Array.isArray(movie.subgenreSelections) ? themeSelection.subgenreSelections : [],
          themeGenres: Array.isArray(movie?.genres) ? themeSelection.genres : null,
          themeSubgenreSelections: Array.isArray(movie?.subgenreSelections) ? themeSelection.subgenreSelections : null,
        }
      : null;
    this.publishState();
  }

  end(hostId) {
    if (!this.context.isActiveHostId(hostId)) return;
    const state = this.context.getState();
    state.pendingBoardRecovery = null;
    if (!state.started || state.gameOver || state.pendingClaim) return;
    state.gameOver = true;
    state.claimQueue = [];
    this.context.logActivity('🏁 The game has ended.');
    this.context.send({ t: 'gameOverAnnounced' });
    this.context.clearSavedSession();
    this.context.onEvent({ type: 'gameOver' });
    this.publishState();
  }

  resume(hostId) {
    if (!this.context.isActiveHostId(hostId)) return;
    const state = this.context.getState();
    if (!state.started || !state.gameOver || state.pendingClaim) return;
    state.gameOver = false;
    this.context.logActivity('▶️ The game was resumed for extra tropes.');
    this.context.send({ t: 'gameResumed' });
    this.context.saveCurrentSession();
    this.context.onEvent({ type: 'gameResumed' });
    this.publishState();
  }

  publishState() {
    this.context.emitState();
    this.context.send({ t: 'state', state: this.context.getState() });
  }
}
