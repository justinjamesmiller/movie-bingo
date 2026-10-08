import ModalShell from './ModalShell.jsx';

export default function AccessibilityModal({ value, onChange, onClose }) {
  const choices = [
    ['largeText', 'Larger text'],
    ['listView', 'Board as a readable list'],
    ['showStateLabels', 'Show space state labels'],
    ['reduceMotion', 'Reduce animations'],
  ];
  return (
    <ModalShell onClose={onClose}>
      <div className="modal-content">
        <h3>Accessibility</h3>
        {choices.map(([key, label]) => (
          <label className="accessibility-choice" key={key}>
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
        <button className="btn cancel-claim-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}
