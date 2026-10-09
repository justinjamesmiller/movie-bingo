export default function SuperlativeBadge({ award, onClick }) {
  const isBadge = award.kind === 'badge';
  return (
    <button
      className={`superlative-badge ${isBadge ? 'badge-award' : 'exclusive-award'}`}
      onClick={onClick}
      aria-label={`${isBadge ? 'Badge' : 'Superlative'}: ${award.name}`}
      title={`Learn about ${award.name}`}
    >
      {isBadge ? '🏅' : '✦'} {award.name}
    </button>
  );
}
