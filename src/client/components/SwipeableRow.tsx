import { createSignal, Show, type JSX } from "solid-js";
import { FaSolidHeart, FaSolidBan } from "solid-icons/fa";

interface Props {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap: () => void;
  class?: string;
  classList?: Record<string, boolean>;
  children: JSX.Element;
}

const THRESHOLD = 84;

export default function SwipeableRow(props: Props) {
  // `dragging` is the only reactive piece of drag state. The per-pixel
  // transform/opacity updates are written straight to the DOM instead of
  // going through a signal: with a few hundred rows on screen, routing
  // every pointermove through the reactive graph (and through Solid's
  // style-object diffing) is what made the swipe animation stutter.
  const [dragging, setDragging] = createSignal(false);

  let rowRef: HTMLDivElement | undefined;
  let revealRightRef: HTMLDivElement | undefined;
  let revealLeftRef: HTMLDivElement | undefined;

  let startX = 0;
  let startY = 0;
  let dragX = 0;
  let pointerId: number | null = null;
  let axisLocked: "horizontal" | "vertical" | null = null;
  let frame = 0;

  function paint() {
    frame = 0;
    if (rowRef) rowRef.style.transform = `translateX(${dragX}px)`;
    if (revealRightRef) revealRightRef.style.opacity = String(Math.min(1, Math.max(0, dragX) / THRESHOLD));
    if (revealLeftRef) revealLeftRef.style.opacity = String(Math.min(1, Math.max(0, -dragX) / THRESHOLD));
  }

  function schedulePaint() {
    if (frame) return;
    frame = requestAnimationFrame(paint);
  }

  function reset() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    dragX = 0;
    pointerId = null;
    setDragging(false);
    if (rowRef) rowRef.style.transform = "";
  }

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    startX = e.clientX;
    startY = e.clientY;
    pointerId = e.pointerId;
    axisLocked = null;
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging() || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!axisLocked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisLocked = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (axisLocked === "horizontal") {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // Pointer session already ended (e.g. a synthetic event, or the
          // pointer was released elsewhere) — harmless, dragging still works.
        }
      }
    }
    if (axisLocked !== "horizontal") return;

    e.preventDefault();
    dragX = dx;
    schedulePaint();
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging() || e.pointerId !== pointerId) return;
    const dx = dragX;
    const finalAxis = axisLocked;
    reset();

    // Movement never crossed the lock threshold in onPointerMove — a real
    // tap, not an aborted drag in either direction.
    if (finalAxis === null) {
      props.onTap();
      return;
    }
    if (finalAxis !== "horizontal") return; // was a vertical scroll, not a swipe
    if (dx > THRESHOLD) props.onSwipeRight();
    else if (dx < -THRESHOLD) props.onSwipeLeft();
    // else: dragged horizontally but not past the threshold — snap back, no action
  }

  return (
    <div class="swipe-wrapper">
      {/* The reveal backgrounds only exist while a row is actually being
          dragged — two gradient layers per row, times every row in the
          list, is pure paint cost the other 99% of the time. */}
      <Show when={dragging()}>
        <div class="swipe-reveal swipe-reveal-right" ref={revealRightRef} style={{ opacity: 0 }}>
          <FaSolidHeart /> Favorit
        </div>
        <div class="swipe-reveal swipe-reveal-left" ref={revealLeftRef} style={{ opacity: 0 }}>
          Ignorera <FaSolidBan />
        </div>
      </Show>
      <div
        ref={rowRef}
        class={props.class}
        classList={props.classList}
        style={{
          transition: dragging() ? "none" : "transform 0.2s ease",
          "touch-action": "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
      >
        {props.children}
      </div>
    </div>
  );
}
