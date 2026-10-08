export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="theme-toggle"
      data-tutorial="theme"
      onClick={onToggle}
      aria-label="Toggle dark mode"
      title="Toggle light/dark mode"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
