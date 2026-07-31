import type { IconTypes } from "solid-icons";
import {
  FaSolidDragon,
  FaSolidScroll,
  FaSolidFire,
  FaSolidPeopleGroup,
  FaSolidGraduationCap,
  FaSolidClapperboard,
  FaSolidCompass,
  FaSolidHatWizard,
  FaSolidMusic,
  FaSolidBeerMugEmpty,
  FaSolidAsterisk,
  FaSolidFlag,
  FaSolidMasksTheater,
  FaSolidShieldHalved,
  FaSolidTheaterMasks,
  FaSolidCampground,
  FaSolidScrewdriverWrench,
  FaSolidCartShopping,
  FaSolidLandmark,
} from "solid-icons/fa";

// Icon + accent color per official cat-* slug, used to make the list
// visually scannable (icons instead of text tags, color as a fast visual
// grouping cue). imtv events have no category taxonomy at all, so they fall
// back to SOURCE_STYLES.imtv's color/icon instead.
interface CategoryStyle {
  Icon: IconTypes;
  color: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  "cat-aventyr": { Icon: FaSolidDragon, color: "#4a9d5c" },
  "cat-berattare": { Icon: FaSolidScroll, color: "#8a6d4a" },
  "cat-eldshow": { Icon: FaSolidFire, color: "#e0692b" },
  "cat-festival": { Icon: FaSolidPeopleGroup, color: "#d9a441" },
  "cat-foredrag": { Icon: FaSolidGraduationCap, color: "#6b7a8f" },
  "cat-forestallning": { Icon: FaSolidClapperboard, color: "#5b8fc9" },
  "cat-guidad-visning": { Icon: FaSolidCompass, color: "#5c8a6b" },
  "cat-gyckel": { Icon: FaSolidHatWizard, color: "#c9a13a" },
  "cat-konsert": { Icon: FaSolidMusic, color: "#7c5cbf" },
  "cat-krog": { Icon: FaSolidBeerMugEmpty, color: "#8a5a34" },
  "cat-marknad": { Icon: FaSolidCartShopping, color: "#c98a2e" },
  "cat-ovrigt": { Icon: FaSolidAsterisk, color: "#6b6459" },
  "cat-parad": { Icon: FaSolidFlag, color: "#b5457a" },
  "cat-performance": { Icon: FaSolidMasksTheater, color: "#7c5cbf" },
  "cat-strid": { Icon: FaSolidShieldHalved, color: "#b33a3a" },
  "cat-stridande": { Icon: FaSolidShieldHalved, color: "#b33a3a" },
  "cat-teater": { Icon: FaSolidTheaterMasks, color: "#3d5a80" },
  "cat-uppvisningslager": { Icon: FaSolidCampground, color: "#5c7a4a" },
  "cat-workshop": { Icon: FaSolidScrewdriverWrench, color: "#4a9d8f" },
};

const FALLBACK_STYLE: CategoryStyle = { Icon: FaSolidAsterisk, color: "#6b6459" };

export const SOURCE_STYLES = {
  official: { Icon: FaSolidLandmark, color: "#d9a441", label: "Officiellt" },
  imtv: { Icon: FaSolidBeerMugEmpty, color: "#c2568a", label: "Inofficiellt" },
} as const;

export function categoryStyle(slug: string): CategoryStyle {
  return CATEGORY_STYLES[slug] ?? FALLBACK_STYLE;
}

export function eventAccentColor(event: { source: "official" | "imtv"; category?: string }): string {
  if (event.category) return categoryStyle(event.category).color;
  return SOURCE_STYLES[event.source].color;
}
