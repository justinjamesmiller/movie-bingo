import ModalShell from './ModalShell.jsx';

export default function WagerIntroModal({ onAddWagers, onSkip }) {
  return (
    <ModalShell onClose={onSkip}>
      <div className="modal-content">
        <h3>Optional Wagers</h3>
        <p className="hint">
          Wagering lets you pick up to five tropes you feel especially confident will happen in the movie or TV show. It
          is completely optional and does not change how you play bingo.
        </p>
        <div className="claim-vote-buttons">
          <button className="btn agree" onClick={onAddWagers}>
            Add Wagers
          </button>
          <button className="btn disagree" onClick={onSkip}>
            Skip for Now
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
