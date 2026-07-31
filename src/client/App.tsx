import { createSignal, createMemo, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { FaSolidCalendarXmark, FaSolidCircleInfo } from "solid-icons/fa";
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
import DayNav from "./components/DayNav";
import IntroCard from "./components/IntroCard";
import EventDetailsModal from "./components/EventDetailsModal";
import TimeBlocksModal from "./components/TimeBlocksModal";
import ThemeBanner from "./components/ThemeBanner";

const EMPTY_STATE: UserState = {
  favoriteSeries: [],
  ignoreSeries: [],
  favoriteInstances: [],
  ignoreInstances: [],
};

const INTRO_DISMISSED_KEY = "mtv:intro-dismissed";

// The intro's dismissed flag is the one bit of state that must survive
// before IndexedDB is even open, so it lives in localStorage — which can
// throw outright in a privacy-locked-down browser. Never let that take the
// whole app down; worst case the explainer shows again.
function introDismissed(): boolean {
  try {
    return localStorage.getItem(INTRO_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function setIntroDismissed(dismissed: boolean): void {
  try {
    if (dismissed) localStorage.setItem(INTRO_DISMISSED_KEY, "1");
    else localStorage.removeItem(INTRO_DISMISSED_KEY);
  } catch {
    // Storage unavailable — the intro just won't remember its state.
  }
}

// A search spans the whole week rather than the selected day, so a broad
// query ("a") could otherwise dump all ~700 rows into the DOM at once —
// exactly the thing that made scrolling and swiping stutter.
const MAX_SEARCH_RESULTS = 120;

type ViewMode = "all" | "schedule";

export default function App() {
  const [events, setEvents] = createSignal<EventInstance[]>([]);
  const [userState, setUserState] = createSignal<UserState>(EMPTY_STATE);
  const [generatedAt, setGeneratedAt] = createSignal<string | undefined>();
  const [loading, setLoading] = createSignal(true);
  const [syncError, setSyncError] = createSignal<string | undefined>();

  const [view, setView] = createSignal<ViewMode>("all");
  const [selectedDay, setSelectedDay] = createSignal("");
  const [category, setCategory] = createSignal("");
  const [venue, setVenue] = createSignal("");
  const [source, setSource] = createSignal("");
  const [search, setSearch] = createSignal("");
  const [showIgnored, setShowIgnored] = createSignal(false);
  const [detailsEvent, setDetailsEvent] = createSignal<EventInstance | null>(null);
  const [timeBlocks, setTimeBlocks] = createSignal<TimeBlock[]>([]);
  const [timeBlocksOpen, setTimeBlocksOpen] = createSignal(false);
  const [introOpen, setIntroOpen] = createSignal(!introDismissed());

  let toolbarRef: HTMLDivElement | undefined;
  let listRef: HTMLDivElement | undefined;

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

  onMount(() => {
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Don't steal the arrow keys from text fields, selects, or an open modal.
    const el = document.activeElement;
    if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) return;
    if (document.querySelector("dialog[open]")) return;
    if (isSearching()) return;

    const all = days();
    const i = all.indexOf(selectedDay());
    const next = all[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) {
      e.preventDefault();
      goToDay(next);
    }
  }

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

  const days = createMemo(() => Array.from(new Set(events().map((e) => e.date))).sort());

  // Land on today when the app is opened during the festival week, and on
  // the first day of the programme otherwise.
  createEffect(() => {
    const all = days();
    const first = all[0];
    if (!first || all.includes(selectedDay())) return;
    const today = new Date().toLocaleDateString("sv-SE");
    setSelectedDay(all.includes(today) ? today : first);
  });

  const isSearching = () => search().trim().length > 0;

  const blockedCount = createMemo(
    () => events().filter((e) => isBlockedByTimeSlot(e, timeBlocks())).length
  );

  const favoriteDays = createMemo(() => {
    const state = userState();
    const dates = new Set<string>();
    for (const e of events()) {
      if (resolveDecision(e, state) === "favorite") dates.add(e.date);
    }
    return dates;
  });

  // Everything except the day restriction — the day (or a search across all
  // days) is applied on top in `visible()`.
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

  const visible = createMemo(() =>
    isSearching() ? filtered() : filtered().filter((e) => e.date === selectedDay())
  );

  // Only a search can produce an unbounded result set; a single day is
  // always ~120 rows at most, so day browsing is never truncated.
  const truncated = createMemo(() => (isSearching() ? Math.max(0, visible().length - MAX_SEARCH_RESULTS) : 0));

  const grouped = createMemo(() => {
    const groups = new Map<string, EventInstance[]>();
    const rows = isSearching() ? visible().slice(0, MAX_SEARCH_RESULTS) : visible();
    for (const e of rows) {
      const list = groups.get(e.date) ?? [];
      list.push(e);
      groups.set(e.date, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  function goToDay(date: string) {
    setSelectedDay(date);
    // Changing day restarts the list, so scroll back up to it — but only if
    // the list has already scrolled past its own top, so tapping a day at
    // the top of the page doesn't yank the view around.
    const top = (listRef?.offsetTop ?? 0) - (toolbarRef?.offsetHeight ?? 0);
    if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top) });
  }

  async function handleToggle(level: DecisionLevel, key: string, decision: Decision) {
    const next = await toggleDecision(level, key, decision);
    setUserState(next);
  }

  function dismissIntro() {
    setIntroOpen(false);
    setIntroDismissed(true);
  }

  function toggleIntro() {
    if (introOpen()) {
      dismissIntro();
      return;
    }
    setIntroOpen(true);
    setIntroDismissed(false);
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
      <header class="app-brand">
        <h1>
          Medeltidsveckan
          <span class="brand-sub">Program 2026 — officiellt + inofficiellt</span>
        </h1>
        <div class="brand-actions">
          <button
            class="icon-button header-button"
            classList={{ active: introOpen() }}
            title="Om appen"
            aria-label="Om appen"
            aria-expanded={introOpen()}
            onClick={toggleIntro}
          >
            <FaSolidCircleInfo />
          </button>
          <button
            class="icon-button header-button timeblocks-trigger"
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
        </div>
      </header>

      <ThemeBanner />

      <Show when={introOpen()}>
        <IntroCard categories={categories()} onClose={dismissIntro} />
      </Show>

      <div class="app-toolbar" ref={toolbarRef}>
        <nav class="view-toggle">
          <button classList={{ active: view() === "all" }} onClick={() => setView("all")}>
            Program
          </button>
          <button classList={{ active: view() === "schedule" }} onClick={() => setView("schedule")}>
            Mitt schema
          </button>
        </nav>
        <DayNav
          days={days()}
          selected={selectedDay()}
          favoriteDays={favoriteDays()}
          onSelect={goToDay}
          disabled={isSearching()}
        />
      </div>

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

      <div class="event-list" ref={listRef}>
        <Show when={!loading()} fallback={<p class="loading">Laddar program…</p>}>
          <Show
            when={grouped().length > 0}
            fallback={
              <Show
                when={view() === "schedule" && favoriteDays().size === 0}
                fallback={
                  <p class="empty">
                    {isSearching()
                      ? "Inga event matchar sökningen."
                      : view() === "schedule"
                        ? "Inget markerat den här dagen — byt dag med pilarna."
                        : "Inga event matchar filtren den här dagen."}
                  </p>
                }
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
                  <h2>
                    {formatDateHeading(date)} <span class="day-count">· {dayEvents.length} event</span>
                  </h2>
                  <For each={dayEvents}>
                    {(event) => (
                      <EventRow
                        event={event}
                        decision={resolveDecision(event, userState())}
                        onToggle={handleToggle}
                        onOpenDetails={setDetailsEvent}
                      />
                    )}
                  </For>
                </section>
              )}
            </For>
            <Show when={truncated() > 0}>
              <p class="search-more">+{truncated()} till — förfina sökningen för att se fler.</p>
            </Show>
          </Show>
        </Show>
      </div>

      <Show when={generatedAt()}>
        {(g) => <footer class="app-footer">Senast uppdaterat: {formatTimestamp(g())}</footer>}
      </Show>

      <EventDetailsModal
        event={detailsEvent()}
        decision={detailsEvent() ? resolveDecision(detailsEvent()!, userState()) : "neutral"}
        seriesCount={seriesCounts().get(detailsEvent()?.seriesKey ?? "") ?? 0}
        onToggle={handleToggle}
        onClose={() => setDetailsEvent(null)}
      />
      <TimeBlocksModal
        open={timeBlocksOpen()}
        defaultDate={selectedDay()}
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
