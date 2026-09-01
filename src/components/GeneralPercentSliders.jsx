import { GENRES, GENERAL_PERCENT_OPTIONS, DEFAULT_GENERAL_PERCENT } from '../data/tropes.js';

// One "general tropes %" slider per selected genre that has at least one
// sub-genre chosen -- with no sub-genre selected there's nothing to mix
// against (it's 100% general either way), so the slider is meaningless.
export default function GeneralPercentSliders({ genres, subgenreSelections, generalPercents, onChange }) {
  const genresWithSubgenres = genres.filter((genreId) => subgenreSelections.some((s) => s.genre === genreId));
  return (
    <>
      {genresWithSubgenres.map((genreId) => {
        const label = GENRES.find((g) => g.id === genreId)?.label || genreId;
        const value = generalPercents[genreId] ?? DEFAULT_GENERAL_PERCENT;
        const inputId = `general-percent-${genreId}`;
        return (
          <div key={genreId}>
            <label htmlFor={inputId}>
              {label} general tropes: {value}%
            </label>
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
