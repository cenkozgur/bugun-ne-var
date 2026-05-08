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

// Hero photos for category tiles. We mix two sources because Unsplash has
// quietly migrated most of its high-quality sports content into Unsplash+
// (paid), and Pexels has no premium tier — its catalog is fully free.
//
// Per-Category override: populate Category.hero_image_url in Base44 to win
// over this map without a code change.
//
// Both Unsplash License and Pexels License: free for commercial use, no
// attribution required.
const UNSPLASH_PARAMS = 'auto=format&fit=crop&w=800&q=70';
// Pexels equivalent: ?auto=compress&cs=tinysrgb&w=800 keeps payload small.
const PEXELS_PARAMS = 'auto=compress&cs=tinysrgb&w=800';

const SLUG_TO_HERO_IMAGE = {
  // Soccer ball on lush grass.
  futbol:   `https://images.unsplash.com/photo-1522778119026-d647f0596c20?${UNSPLASH_PARAMS}`,
  // Red Bull F1 car on track (Unsplash MyxG49FpjIM, user-picked).
  f1:       `https://images.unsplash.com/photo-1673250667524-8566063b79e6?${UNSPLASH_PARAMS}`,
  // Toprak Razgatlıoğlu (Türk WSBK pilotu) on his blue Yamaha leaning
  // into a turn in Portugal (Pexels 12735081, CC0). Replaces an
  // older numeric-ID photo (Pexels 63249) that 404'd because Pexels
  // requires a slug-prefixed URL for its older catalog. New-format
  // IDs serve cleanly from the canonical pexels-photo-<id>.jpeg
  // path. Bonus: Toprak is Turkish, fitting for our TR-first app.
  motogp:   `https://images.pexels.com/photos/12735081/pexels-photo-12735081.jpeg?${PEXELS_PARAMS}`,
  // Basketball going through the hoop (Unsplash YF9YeTmhy6o, user-picked).
  nba:      `https://images.unsplash.com/photo-1728637690621-ad046564a657?${UNSPLASH_PARAMS}`,
  // Man playing tennis (Pexels 10612276, user-picked).
  tenis:    `https://images.pexels.com/photos/10612276/pexels-photo-10612276.jpeg?${PEXELS_PARAMS}`,
  // Women playing volleyball (Pexels 25824200, user-picked).
  voleybol: `https://images.pexels.com/photos/25824200/pexels-photo-25824200.jpeg?${PEXELS_PARAMS}`,
  // Vintage TV / studio glow, evokes broadcast.
  tv:       `https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?${UNSPLASH_PARAMS}`,
  // Group of golden trophies (Unsplash u715bKFZBvA, user-picked).
  turnuva:  `https://images.unsplash.com/photo-1665680674724-3a3b3368e036?${UNSPLASH_PARAMS}`,
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