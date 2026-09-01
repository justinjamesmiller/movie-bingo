import { GENRES, SUBGENRES_BY_GENRE } from '../data/tropes.js';

// Shared multi-select genre + sub-genre picker used by both the Host card
// (Landing.jsx) and the Reset modal (ResetModal.jsx) -- lets a game span
// several genres/sub-genres at once (e.g. a movie that's Horror/Comedy/Romance).
export default function GenreSubgenrePicker({ genres, subgenreSelections, onChange }) {
  function toggleGenre(id) {
    const nextGenres = genres.includes(id) ? genres.filter((g) => g !== id) : [...genres, id];
    if (nextGenres.length === 0) return; // always keep at least one genre selected
    const nextSelections = nextGenres.includes(id)
      ? subgenreSelections
      : subgenreSelections.filter((s) => s.genre !== id);
    onChange(nextGenres, nextSelections);
  }

  function toggleSubgenre(genre, subgenre) {
    const exists = subgenreSelections.some((s) => s.genre === genre && s.subgenre === subgenre);
    const next = exists
      ? subgenreSelections.filter((s) => !(s.genre === genre && s.subgenre === subgenre))
      : [...subgenreSelections, { genre, subgenre }];
    onChange(genres, next);
  }

  return (
    <>
      <label>Genres (select one or more)</label>
      <div className="genre-checkboxes">
        {GENRES.map((g) => (
          <label key={g.id} className="checkbox-label inline">
            <input type="checkbox" checked={genres.includes(g.id)} onChange={() => toggleGenre(g.id)} />
            {g.label}
          </label>
        ))}
      </div>
      <label>Sub-genres (optional, layered on top of each genre's general pool)</label>
      <div className="subgenre-groups">
        {genres.map((gid) => (
          <div key={gid} className="subgenre-group">
            <div className="subgenre-group-label">{GENRES.find((g) => g.id === gid)?.label}</div>
            {SUBGENRES_BY_GENRE[gid]
              .filter((s) => s.id !== 'general')
              .map((sg) => (
                <label key={sg.id} className="checkbox-label inline">
                  <input
                    type="checkbox"
                    checked={subgenreSelections.some((s) => s.genre === gid && s.subgenre === sg.id)}
                    onChange={() => toggleSubgenre(gid, sg.id)}
                  />
                  {sg.label}
                </label>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
