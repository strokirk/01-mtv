import { createSignal, type JSX } from "solid-js";

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
  const [dragX, setDragX] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);

  let startX = 0;
  let startY = 0;
  let pointerId: number | null = null;
  let axisLocked: "horizontal" | "vertical" | null = null;

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
    setDragX(dx);
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging() || e.pointerId !== pointerId) return;
    const dx = dragX();
    const finalAxis = axisLocked;
    setDragging(false);
    setDragX(0);
    pointerId = null;

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

  function onPointerCancel() {
    setDragging(false);
    setDragX(0);
    pointerId = null;
  }

  return (
    <div class="swipe-wrapper">
      <div class="swipe-reveal swipe-reveal-right" style={{ opacity: Math.min(1, Math.max(0, dragX()) / THRESHOLD) }}>
        ❤️ Favorit
      </div>
      <div
        class="swipe-reveal swipe-reveal-left"
        style={{ opacity: Math.min(1, Math.max(0, -dragX()) / THRESHOLD) }}
      >
        Ignorera 🚫
      </div>
      <div
        class={props.class}
        classList={props.classList}
        style={{
          transform: `translateX(${dragX()}px)`,
          transition: dragging() ? "none" : "transform 0.2s ease",
          "touch-action": "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {props.children}
      </div>
    </div>
  );
}
