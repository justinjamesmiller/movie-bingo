import { useEffect, useState } from 'react';
import { areTropeDescriptionsLoaded, getTropeDescription, loadTropeDescriptions } from '../data/tropeDescriptions.js';

// Reads a trope explanation, triggering the lazy fetch if it hasn't happened
// yet. `ready` distinguishes "still loading" from "no description exists", so
// the UI doesn't flash a wrong message on the way in.
export function useTropeDescription(text) {
  const [state, setState] = useState(() => ({
    description: getTropeDescription(text),
    ready: areTropeDescriptionsLoaded(),
  }));

  useEffect(() => {
    if (areTropeDescriptionsLoaded()) {
      setState({ description: getTropeDescription(text), ready: true });
      return;
    }
    let cancelled = false;
    setState({ description: null, ready: false });
    loadTropeDescriptions()
      .then(() => {
        if (!cancelled) setState({ description: getTropeDescription(text), ready: true });
      })
      .catch(() => {
        if (!cancelled) setState({ description: null, ready: true });
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  return state;
}
