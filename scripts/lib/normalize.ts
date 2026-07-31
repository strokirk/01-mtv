import { createHash } from "node:crypto";

// Shared helpers for turning scraped upstream text into schema-friendly values.

export function normalizeForKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (å/ä/ö -> a/a/o)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export function computeId(parts: (string | undefined)[]): string {
  const key = parts.filter(Boolean).join("|");
  return createHash("sha1").update(key).digest("hex").slice(0, 20);
}

// Swedish category labels observed (or expected) in the official programme's
// card footers, mapped to the cat-* taxonomy slugs from schema.ts. Only 11 of
// the 19 known slugs have been observed live as of this scrape (2026 season);
// the rest are best-effort guesses and unverified. Falls back to slugifying
// the raw label for anything not in this table, so an unrecognized/new label
// still produces a usable (if unofficial-looking) category value instead of
// silently dropping the data.
const OFFICIAL_CATEGORY_LABELS: Record<string, string> = {
  Äventyr: "cat-aventyr",
  Berättare: "cat-berattare",
  Eldshow: "cat-eldshow",
  Festival: "cat-festival",
  Föredrag: "cat-foredrag",
  Föreställning: "cat-forestallning",
  "Guidad visning": "cat-guidad-visning",
  Gyckel: "cat-gyckel",
  Konsert: "cat-konsert",
  Krog: "cat-krog",
  Marknad: "cat-marknad",
  Övrigt: "cat-ovrigt",
  Parad: "cat-parad",
  Performance: "cat-performance",
  Strid: "cat-strid",
  Stridande: "cat-stridande",
  Teater: "cat-teater",
  Uppvisningsläger: "cat-uppvisningslager",
  Workshop: "cat-workshop",
};

export function categoryLabelToSlug(label: string): string {
  return OFFICIAL_CATEGORY_LABELS[label] ?? `cat-${normalizeForKey(label)}`;
}
