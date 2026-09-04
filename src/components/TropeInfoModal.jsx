import { useTropeDescription } from '../hooks/useTropeDescription.js';
import ModalShell from './ModalShell.jsx';

// Explains what a trope actually means before the player puts it to the group,
// so everyone is voting on the same interpretation.
export default function TropeInfoModal({
  text,
  marked,
  title,
  actionHint,
  confirmLabel,
  onConfirm,
  onCancel,
  onProposeSwap,
  playerCount = 2,
}) {
  const isSolo = playerCount === 1;
  const { description, ready } = useTropeDescription(text);
  const heading = title || (marked ? 'Undo this space?' : 'Claim this trope?');
  const hint =
    actionHint ||
    (marked
      ? isSolo
        ? 'This removes the mark from your board.'
        : 'The group votes on whether to undo this. A majority has to agree.'
      : isSolo
        ? 'This marks the trope as happened on your board.'
        : 'The group votes on whether this really happened. A majority has to agree.');
  const primaryLabel =
    confirmLabel ||
    (marked ? (isSolo ? '↩️ Undo it' : '↩️ Ask to undo it') : isSolo ? '✅ Submit' : '✅ Submit to the group');

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content">
        <h3>{heading}</h3>
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
          <p className="hint">
            No explanation written for this one yet — go with {isSolo ? 'your' : 'the group&apos;s'} reading of it.
          </p>
        )}
        <p className="hint">{hint}</p>
        <div className="claim-vote-buttons">
          {onConfirm && (
            <button className="btn agree" onClick={onConfirm}>
              {primaryLabel}
            </button>
          )}
          <button className="btn disagree" onClick={onCancel}>
            {onConfirm ? 'Cancel' : 'Close'}
          </button>
        </div>
        {onProposeSwap && (
          <button className="btn secondary-action" onClick={onProposeSwap}>
            🔁 {isSolo ? 'Swap this trope out' : 'Propose swapping this trope out'}
          </button>
        )}
      </div>
    </ModalShell>
  );
}
