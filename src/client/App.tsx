import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import { FaSolidCalendarXmark } from "solid-icons/fa";
import type { EventInstance, UserState } from "../schema";
import { resolveDecision } from "../schema";
import {
  getCachedEvents,
  syncEvents,
  loadUserState,
  toggleDecision,
  listTimeBlocks,
  addTimeBlock,
  removeTimeBlock,
  isBlockedByTimeSlot,
  type Decision,
  type DecisionLevel,
  type TimeBlock,
} from "./db";
import EventRow from "./components/EventRow";
import FilterBar from "./components/FilterBar";
import EventDetailsModal from "./components/EventDetailsModal";
import TimeBlocksModal from "./components/TimeBlocksModal";
import ThemeBanner from "./components/ThemeBanner";

const EMPTY_STATE: UserState = {
  favoriteSeries: [],
  ignoreSeries: [],
  favoriteInstances: [],
  ignoreInstances: [],
};

type ViewMode = "all" | "schedule";

export default function App() {
  const [events, setEvents] = createSignal<EventInstance[]>([]);
  const [userState, setUserState] = createSignal<UserState>(EMPTY_STATE);
  const [generatedAt, setGeneratedAt] = createSignal<string | undefined>();
  const [loading, setLoading] = createSignal(true);
  const [syncError, setSyncError] = createSignal<string | undefined>();

  const [view, setView] = createSignal<ViewMode>("all");
  const [category, setCategory] = createSignal("");
  const [venue, setVenue] = createSignal("");
  const [source, setSource] = createSignal("");
  const [search, setSearch] = createSignal("");
  const [showIgnored, setShowIgnored] = createSignal(false);
  const [detailsEvent, setDetailsEvent] = createSignal<EventInstance | null>(null);
  const [timeBlocks, setTimeBlocks] = createSignal<TimeBlock[]>([]);
  const [timeBlocksOpen, setTimeBlocksOpen] = createSignal(false);

  onMount(async () => {
    const [cached, state, blocks] = await Promise.all([getCachedEvents(), loadUserState(), listTimeBlocks()]);
    setEvents(cached.events);
    setGeneratedAt(cached.generatedAt);
    setUserState(state);
    setTimeBlocks(blocks);
    setLoading(cached.events.length === 0);

    try {
      const fresh = await syncEvents();
      setEvents(fresh.events);
      setGeneratedAt(fresh.generatedAt);
      setSyncError(undefined);
    } catch (err) {
      console.warn("syncEvents failed, falling back to cache", err);
      if (cached.events.length === 0) {
        setSyncError("Kunde inte hämta programmet. Kontrollera din anslutning och försök igen.");
      }
    } finally {
      setLoading(false);
    }
  });

  const seriesCounts = createMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events()) counts.set(e.seriesKey, (counts.get(e.seriesKey) ?? 0) + 1);
    return counts;
  });

  const categories = createMemo(() =>
    Array.from(new Set(events().map((e) => e.category).filter((c): c is string => Boolean(c)))).sort()
  );
  const venues = createMemo(() =>
    Array.from(new Set(events().map((e) => e.venue).filter((v): v is string => Boolean(v)))).sort()
  );

  const blockedCount = createMemo(
    () => events().filter((e) => isBlockedByTimeSlot(e, timeBlocks())).length
  );

  const filtered = createMemo(() => {
    const state = userState();
    const blocks = timeBlocks();
    const q = search().trim().toLowerCase();
    const inSchedule = view() === "schedule";

    return events().filter((e) => {
      // A scheduling constraint the user set explicitly — hidden in every
      // view, even "Mitt schema", since being unavailable overrides any
      // favorite.
      if (isBlockedByTimeSlot(e, blocks)) return false;
      const decision = resolveDecision(e, state);
      if (inSchedule) return decision === "favorite";
      if (decision === "ignore" && !showIgnored()) return false;
      if (category() && e.category !== category()) return false;
      if (venue() && e.venue !== venue()) return false;
      if (source() && e.source !== source()) return false;
      if (q && !e.title.toLowerCase().includes(q) && !(e.organizer ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  });

  const grouped = createMemo(() => {
    const groups = new Map<string, EventInstance[]>();
    for (const e of filtered()) {
      const list = groups.get(e.date) ?? [];
      list.push(e);
      groups.set(e.date, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  async function handleToggle(level: DecisionLevel, key: string, decision: Decision) {
    const next = await toggleDecision(level, key, decision);
    setUserState(next);
  }

  async function handleAddTimeBlock(block: Omit<TimeBlock, "id">) {
    await addTimeBlock(block);
    setTimeBlocks(await listTimeBlocks());
  }

  async function handleRemoveTimeBlock(id: string) {
    await removeTimeBlock(id);
    setTimeBlocks(await listTimeBlocks());
  }

  return (
    <div class="app">
      <header class="app-header">
        <h1>Medeltidsveckan</h1>
        <nav class="view-toggle">
          <button classList={{ active: view() === "all" }} onClick={() => setView("all")}>
            Program
          </button>
          <button classList={{ active: view() === "schedule" }} onClick={() => setView("schedule")}>
            Mitt schema
          </button>
          <button
            class="icon-button timeblocks-trigger"
            classList={{ active: timeBlocks().length > 0 }}
            title="Otillgänglig tid"
            aria-label="Otillgänglig tid"
            onClick={() => setTimeBlocksOpen(true)}
          >
            <FaSolidCalendarXmark />
            <Show when={timeBlocks().length > 0}>
              <span class="timeblocks-count">{timeBlocks().length}</span>
            </Show>
          </button>
        </nav>
      </header>

      <ThemeBanner />

      <Show when={syncError()}>
        <p class="banner banner-warn">{syncError()}</p>
      </Show>

      <Show when={blockedCount() > 0}>
        <p class="banner banner-info">
          {blockedCount()} event {blockedCount() === 1 ? "är dolt" : "är dolda"} pga otillgänglig tid.
        </p>
      </Show>

      <FilterBar
        categories={categories()}
        venues={venues()}
        category={category()}
        onCategory={setCategory}
        venue={venue()}
        onVenue={setVenue}
        source={source()}
        onSource={setSource}
        search={search()}
        onSearch={setSearch}
        showIgnored={showIgnored()}
        onShowIgnored={setShowIgnored}
        viewIsSchedule={view() === "schedule"}
      />

      <Show when={!loading()} fallback={<p class="loading">Laddar program…</p>}>
        <Show
          when={grouped().length > 0}
          fallback={
            <Show
              when={view() === "schedule"}
              fallback={<p class="empty">Inga event matchar filtren.</p>}
            >
              <div class="empty empty-schedule">
                <img
                  src={`${import.meta.env.BASE_URL}art/codex-manesse-otto-brandenburg-chess.webp`}
                  alt="Otto IV av Brandenburg spelar schack med en dam. Miniatyr ur Codex Manesse, ca 1305–1340."
                  width="700"
                  height="1362"
                />
                <p>Du har inte favoritmarkerat något än — dags att hitta din egen kärlekshistoria på veckan.</p>
              </div>
            </Show>
          }
        >
          <For each={grouped()}>
            {([date, dayEvents]) => (
              <section class="day-group">
                <h2>{formatDateHeading(date)}</h2>
                <For each={dayEvents}>
                  {(event) => (
                    <EventRow
                      event={event}
                      decision={resolveDecision(event, userState())}
                      isRecurring={(seriesCounts().get(event.seriesKey) ?? 0) > 1}
                      onToggle={handleToggle}
                      onOpenDetails={setDetailsEvent}
                    />
                  )}
                </For>
              </section>
            )}
          </For>
        </Show>
      </Show>

      <Show when={generatedAt()}>
        {(g) => <footer class="app-footer">Senast uppdaterat: {formatTimestamp(g())}</footer>}
      </Show>

      <EventDetailsModal event={detailsEvent()} onClose={() => setDetailsEvent(null)} />
      <TimeBlocksModal
        open={timeBlocksOpen()}
        blocks={timeBlocks()}
        onClose={() => setTimeBlocksOpen(false)}
        onAdd={handleAddTimeBlock}
        onRemove={handleRemoveTimeBlock}
      />
    </div>
  );
}

function formatDateHeading(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const label = d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}
