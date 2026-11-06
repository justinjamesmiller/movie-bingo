import { useId, useState } from 'react';
import { useTropeDescription } from '../hooks/useTropeDescription.js';
import ModalShell from './ModalShell.jsx';
import SceneContextFields, { SceneContextSummary, suppliedSceneContext } from './SceneContextFields.jsx';

// Explains what a trope actually means before the player puts it to the group,
// so everyone is voting on the same interpretation.
export default function TropeInfoModal({
  text,
  marked,
  title,
  actionHint,
  confirmLabel,
  showWagerInfo = false,
  maxWagers = 5,
  onConfirm,
  onCancel,
  onProposeSwap,
  onAdvancedActions,
  actionsAvailable = true,
  playerCount = 2,
  callers = [],
  successfulCallers = [],
  allowSceneContext = false,
  sceneContextReadOnly = false,
  sceneContexts = [],
}) {
  const [callersExpanded, setCallersExpanded] = useState(false);
  const [wagerInfoExpanded, setWagerInfoExpanded] = useState(false);
  const [sceneContext, setSceneContext] = useState({ note: '', timestamp: '' });
  const callerListId = useId();
  const wagerInfoId = useId();
  const callHit = successfulCallers.length > 0;
  const displayedCallers = callHit ? successfulCallers : callers;
  const callerLabel = callHit ? 'Show successful callers' : 'Show players calling this trope';
  const isSolo = playerCount === 1;
  const { description, ready } = useTropeDescription(text);
  const heading = title || (marked ? 'Undo this space?' : 'Claim this trope?');
  const hint =
    actionHint ||
    (showWagerInfo
      ? null
      : marked
        ? isSolo
          ? 'This removes the mark from your board.'
          : 'The group votes on whether to undo this. A majority has to agree.'
        : isSolo
          ? 'This marks the trope as happened on your board.'
          : null);
  const primaryLabel =
    confirmLabel ||
    (marked ? (isSolo ? '↩️ Undo it' : '↩️ Ask to undo it') : isSolo ? '✅ Submit' : '✅ Submit to the group');
  const canEditSceneContext = allowSceneContext && !sceneContextReadOnly;

  return (
    <ModalShell onClose={onCancel}>
      <div className="modal-content trope-info-modal">
        <header className="trope-info-header">
          <h3 className="trope-info-eyebrow">{heading}</h3>
          <h4 className="trope-info-title">{text}</h4>
        </header>
        {!ready ? (
          <p className="hint">Loading the explanation…</p>
        ) : description ? (
          <div className="trope-info-explanation">
            <section aria-label="Definition">
              <h5 className="trope-info-label">What it means</h5>
              <p>{description.what}</p>
            </section>
            <section className="trope-info-example" aria-label="Example">
              <h5 className="trope-info-label">For example:</h5>
              <p>{description.example}</p>
            </section>
          </div>
        ) : (
          <p className="hint">
            No explanation written for this one yet — go with {isSolo ? 'your' : 'the group&apos;s'} reading of it.
          </p>
        )}
        {sceneContextReadOnly ? (
          <SceneContextSummary contexts={sceneContexts} />
        ) : (
          canEditSceneContext && onConfirm && <SceneContextFields value={sceneContext} onChange={setSceneContext} />
        )}
        <div className="trope-info-actions">
          {hint && <p className="hint trope-info-action-hint">{hint}</p>}
          <div className="trope-info-primary-actions">
            {onConfirm && (
              <button
                className="btn agree"
                onClick={() => (canEditSceneContext ? onConfirm(suppliedSceneContext(sceneContext)) : onConfirm())}
              >
                {primaryLabel}
              </button>
            )}
            {showWagerInfo && onConfirm && (
              <button
                className="btn wager-info-button"
                aria-label="About wagering"
                title="About wagering"
                aria-expanded={wagerInfoExpanded}
                aria-controls={wagerInfoId}
                onClick={() => setWagerInfoExpanded(!wagerInfoExpanded)}
              >
                <span className="wager-info-icon" aria-hidden="true">
                  i
                </span>
                About wagering
                <span className="wager-info-chevron" aria-hidden="true">
                  {wagerInfoExpanded ? '−' : '+'}
                </span>
              </button>
            )}
          </div>
          {showWagerInfo && wagerInfoExpanded && (
            <section id={wagerInfoId} className="trope-wager-help" aria-label="About wagering">
              <h5 className="trope-info-label">Make your predictions!</h5>
              <p>
                Wagering is a fun way to predict what will happen in the movie or show. See how many you get right as
                you watch.
              </p>
              <ul>
                <li>Pick up to {maxWagers} tropes you think are especially likely.</li>
                <li>Change your picks before the host starts; they lock when play begins.</li>
              </ul>
              <p className="hint">Just for fun: no money involved, and no wagers needed to play bingo.</p>
            </section>
          )}
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
        </div>
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
        <footer className="trope-modal-footer">
          <button className="btn trope-modal-dismiss" onClick={onCancel}>
            {onConfirm ? 'Cancel' : 'Close'}
          </button>
        </footer>
      </div>
    </ModalShell>
  );
}
