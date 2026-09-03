export default function ModalShell({ children, onClose }) {
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onClose?.();
  }

  return (
    <div className="modal" onMouseDown={handleBackdropClick}>
      {children}
    </div>
  );
}
