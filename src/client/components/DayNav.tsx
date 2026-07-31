import { For, Show, createEffect } from "solid-js";
import { FaSolidChevronLeft, FaSolidChevronRight } from "solid-icons/fa";

interface Props {
  days: string[];
  selected: string;
  favoriteDays: Set<string>;
  onSelect: (date: string) => void;
  disabled?: boolean;
}

function weekday(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("sv-SE", { weekday: "short" }).replace(".", "");
}

function dayOfMonth(date: string): string {
  return String(Number(date.slice(8, 10)));
}

export default function DayNav(props: Props) {
  let stripRef: HTMLDivElement | undefined;
  const index = () => props.days.indexOf(props.selected);

  function step(delta: number) {
    const next = props.days[index() + delta];
    if (next) props.onSelect(next);
  }

  // Keep the selected day visible when it changes from anywhere (chevrons,
  // keyboard, or the default-day pick on load), not just when tapped.
  createEffect(() => {
    props.selected;
    const active = stripRef?.querySelector<HTMLElement>(".day-chip.active");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });

  return (
    <div class="daybar">
      <button
        class="day-nav"
        onClick={() => step(-1)}
        disabled={props.disabled || index() <= 0}
        aria-label="Föregående dag"
        title="Föregående dag"
      >
        <FaSolidChevronLeft />
      </button>
      <div class="day-strip" ref={stripRef}>
        <For each={props.days}>
          {(date) => (
            <button
              class="day-chip"
              classList={{ active: date === props.selected && !props.disabled }}
              onClick={() => props.onSelect(date)}
              aria-pressed={date === props.selected}
            >
              <span class="dow">{weekday(date)}</span>
              <span class="dom">{dayOfMonth(date)}</span>
              <Show when={props.favoriteDays.has(date)}>
                <span class="day-dot" aria-hidden="true" />
              </Show>
            </button>
          )}
        </For>
      </div>
      <button
        class="day-nav"
        onClick={() => step(1)}
        disabled={props.disabled || index() < 0 || index() >= props.days.length - 1}
        aria-label="Nästa dag"
        title="Nästa dag"
      >
        <FaSolidChevronRight />
      </button>
    </div>
  );
}
