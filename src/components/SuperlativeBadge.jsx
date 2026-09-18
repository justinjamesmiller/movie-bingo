export default function SuperlativeBadge({ award, onClick }) {
  return (
    <button className="superlative-badge" onClick={onClick} title={`Learn about ${award.name}`}>
      ✦ {award.name}
    </button>
  );
}
