// Icon + accent color per official cat-* slug, used to make the list
// visually scannable (icons instead of text tags, color as a fast visual
// grouping cue). imtv events have no category taxonomy at all, so they fall
// back to SOURCE_STYLE.imtv's color/icon instead.
interface CategoryStyle {
  icon: string;
  color: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  "cat-aventyr": { icon: "🗺️", color: "#4a9d5c" },
  "cat-berattare": { icon: "📖", color: "#8a6d4a" },
  "cat-eldshow": { icon: "🔥", color: "#e0692b" },
  "cat-festival": { icon: "🎪", color: "#d9a441" },
  "cat-foredrag": { icon: "🎓", color: "#6b7a8f" },
  "cat-forestallning": { icon: "🎬", color: "#5b8fc9" },
  "cat-guidad-visning": { icon: "🧭", color: "#5c8a6b" },
  "cat-gyckel": { icon: "🤹", color: "#c9a13a" },
  "cat-konsert": { icon: "🎵", color: "#7c5cbf" },
  "cat-krog": { icon: "🍺", color: "#8a5a34" },
  "cat-marknad": { icon: "🛒", color: "#c98a2e" },
  "cat-ovrigt": { icon: "✳️", color: "#6b6459" },
  "cat-parad": { icon: "🚩", color: "#b5457a" },
  "cat-performance": { icon: "🎭", color: "#7c5cbf" },
  "cat-strid": { icon: "⚔️", color: "#b33a3a" },
  "cat-stridande": { icon: "⚔️", color: "#b33a3a" },
  "cat-teater": { icon: "🎭", color: "#3d5a80" },
  "cat-uppvisningslager": { icon: "⛺", color: "#5c7a4a" },
  "cat-workshop": { icon: "🛠️", color: "#4a9d8f" },
};

export const SOURCE_STYLES = {
  official: { icon: "🏛️", color: "#d9a441", label: "Officiellt" },
  imtv: { icon: "🍻", color: "#c2568a", label: "Inofficiellt" },
} as const;

export function categoryStyle(slug: string): CategoryStyle {
  return CATEGORY_STYLES[slug] ?? { icon: "✳️", color: "#6b6459" };
}

export function eventAccentColor(event: { source: "official" | "imtv"; category?: string }): string {
  if (event.category) return categoryStyle(event.category).color;
  return SOURCE_STYLES[event.source].color;
}
