// Renders transient floating reaction bubbles (name + emoji) that rise and
// fade out -- purely ephemeral local UI state driven by short-lived App.jsx
// entries, no persistence.
export default function ReactionOverlay({ reactions }) {
  if (!reactions.length) return null;
  return (
    <div className="reaction-overlay">
      {reactions.map((r) => (
        <div key={r.id} className="reaction-bubble" style={{ left: `${r.offset}%` }}>
          <span className="reaction-emoji">{r.emoji}</span>
          <span className="reaction-name">{r.name}</span>
        </div>
      ))}
    </div>
  );
}
