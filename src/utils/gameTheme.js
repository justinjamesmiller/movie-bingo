const GENRE_COLORS = {
  horror: '#9f2637',
  comedy: '#b65a00',
  action: '#176ea6',
  'sci-fi': '#007f82',
  fantasy: '#6f4aa1',
  thriller: '#4f6574',
  romance: '#bd3569',
  drama: '#596b7b',
  documentary: '#41783c',
  adventure: '#a15f13',
  animation: '#cf4b3d',
  biography: '#75614c',
  family: '#438565',
  history: '#8a4937',
  music: '#9a3b89',
  musical: '#b1467d',
  sport: '#29734a',
  war: '#687139',
  western: '#a14f25',
  tv: '#3f6490',
};

const SUBGENRE_COLORS = {
  slasher: '#b3263c',
  supernatural: '#7142a2',
  zombie: '#587a35',
  psychological: '#586785',
  'rom-com': '#d34b6b',
  'spy-espionage': '#14747b',
  'space-opera': '#3159a6',
  'epic-fantasy': '#74509a',
  'mystery-whodunit': '#5c647b',
  'true-crime': '#77504c',
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getGameTheme(genres = [], subgenreSelections = [], mode = 'light') {
  const selectedSubgenres = subgenreSelections.map((selection) => selection.subgenre);
  const colors = unique([
    ...selectedSubgenres.map((subgenre) => SUBGENRE_COLORS[subgenre]),
    ...genres.map((genre) => GENRE_COLORS[genre]),
  ]);
  const [accent = GENRE_COLORS.horror, secondary = accent] = colors;
  void mode;

  return {
    accent,
    accentHover: secondary,
  };
}
