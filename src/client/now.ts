import { createSignal, onCleanup, type Accessor } from "solid-js";

// Every date/time in the schema is Europe/Stockholm wall-clock with no
// offset stored (see ../schema.ts), so "now" has to be expressed in that
// same zone — not the device's — or a phone set to another timezone would
// draw the now-line in the wrong place.
export const EVENT_TIME_ZONE = "Europe/Stockholm";

export interface FestivalNow {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  stamp: string; // `${date}T${time}` — directly comparable to `${e.date}T${e.startTime}`
}

// sv-SE formats as "YYYY-MM-DD" and "HH:MM" natively, which is exactly the
// shape the schema stores — so the result drops straight into the same
// string comparisons the rest of the app already uses (byDateTime in db.ts,
// isBlockedByTimeSlot). Note this is the *opposite* direction from
// zonedTimeToUtc() in EventDetailsModal: going instant -> wall-clock is one
// Intl call, no format-and-correct trick needed.
export function festivalNow(at: Date = new Date()): FestivalNow {
  const date = at.toLocaleDateString("sv-SE", { timeZone: EVENT_TIME_ZONE });
  const time = at.toLocaleTimeString("sv-SE", {
    timeZone: EVENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time, stamp: `${date}T${time}` };
}

// A minute-resolution clock signal. The only timer in the app, so it earns
// its two extra behaviours:
//
//   - Re-sync on visibilitychange/focus. This is a PWA that lives
//     backgrounded on a phone, where interval timers get throttled to
//     minutes or suspended outright — without this you unlock the phone to
//     a now-line that's half an hour stale.
//   - Hold a tick while a pointer is down. Rows are swipeable and, with
//     "Dölj påbörjade" on, a tick can delete the exact row under the user's
//     finger. Deferring to pointerup costs at most one minute of staleness
//     during a gesture that lasts a fraction of that.
export function createFestivalClock(intervalMs = 60_000): Accessor<FestivalNow> {
  const [now, setNow] = createSignal<FestivalNow>(festivalNow());
  let pointerDown = false;
  let pending = false;

  function apply() {
    pending = false;
    const next = festivalNow();
    // Minute resolution means most ticks are no-ops; bail early so nothing
    // downstream recomputes for an identical value.
    if (next.stamp !== now().stamp) setNow(next);
  }

  function tick() {
    if (pointerDown) {
      pending = true;
      return;
    }
    apply();
  }

  function onPointerDown() {
    pointerDown = true;
  }

  function onPointerRelease() {
    pointerDown = false;
    if (pending) apply();
  }

  function onWake() {
    if (document.visibilityState === "visible") tick();
  }

  const timer = setInterval(tick, intervalMs);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerRelease);
  window.addEventListener("pointercancel", onPointerRelease);
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("focus", tick);

  onCleanup(() => {
    clearInterval(timer);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerRelease);
    window.removeEventListener("pointercancel", onPointerRelease);
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("focus", tick);
  });

  return now;
}
