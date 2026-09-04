import { GENRES, SUBGENRES_BY_GENRE } from '../data/tropes.js';
import { balancedRatios, updateRatio } from '../utils/ratios.js';
import RatioSliders from './RatioSliders.jsx';

export default function GeneralPercentSliders({
  genres,
  subgenreSelections,
  genrePercents = {},
  subgenrePercents = {},
  onChange,
}) {
  const genreEntries = genres.map((id) => ({ id, label: GENRES.find((genre) => genre.id === id)?.label || id }));

  function updateGenreRatio(genreId, value) {
    const keys = genres;
    onChange(updateRatio(genrePercents, keys, genreId, value), subgenrePercents);
  }

  function updateSubgenreRatio(genreId, ratioId, value) {
    const selections = subgenreSelections.filter((selection) => selection.genre === genreId);
    const keys = ['general', ...selections.map((selection) => selection.subgenre)];
    onChange(genrePercents, {
      ...subgenrePercents,
      [genreId]: updateRatio(subgenrePercents[genreId] || balancedRatios(keys), keys, ratioId, value),
    });
  }

  return (
    <section className="ratio-controls">
      {genres.length > 1 && (
        <RatioSliders title="Genre mix" entries={genreEntries} values={genrePercents} onChange={updateGenreRatio} />
      )}
      {genres.map((genreId) => {
        const selections = subgenreSelections.filter((selection) => selection.genre === genreId);
        if (selections.length === 0) return null;
        const entries = [
          { id: 'general', label: 'General' },
          ...selections.map((selection) => ({
            id: selection.subgenre,
            label:
              SUBGENRES_BY_GENRE[genreId].find((subgenre) => subgenre.id === selection.subgenre)?.label ||
              selection.subgenre,
          })),
        ];
        return (
          <RatioSliders
            key={genreId}
            title={`${GENRES.find((genre) => genre.id === genreId)?.label || genreId} trope mix`}
            entries={entries}
            values={subgenrePercents[genreId] || balancedRatios(entries.map((entry) => entry.id))}
            onChange={(ratioId, value) => updateSubgenreRatio(genreId, ratioId, value)}
          />
        );
      })}
    </section>
  );
}
