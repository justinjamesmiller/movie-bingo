import { useId } from 'react';

export function validSceneContext(value) {
  return !value.timestamp || /^(?:\d{1,2}:[0-5]\d|\d{1,3}):[0-5]\d$/.test(value.timestamp.trim());
}

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
        inputMode="numeric"
        maxLength={16}
        placeholder="12:34 or 1:12:34"
        value={value.timestamp}
        onChange={(event) => onChange({ ...value, timestamp: event.target.value })}
      />
      {!validSceneContext(value) && (
        <p className="hint" role="alert">
          Use M:SS or H:MM:SS.
        </p>
      )}
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
