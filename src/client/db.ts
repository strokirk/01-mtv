import Dexie, { type Table } from "dexie";
import { EventsFileSchema, type EventInstance, type UserState } from "../schema";

interface MetaRecord {
  key: string;
  value: string;
}

// UserState is small (four string arrays) and always accessed as a whole,
// so it's stored as a single row keyed by a constant id rather than one
// table per favorite/ignore kind.
type UserStateRecord = UserState & { id: string };
const USER_STATE_ID = "singleton";

class ProgrammeDB extends Dexie {
  events!: Table<EventInstance, string>;
  meta!: Table<MetaRecord, string>;
  userState!: Table<UserStateRecord, string>;

  constructor() {
    super("mtv-programme");
    this.version(1).stores({
      events: "id, date, source, seriesKey, category",
      meta: "key",
      userState: "id",
    });
  }
}

export const db = new ProgrammeDB();

const EMPTY_STATE: UserState = {
  favoriteSeries: [],
  ignoreSeries: [],
  favoriteInstances: [],
  ignoreInstances: [],
};

export async function loadUserState(): Promise<UserState> {
  const record = await db.userState.get(USER_STATE_ID);
  if (!record) return { ...EMPTY_STATE };
  const { id: _id, ...state } = record;
  return state;
}

async function saveUserState(state: UserState): Promise<void> {
  await db.userState.put({ id: USER_STATE_ID, ...state });
}

export type DecisionLevel = "instance" | "series";
export type Decision = "favorite" | "ignore";

// Toggles `key` in and out of the relevant favorite/ignore array. Setting a
// favorite always clears any ignore entry for the same key at the same
// level (and vice versa) — a single key can't be both at once at the same
// level. This does NOT touch the other level (instance vs series): the
// precedence between them is resolved at read time by resolveDecision() in
// ../schema.ts, not by mutating both here.
export async function toggleDecision(level: DecisionLevel, key: string, decision: Decision): Promise<UserState> {
  const state = await loadUserState();
  const favKey = level === "instance" ? "favoriteInstances" : "favoriteSeries";
  const ignKey = level === "instance" ? "ignoreInstances" : "ignoreSeries";

  const favArr = state[favKey];
  const ignArr = state[ignKey];

  const nextState: UserState = { ...state };
  if (decision === "favorite") {
    nextState[favKey] = favArr.includes(key) ? favArr.filter((k) => k !== key) : [...favArr, key];
    nextState[ignKey] = ignArr.filter((k) => k !== key);
  } else {
    nextState[ignKey] = ignArr.includes(key) ? ignArr.filter((k) => k !== key) : [...ignArr, key];
    nextState[favKey] = favArr.filter((k) => k !== key);
  }

  await saveUserState(nextState);
  return nextState;
}

function byDateTime(a: EventInstance, b: EventInstance): number {
  return `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`);
}

export async function getCachedEvents(): Promise<{ events: EventInstance[]; generatedAt?: string }> {
  const [events, metaRow] = await Promise.all([db.events.toArray(), db.meta.get("generatedAt")]);
  return { events: events.sort(byDateTime), generatedAt: metaRow?.value };
}

// Fetches public/data/events.json (served same-origin) and replaces the
// local cache wholesale. Safe to call this way because favorite/ignore
// state lives in a separate table keyed by `id`/`seriesKey` — as long as
// those stay stable across re-scrapes (guaranteed by how they're computed
// in scripts/lib/normalize.ts), clearing and repopulating `events` never
// loses user state, even though the event rows themselves are fully
// replaced.
export async function syncEvents(): Promise<{ events: EventInstance[]; generatedAt: string }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/events.json`);
  if (!res.ok) throw new Error(`Failed to fetch /data/events.json: ${res.status}`);
  const json = await res.json();
  const parsed = EventsFileSchema.parse(json);

  await db.transaction("rw", db.events, db.meta, async () => {
    await db.events.clear();
    await db.events.bulkAdd(parsed.events);
    await db.meta.put({ key: "generatedAt", value: parsed.generatedAt });
  });

  return { events: [...parsed.events].sort(byDateTime), generatedAt: parsed.generatedAt };
}
