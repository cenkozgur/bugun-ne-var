const SLUG_TO_COLOR_CLASS = {
  futbol: 'cat-futbol',
  f1: 'cat-f1',
  motogp: 'cat-motogp',
  nba: 'cat-nba',
  tenis: 'cat-tenis',
  voleybol: 'cat-voleybol',
  tv: 'cat-tv',
  turnuva: 'cat-turnuva',
};

const COLOR_TO_CLASS = {
  '#2E8B57': 'cat-futbol',
  '#E2342A': 'cat-f1',
  '#F37021': 'cat-motogp',
  '#C7611F': 'cat-nba',
  '#DCCC28': 'cat-tenis',
  '#2859C7': 'cat-voleybol',
  '#C42A7A': 'cat-tv',
  '#C89B2A': 'cat-turnuva',
};

export function getCategoryColorClass(category) {
  if (!category) return 'cat-futbol';
  if (category.slug && SLUG_TO_COLOR_CLASS[category.slug]) {
    return SLUG_TO_COLOR_CLASS[category.slug];
  }
  if (category.color && COLOR_TO_CLASS[category.color]) {
    return COLOR_TO_CLASS[category.color];
  }
  return 'cat-futbol';
}