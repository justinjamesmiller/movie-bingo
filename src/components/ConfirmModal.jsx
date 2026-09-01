// Generic yes/no confirmation dialog, reused for actions that deserve a
// confirm step but don't need any custom input (e.g. Leave Game).
export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  return (
    <div className="modal">
      <div className="modal-content">
        <h3>{title}</h3>
        <p className="hint">{message}</p>
        <div className="claim-vote-buttons cancel-claim-btn">
          <button className="btn disagree" onClick={onConfirm}>{confirmLabel}</button>
          <button className="btn" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
