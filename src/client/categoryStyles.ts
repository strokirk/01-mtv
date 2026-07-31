// Accent color per official cat-* slug. The color is the app's one visual
// grouping cue: it runs down the left edge of every row and sits as a dot
// in the category tag, with the tag's text saying what it means (the intro
// card's legend maps color -> category in one place).
//
// This used to also carry a per-category *icon*; those were dropped from
// the list because an unexplained glyph cost a chunk of row width without
// telling anyone what "cat-gyckel" is. Text labels do that job now.
//
// imtv events have no category taxonomy at all, so they fall back to
// SOURCE_STYLES.imtv's color instead.
const CATEGORY_COLORS: Record<string, string> = {
  "cat-aventyr": "#4a9d5c",
  "cat-berattare": "#8a6d4a",
  "cat-eldshow": "#e0692b",
  "cat-festival": "#d9a441",
  "cat-foredrag": "#6b7a8f",
  "cat-forestallning": "#5b8fc9",
  "cat-guidad-visning": "#5c8a6b",
  "cat-gyckel": "#c9a13a",
  "cat-konsert": "#7c5cbf",
  "cat-krog": "#8a5a34",
  "cat-marknad": "#c98a2e",
  "cat-ovrigt": "#6b6459",
  "cat-parad": "#b5457a",
  "cat-performance": "#7c5cbf",
  "cat-strid": "#b33a3a",
  "cat-stridande": "#b33a3a",
  "cat-teater": "#3d5a80",
  "cat-uppvisningslager": "#5c7a4a",
  "cat-workshop": "#4a9d8f",
};

const FALLBACK_COLOR = "#6b6459";

export const SOURCE_STYLES = {
  official: { color: "#d9a441", label: "Officiellt" },
  imtv: { color: "#c2568a", label: "Inofficiellt" },
} as const;

export function categoryStyle(slug: string): { color: string } {
  return { color: CATEGORY_COLORS[slug] ?? FALLBACK_COLOR };
}

export function eventAccentColor(event: { source: "official" | "imtv"; category?: string }): string {
  if (event.category) return categoryStyle(event.category).color;
  return SOURCE_STYLES[event.source].color;
}
