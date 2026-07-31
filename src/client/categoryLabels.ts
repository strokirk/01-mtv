// Display labels for the official programme's cat-* slugs (src/schema.ts).
// Deliberately separate from scripts/lib/normalize.ts's categoryLabelToSlug
// (the inverse mapping used by the scraper) rather than shared: that module
// pulls in node:crypto, which doesn't belong in a browser bundle.
const CATEGORY_LABELS: Record<string, string> = {
  "cat-aventyr": "Äventyr",
  "cat-berattare": "Berättare",
  "cat-eldshow": "Eldshow",
  "cat-festival": "Festival",
  "cat-foredrag": "Föredrag",
  "cat-forestallning": "Föreställning",
  "cat-guidad-visning": "Guidad visning",
  "cat-gyckel": "Gyckel",
  "cat-konsert": "Konsert",
  "cat-krog": "Krog",
  "cat-marknad": "Marknad",
  "cat-ovrigt": "Övrigt",
  "cat-parad": "Parad",
  "cat-performance": "Performance",
  "cat-strid": "Strid",
  "cat-stridande": "Stridande",
  "cat-teater": "Teater",
  "cat-uppvisningslager": "Uppvisningsläger",
  "cat-workshop": "Workshop",
};

export function categoryLabel(slug: string): string {
  return CATEGORY_LABELS[slug] ?? slug;
}
