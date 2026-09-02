import { useTropeDescription } from '../hooks/useTropeDescription.js';

// Explains what a trope actually means before the player puts it to the group,
// so everyone is voting on the same interpretation.
export default function TropeInfoModal({ text, marked, onConfirm, onCancel, onProposeSwap }) {
  const { description, ready } = useTropeDescription(text);

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>{marked ? 'Undo this space?' : 'Claim this trope?'}</h3>
        <p className="claim-text">{text}</p>
        {!ready ? (
          <p className="hint">Loading the explanation…</p>
        ) : description ? (
          <>
            <p className="trope-description">{description.what}</p>
            <p className="hint">
              <strong>For example:</strong> {description.example}
            </p>
          </>
        ) : (
          <p className="hint">No explanation written for this one yet — go with the group&apos;s reading of it.</p>
        )}
        <p className="hint">
          {marked
            ? 'The group votes on whether to undo this. A majority has to agree.'
            : 'The group votes on whether this really happened. A majority has to agree.'}
        </p>
        <div className="claim-vote-buttons">
          <button className="btn agree" onClick={onConfirm}>
            {marked ? '↩️ Ask to undo it' : '✅ Submit to the group'}
          </button>
          <button className="btn disagree" onClick={onCancel}>
            Cancel
          </button>
        </div>
        {onProposeSwap && (
          <button className="btn secondary-action" onClick={onProposeSwap}>
            🔁 Propose swapping this trope out
          </button>
        )}
      </div>
    </div>
  );
}
