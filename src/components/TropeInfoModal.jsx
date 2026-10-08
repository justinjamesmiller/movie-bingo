import { useId, useState } from 'react';
import { useTropeDescription } from '../hooks/useTropeDescription.js';
import ModalShell from './ModalShell.jsx';
import SceneContextFields, { suppliedSceneContext, validSceneContext } from './SceneContextFields.jsx';

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
  onAdvancedActions,
  actionsAvailable = true,
  playerCount = 2,
  callers = [],
  successfulCallers = [],
  allowSceneContext = false,
}) {
  const [callersExpanded, setCallersExpanded] = useState(false);
  const [sceneContext, setSceneContext] = useState({ note: '', timestamp: '' });
  const callerListId = useId();
  const callHit = successfulCallers.length > 0;
  const displayedCallers = callHit ? successfulCallers : callers;
  const callerLabel = callHit ? 'Show successful callers' : 'Show players calling this trope';
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
        : null);
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
        {hint && <p className="hint">{hint}</p>}
        {allowSceneContext && onConfirm && <SceneContextFields value={sceneContext} onChange={setSceneContext} />}
        <div className="claim-vote-buttons">
          {onConfirm && (
            <button
              className="btn agree"
              disabled={allowSceneContext && !validSceneContext(sceneContext)}
              onClick={() => (allowSceneContext ? onConfirm(suppliedSceneContext(sceneContext)) : onConfirm())}
            >
              {primaryLabel}
            </button>
          )}
          <button className="btn disagree" onClick={onCancel}>
            {onConfirm ? 'Cancel' : 'Close'}
          </button>
        </div>
        {actionsAvailable && onAdvancedActions ? (
          <button className="btn secondary-action" onClick={onAdvancedActions}>
            ⋯ Advanced actions
          </button>
        ) : actionsAvailable ? (
          onProposeSwap && (
            <button className="btn secondary-action" onClick={onProposeSwap}>
              🔁 {isSolo ? 'Swap this trope out' : 'Propose swapping this trope out'}
            </button>
          )
        ) : null}
        {displayedCallers.length > 0 && (
          <div className="trope-callers">
            <div className="caller-avatars">
              {displayedCallers.map((player) => (
                <button
                  key={player.id}
                  className="icon-btn"
                  aria-label={callerLabel}
                  title={callerLabel}
                  aria-expanded={callersExpanded}
                  aria-controls={callerListId}
                  onClick={() => setCallersExpanded(!callersExpanded)}
                >
                  {player.avatar || '👤'}
                </button>
              ))}
            </div>
            {callersExpanded && (
              <div id={callerListId}>
                <h4>{callHit ? 'Called it correctly' : 'Called to happen next'}</h4>
                <ul
                  className="help-list"
                  aria-label={callHit ? 'Players who called this trope correctly' : 'Players calling this trope'}
                >
                  {displayedCallers.map((player) => (
                    <li key={player.id}>
                      <span aria-hidden="true">{player.avatar || '👤'}</span> {player.name}
                      {player.connected === false ? ' (disconnected)' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
