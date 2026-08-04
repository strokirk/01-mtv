import { createSignal, createMemo, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { FaSolidCalendarXmark, FaSolidCircleInfo, FaSolidClock } from "solid-icons/fa";
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
import { createFestivalClock, EVENT_TIME_ZONE } from "./now";
import EventRow from "./components/EventRow";
import FilterBar from "./components/FilterBar";
import DayNav from "./components/DayNav";
import IntroCard from "./components/IntroCard";
import EventDetailsModal from "./components/EventDetailsModal";
import TimeBlocksModal from "./components/TimeBlocksModal";
import ThemeBanner from "./components/ThemeBanner";
import NowMarker from "./components/NowMarker";

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
  const [hideSoldOut, setHideSoldOut] = createSignal(false);
  const [hideStarted, setHideStarted] = createSignal(false);
  const [detailsEvent, setDetailsEvent] = createSignal<EventInstance | null>(null);
  const [timeBlocks, setTimeBlocks] = createSignal<TimeBlock[]>([]);
  const [timeBlocksOpen, setTimeBlocksOpen] = createSignal(false);
  const [introOpen, setIntroOpen] = createSignal(!introDismissed());

  // The app's only clock. Read it sparingly — see the note on filtered().
  const now = createFestivalClock();
  const todayKey = () => now().date;

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

  // All instances of the series the details modal is currently showing
  // (including the current one), so the modal can list sibling occasions
  // and jump straight to any of them.
  const detailsSeriesInstances = createMemo(() => {
    const key = detailsEvent()?.seriesKey;
    if (!key) return [];
    return events()
      .filter((e) => e.seriesKey === key)
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  });

  const categories = createMemo(() =>
    Array.from(new Set(events().map((e) => e.category).filter((c): c is string => Boolean(c)))).sort()
  );
  const venues = createMemo(() =>
    Array.from(new Set(events().map((e) => e.venue).filter((v): v is string => Boolean(v)))).sort()
  );

  const days = createMemo(() => Array.from(new Set(events().map((e) => e.date))).sort());

  // Land on today when the app is opened during the festival week, and on
  // the first day of the programme otherwise. "Today" is the festival's own
  // day, not the device's — a phone on another timezone would otherwise
  // roll over to the next day's programme hours early or late.
  createEffect(() => {
    const all = days();
    const first = all[0];
    if (!first || all.includes(selectedDay())) return;
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: EVENT_TIME_ZONE });
    setSelectedDay(all.includes(today) ? today : first);
  });

  const todayInProgramme = createMemo(() => days().includes(todayKey()));

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

  // Everything except the day restriction and the hide-started cut — the
  // day (or a search across all days) is applied on top in `visible()`.
  const filteredBase = createMemo(() => {
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
      // The decision check branches by view, but every filter below it
      // applies in both views — category/venue/source/search/sold-out used
      // to be skipped entirely in "Mitt schema" because this was an early
      // `return`, not a `continue`.
      if (inSchedule) {
        if (decision !== "favorite") return false;
      } else if (decision === "ignore" && !showIgnored()) {
        return false;
      }
      if (category() && e.category !== category()) return false;
      if (venue() && e.venue !== venue()) return false;
      if (source() && e.source !== source()) return false;
      if (hideSoldOut() && e.bookingStatus === "soldout") return false;
      if (q && !e.title.toLowerCase().includes(q) && !(e.organizer ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  });

  // The clock is read *only* inside this branch, and Solid re-tracks memo
  // dependencies on every run — so with the toggle off, nothing downstream
  // of here depends on the clock and a tick costs literally nothing. Read
  // now() unconditionally and every minute would instead rebuild `grouped()`
  // (new tuples => the outer <For> tears down the whole day section), which
  // is exactly the per-minute list churn the one-day-at-a-time design exists
  // to avoid.
  const filtered = createMemo(() => {
    if (!hideStarted()) return filteredBase();
    const cutoff = now().stamp;
    return filteredBase().filter((e) => `${e.date}T${e.startTime}` >= cutoff);
  });

  // How many events the hide-started cut is currently removing from what the
  // user is actually looking at — so the number in the banner matches the
  // list in front of them rather than counting the whole week.
  const startedHiddenCount = createMemo(() => {
    if (!hideStarted()) return 0;
    const cutoff = now().stamp;
    const scope = isSearching() ? filteredBase() : filteredBase().filter((e) => e.date === selectedDay());
    return scope.filter((e) => `${e.date}T${e.startTime}` < cutoff).length;
  });

  const visible = createMemo(() =>
    isSearching() ? filtered() : filtered().filter((e) => e.date === selectedDay())
  );

  // Where the "nu" line goes in today's list: the id of the first event that
  // hasn't started yet, or null when the whole day is behind us (the line
  // then goes after the last row). `undefined` means don't draw it at all —
  // a different day is selected, or a search is spanning every day at once,
  // where a single line through the results would mean nothing.
  const nowMarkerId = createMemo<string | null | undefined>(() => {
    if (isSearching() || selectedDay() !== todayKey()) return undefined;
    const cutoff = now().stamp;
    const next = visible().find((e) => `${e.date}T${e.startTime}` >= cutoff);
    return next ? next.id : null;
  });

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

  // Park the "nu" line just below the sticky toolbar.
  //
  // The retry loop is not paranoia: `.swipe-wrapper` sets
  // `content-visibility: auto`, so rows that have never been on screen are
  // never laid out and stand in at their `contain-intrinsic-size` guess of
  // 84px. On a 120-row day the marker's first measured offset can therefore
  // be hundreds of pixels wrong. Each scroll materializes the rows it lands
  // among, which sharpens the next measurement — so re-measure until the
  // target stops moving. Instant rather than smooth: a smooth scroll through
  // a long list on open reads as a glitch, and goToDay() jumps instantly too.
  function scrollToNow(attempt = 0) {
    const marker = listRef?.querySelector<HTMLElement>(".now-marker");
    if (!marker) return;
    const offset = toolbarRef?.offsetHeight ?? 0;
    const target = Math.max(0, window.scrollY + marker.getBoundingClientRect().top - offset - 8);
    if (Math.abs(target - window.scrollY) <= 4) return;
    window.scrollTo({ top: target });
    if (attempt < 5) requestAnimationFrame(() => scrollToNow(attempt + 1));
  }

  function jumpToNow() {
    goToDay(todayKey());
    // Let the new day's rows render before measuring anything.
    requestAnimationFrame(() => scrollToNow());
  }

  // Open the app already parked at the current time — but only once, and
  // only on a genuinely untouched scroll position. The list renders twice
  // (Dexie cache first, then syncEvents() replaces `events`), so without the
  // latch the second render would yank the page a second time, and without
  // the scrollY check it could yank someone who started scrolling during the
  // load. Every later trip back to now is the explicit "Nu" button.
  let didAutoScroll = false;
  createEffect(() => {
    if (didAutoScroll || loading()) return;
    if (isSearching() || selectedDay() !== todayKey()) return;
    if (visible().length === 0) return;
    didAutoScroll = true;
    if (window.scrollY > 4) return;
    requestAnimationFrame(() => scrollToNow());
  });

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
        <div class="toolbar-row">
          <nav class="view-toggle">
            <button classList={{ active: view() === "all" }} onClick={() => setView("all")}>
              Program
            </button>
            <button classList={{ active: view() === "schedule" }} onClick={() => setView("schedule")}>
              Mitt schema
            </button>
          </nav>
          {/* Autoscroll only happens on open, so this is the way back to the
              current time afterwards. Pointless outside the festival week. */}
          <Show when={todayInProgramme()}>
            <button
              type="button"
              class="now-jump"
              title="Hoppa till nu"
              aria-label="Hoppa till nu"
              disabled={isSearching()}
              onClick={jumpToNow}
            >
              <FaSolidClock /> Nu
            </button>
          </Show>
        </div>
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

      {/* "Dölj påbörjade" hides everything before now across all days, so
          browsing back to a day that's already been would otherwise show an
          unexplained empty list — with the culprit checkbox collapsed out of
          sight inside the filter panel. Hence the inline way out. */}
      <Show when={startedHiddenCount() > 0}>
        <p class="banner banner-info">
          {startedHiddenCount()} event har redan börjat och {startedHiddenCount() === 1 ? "är dolt" : "är dolda"}.{" "}
          <button type="button" class="banner-action" onClick={() => setHideStarted(false)}>
            Visa
          </button>
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
        hideSoldOut={hideSoldOut()}
        onHideSoldOut={setHideSoldOut}
        hideStarted={hideStarted()}
        onHideStarted={setHideStarted}
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
                    height="1059"
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
                  {/* The marker is a <Show> inside the loop rather than an
                      extra entry in `grouped()` on purpose: a clock tick then
                      re-evaluates one cheap condition per row instead of
                      invalidating the row list and rebuilding every
                      EventRow. */}
                  <For each={dayEvents}>
                    {(event) => (
                      <>
                        <Show when={nowMarkerId() === event.id}>
                          <NowMarker time={now().time} />
                        </Show>
                        <EventRow
                          event={event}
                          decision={resolveDecision(event, userState())}
                          onToggle={handleToggle}
                          onOpenDetails={setDetailsEvent}
                        />
                      </>
                    )}
                  </For>
                  {/* Everything today has already started — the line belongs
                      at the bottom, which is what you see late in the evening. */}
                  <Show when={nowMarkerId() === null && date === todayKey()}>
                    <NowMarker time={now().time} />
                  </Show>
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
        seriesEvents={detailsSeriesInstances()}
        onToggle={handleToggle}
        onSelect={setDetailsEvent}
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
