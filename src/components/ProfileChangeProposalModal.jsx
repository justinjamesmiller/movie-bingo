import ModalShell from './ModalShell.jsx';

export default function ProfileChangeProposalModal({ proposal, onAccept, onDecline }) {
  return (
    <ModalShell onClose={onDecline}>
      <div className="modal-content">
        <h3>Accept Profile Change?</h3>
        <p className="hint">A host proposed this name and avatar for you:</p>
        <p className="claim-text">
          {proposal.avatar} {proposal.name}
        </p>
        <div className="claim-vote-buttons">
          <button className="btn agree" onClick={onAccept}>
            Accept
          </button>
          <button className="btn disagree" onClick={onDecline}>
            Decline
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
