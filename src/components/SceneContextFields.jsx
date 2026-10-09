import { useId } from 'react';

const MAX_TIMESTAMP_LENGTH = 120;

export function suppliedSceneContext(value) {
  return value.note.trim() || value.timestamp.trim()
    ? { note: value.note.trim(), timestamp: value.timestamp.trim() }
    : undefined;
}

export default function SceneContextFields({ value, onChange }) {
  const id = useId();
  return (
    <details className="scene-context-fields">
      <summary>Optional scene context</summary>
      <label htmlFor={`${id}-time`}>Movie timestamp</label>
      <input
        id={`${id}-time`}
        type="text"
        maxLength={MAX_TIMESTAMP_LENGTH}
        placeholder="e.g. 12:34, near the end, after the credits"
        value={value.timestamp}
        onChange={(event) => onChange({ ...value, timestamp: event.target.value })}
      />
      <label htmlFor={`${id}-note`}>Scene note</label>
      <textarea
        id={`${id}-note`}
        rows={2}
        maxLength={240}
        placeholder="During the kitchen scene"
        value={value.note}
        onChange={(event) => onChange({ ...value, note: event.target.value })}
      />
    </details>
  );
}

export function SceneContextSummary({ contexts = [] }) {
  return (
    <section className="claim-scene-context scene-context-summary">
      <h4>Original proposal context</h4>
      {contexts.length ? (
        contexts.map((context, index) => (
          <div key={`${context.playerId || context.playerName || 'proposal'}-${index}`}>
            {context.playerName && <strong>{context.playerName}</strong>}
            <p>
              <strong>Movie timestamp:</strong> {context.timestamp || 'Not provided'}
            </p>
            <p>
              <strong>Scene note:</strong> {context.note || 'Not provided'}
            </p>
          </div>
        ))
      ) : (
        <p className="hint">No scene context was recorded with the original proposal.</p>
      )}
    </section>
  );
}
