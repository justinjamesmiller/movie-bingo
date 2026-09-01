import { useState } from 'react';

const MAX_LENGTH = 60;
const MAX_COUNT = 20;

// Shared "add custom trope(s) before the game starts" editor used by both
// the Host card and the Reset modal -- builds a plain string[] passed
// straight through to hostGame/resetGame to be merged into the trope pool.
export default function CustomTropesEditor({ customTropes, onChange }) {
  const [draft, setDraft] = useState('');

  function handleAdd() {
    const trimmed = draft.trim().slice(0, MAX_LENGTH);
    if (!trimmed || customTropes.includes(trimmed) || customTropes.length >= MAX_COUNT) return;
    onChange([...customTropes, trimmed]);
    setDraft('');
  }

  function handleRemove(text) {
    onChange(customTropes.filter((t) => t !== text));
  }

  return (
    <div className="custom-tropes-editor">
      <label htmlFor="custom-trope-draft">Add your own custom trope(s) (optional)</label>
      <div className="custom-trope-add-row">
        <input
          id="custom-trope-draft"
          type="text"
          maxLength={MAX_LENGTH}
          placeholder="e.g. Someone quotes the tagline"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button type="button" className="btn" disabled={!draft.trim() || customTropes.length >= MAX_COUNT} onClick={handleAdd}>
          Add
        </button>
      </div>
      {customTropes.length > 0 && (
        <ul className="custom-trope-chip-list">
          {customTropes.map((text) => (
            <li key={text} className="custom-trope-chip">
              {text}
              <button type="button" className="custom-trope-chip-remove" onClick={() => handleRemove(text)} aria-label={`Remove ${text}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
