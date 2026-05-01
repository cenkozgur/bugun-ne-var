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

// Hero photos for category tiles. Picked from Unsplash for license-clean,
// iconic, dark-friendly compositions. The query params crop+compress server-
// side so we ship only ~30KB per image to mobile. Override per-Category in
// Base44 by populating Category.hero_image_url — that wins over this map.
//
// All photos: Unsplash License (free for commercial use, no attribution
// required). Original photographer credits live in CATEGORY_HERO_CREDITS
// below in case we want to surface them later.
const UNSPLASH_PARAMS = 'auto=format&fit=crop&w=800&q=70';

const SLUG_TO_HERO_IMAGE = {
  // Soccer ball on lush grass — keeping the previous default until the
  // user picks a non-premium replacement.
  futbol:   `https://images.unsplash.com/photo-1522778119026-d647f0596c20?${UNSPLASH_PARAMS}`,
  // Red Bull F1 car on track (user-picked, MyxG49FpjIM).
  f1:       `https://images.unsplash.com/photo-1673250667524-8566063b79e6?${UNSPLASH_PARAMS}`,
  // Motorcycle close-up in the dark (user-picked, dkkDYdBwp40).
  motogp:   `https://images.unsplash.com/photo-1698170610436-2501ecffc203?${UNSPLASH_PARAMS}`,
  // Basketball going through the hoop (user-picked, YF9YeTmhy6o).
  nba:      `https://images.unsplash.com/photo-1728637690621-ad046564a657?${UNSPLASH_PARAMS}`,
  // Tennis ball + racket on court — keeping the previous default until
  // the user picks a non-premium replacement.
  tenis:    `https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?${UNSPLASH_PARAMS}`,
  // Volleyball net + ball mid-flight, indoor.
  voleybol: `https://images.unsplash.com/photo-1592656094267-764a45160876?${UNSPLASH_PARAMS}`,
  // Vintage TV / studio glow, evokes broadcast.
  tv:       `https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?${UNSPLASH_PARAMS}`,
  // Trophy on a podium under stage lights.
  turnuva:  `https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?${UNSPLASH_PARAMS}`,
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

/**
 * Pick a hero image URL for a category tile.
 *
 * Order of precedence:
 *   1. category.hero_image_url   — explicit override stored in Base44
 *   2. SLUG_TO_HERO_IMAGE[slug]  — built-in Unsplash default
 *   3. null                      — caller falls back to gradient + emoji
 */
export function getCategoryHeroImage(category) {
  if (!category) return null;
  if (category.hero_image_url && typeof category.hero_image_url === 'string') {
    return category.hero_image_url;
  }
  if (category.slug && SLUG_TO_HERO_IMAGE[category.slug]) {
    return SLUG_TO_HERO_IMAGE[category.slug];
  }
  return null;
}