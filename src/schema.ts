import { z } from "zod";

// Unified event schema for the combined Medeltidsveckan programme viewer.
// Two upstream sources feed into this shape: the official programme
// (medeltidsveckan.se, WordPress custom post type `mv_programme`) and the
// unofficial/community programme (imtv.se, plain server-rendered ASP HTML).
// Neither exposes a stable public API — both are scraped in CI. See
// HANDOFF.md for the full research writeup behind these field choices.

export const SCHEMA_VERSION = 1 as const;

export const SourceSchema = z.enum(["official", "imtv"]);
export type Source = z.infer<typeof SourceSchema>;

export const BookingStatusSchema = z.enum(["available", "few-left", "soldout"]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

// The 19 official category slugs, observed on medeltidsveckan.se/programme/.
// Do not trust the CSS classes rendered on programme-list cards for this —
// they're stale/identical across all cards (a caching bug in the theme).
// Derive category from the rendered card text or AJAX detail response instead.
export const OfficialCategorySchema = z.enum([
  "cat-aventyr",
  "cat-berattare",
  "cat-eldshow",
  "cat-festival",
  "cat-foredrag",
  "cat-forestallning",
  "cat-guidad-visning",
  "cat-gyckel",
  "cat-konsert",
  "cat-krog",
  "cat-marknad",
  "cat-ovrigt",
  "cat-parad",
  "cat-performance",
  "cat-strid",
  "cat-stridande",
  "cat-teater",
  "cat-uppvisningslager",
  "cat-workshop",
]);
export type OfficialCategory = z.infer<typeof OfficialCategorySchema>;

export const EventInstanceSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),

  // Stable synthetic id: sha1(source + date + startTime + normalizedTitle + venue|organizer).
  // Recomputed identically on every scrape run so re-imports keep the same id
  // for the same real-world event instance even if upstream ids change.
  id: z.string().min(1),

  source: SourceSchema,

  // Original upstream id: WP post `pid` (official) or modal GUID (imtv).
  // NOT stable across years/rescrapes for either source — use only for
  // within-run dedupe, never as a long-term key. `id` and `seriesKey` are
  // the durable identifiers.
  sourceId: z.string().min(1),

  // Heuristic grouping key for "this recurring thing" across its instances:
  // normalized(title [+ venue for official] [+ organizer for imtv]).
  // Fuzzy by construction — imtv in particular reissues a fresh GUID (and
  // sometimes slightly reworded title) for the same yearly tradition, so
  // don't treat seriesKey equality as a mathematical guarantee, just a
  // best-effort grouping for the favorite/ignore-a-series feature.
  seriesKey: z.string().min(1),

  title: z.string().min(1),
  organizer: z.string().optional(), // item_owner (official) / "Skapad av" (imtv)
  description: z.string().optional(), // HTML (official) or plain text (imtv)

  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Europe/Stockholm local date
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),

  venue: z.string().optional(), // structured (official) or best-effort extracted text (imtv)
  category: z.string().optional(), // one of OfficialCategorySchema values; undefined for imtv (no taxonomy there)

  image: z.string().url().optional(),
  ticketUrl: z.string().url().optional(),
  price: z.string().optional(), // free text; rarely present for either source

  bookingStatus: BookingStatusSchema.optional(), // official only
  familyFriendly: z.boolean().optional(), // official only ("Extra bra för barn")
  includedInPass: z.boolean().optional(), // official only ("Gratis & veckan tipsar")
  editorTip: z.boolean().optional(), // official only ("Veckan tipsar!")

  links: z.array(z.string()).optional(), // imtv only: fb/website/mailto extracted from free text
  lastModified: z.string().optional(), // imtv only: "Senast ändrad" timestamp, no explicit tz

  // Full original scraped payload for this instance, always kept. This is
  // the drift-tolerance escape hatch: if a future site redesign breaks a
  // normalized field, `raw` still has whatever the scraper captured, and
  // the app/CI can be fixed up without having lost data from the run that
  // shipped before the fix.
  raw: z.unknown(),
});
export type EventInstance = z.infer<typeof EventInstanceSchema>;

export const EventsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  generatedAt: z.string(), // ISO 8601 timestamp of the CI run that produced this file
  events: z.array(EventInstanceSchema),
});
export type EventsFile = z.infer<typeof EventsFileSchema>;

// User favorite/ignore state. Local-only (IndexedDB in the client app) —
// never synced or committed anywhere. Precedence rule, load-bearing for the
// UI: an instance-level decision always overrides the series-level default.
// Resolution order per instance:
//   1. favoriteInstances / ignoreInstances (by `id`), if present
//   2. else favoriteSeries / ignoreSeries (by `seriesKey`), if present
//   3. else neutral/unset
// A user can favorite an entire series and still ignore one specific
// instance of it, or vice versa — the instance-level entry always wins.
export const UserStateSchema = z.object({
  favoriteSeries: z.array(z.string()),
  ignoreSeries: z.array(z.string()),
  favoriteInstances: z.array(z.string()),
  ignoreInstances: z.array(z.string()),
});
export type UserState = z.infer<typeof UserStateSchema>;

export type InstanceDecision = "favorite" | "ignore" | "neutral";

export function resolveDecision(
  event: Pick<EventInstance, "id" | "seriesKey">,
  state: UserState
): InstanceDecision {
  if (state.favoriteInstances.includes(event.id)) return "favorite";
  if (state.ignoreInstances.includes(event.id)) return "ignore";
  if (state.favoriteSeries.includes(event.seriesKey)) return "favorite";
  if (state.ignoreSeries.includes(event.seriesKey)) return "ignore";
  return "neutral";
}
