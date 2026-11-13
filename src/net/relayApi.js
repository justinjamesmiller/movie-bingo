export class RelayApi {
  constructor(getSupabase, onGameplayMode) {
    this.getSupabase = getSupabase;
    this.onGameplayMode = onGameplayMode;
  }

  async ensureAuthenticated() {
    const supabase = this.getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    let user = data?.session?.user;
    if (!user) {
      const result = await supabase.auth.signInAnonymously();
      if (result.error) throw result.error;
      user = result.data?.user;
    }
    if (!user?.id) throw new Error('Could not establish a secure game identity.');
    return user.id;
  }

  async request(operation, values = {}, options = {}) {
    const { data, error } = await this.getSupabase().functions.invoke('game-relay', {
      body: { operation, ...values },
      ...options,
    });
    if (error) {
      const failure = new Error(error.message || 'Could not reach the secure game relay.');
      failure.status = error.context?.status;
      failure.retryable = !error.context?.status || error.context.status >= 500;
      throw failure;
    }
    if (data?.error) throw new Error(data.error);
    this.onGameplayMode(data?.gameplayMode === 'server');
    return data;
  }
}
