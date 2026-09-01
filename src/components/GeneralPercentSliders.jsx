import { GENRES, GENERAL_PERCENT_OPTIONS, DEFAULT_GENERAL_PERCENT } from '../data/tropes.js';

// One "general tropes %" slider per selected genre -- each genre's mix
// between its own general pool and its own selected sub-genres is
// independent (e.g. Horror at 30% vs. Comedy at 70%).
export default function GeneralPercentSliders({ genres, generalPercents, onChange }) {
  return (
    <>
      {genres.map((genreId) => {
        const label = GENRES.find((g) => g.id === genreId)?.label || genreId;
        const value = generalPercents[genreId] ?? DEFAULT_GENERAL_PERCENT;
        const inputId = `general-percent-${genreId}`;
        return (
          <div key={genreId}>
            <label htmlFor={inputId}>{label} general tropes: {value}%</label>
            <input
              id={inputId}
              type="range"
              min={0}
              max={100}
              step={10}
              list="general-percent-ticks"
              value={value}
              onChange={(e) => onChange(genreId, Number(e.target.value))}
            />
          </div>
        );
      })}
      <datalist id="general-percent-ticks">
        {GENERAL_PERCENT_OPTIONS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </>
  );
}
