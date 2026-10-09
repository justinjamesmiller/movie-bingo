import { reportSecurityEvent } from './securityEvents.js';

export function createPhaseTimings(report = reportSecurityEvent, random = Math.random) {
  const sampled = random() < 0.05;
  let operation = 'invalid';
  return {
    setOperation(value) {
      operation = value;
    },
    async measure(phase, work) {
      const start = performance.now();
      let status = 200;
      try {
        return await work();
      } catch (error) {
        status = 500;
        throw error;
      } finally {
        if (sampled)
          report('relay_phase_timing', operation, status, { phase, elapsedMs: Math.round(performance.now() - start) });
      }
    },
  };
}
