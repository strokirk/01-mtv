import { Show } from "solid-js";
import type { EventInstance, InstanceDecision } from "../../schema";
import { categoryStyle, eventAccentColor, SOURCE_STYLES } from "../categoryStyles";
import SwipeableRow from "./SwipeableRow";

interface Props {
  event: EventInstance;
  decision: InstanceDecision;
  isRecurring: boolean;
  onToggle: (level: "instance" | "series", key: string, decision: "favorite" | "ignore") => void;
  onOpenDetails: (event: EventInstance) => void;
}

export default function EventRow(props: Props) {
  const sourceStyle = () => SOURCE_STYLES[props.event.source];

  return (
    <SwipeableRow
      class="event-row"
      classList={{ favorite: props.decision === "favorite", ignored: props.decision === "ignore" }}
      onSwipeRight={() => props.onToggle("instance", props.event.id, "favorite")}
      onSwipeLeft={() => props.onToggle("instance", props.event.id, "ignore")}
      onTap={() => props.onOpenDetails(props.event)}
    >
      <div class="event-accent" style={{ background: eventAccentColor(props.event) }} />
      <div class="event-time">
        {props.event.startTime}
        {props.event.endTime ? `–${props.event.endTime}` : ""}
      </div>
      <div class="event-body">
        <h3>{props.event.title}</h3>
        <p class="event-meta">
          <Show when={props.event.venue}>{(v) => <span class="venue">{v()}</span>}</Show>
          <Show when={props.event.organizer}>{(o) => <span class="organizer">{o()}</span>}</Show>
        </p>
        <p class="event-icons" aria-label="Kategori och status">
          <span class="icon-chip" title={sourceStyle().label}>
            {sourceStyle().icon}
          </span>
          <Show when={props.event.category}>
            {(c) => (
              <span class="icon-chip" title={c()}>
                {categoryStyle(c()).icon}
              </span>
            )}
          </Show>
          <Show when={props.event.bookingStatus === "soldout"}>
            <span class="icon-chip icon-danger" title="Fullbokad">
              🚫
            </span>
          </Show>
          <Show when={props.event.bookingStatus === "few-left"}>
            <span class="icon-chip icon-warn" title="Få biljetter kvar">
              ⏳
            </span>
          </Show>
          <Show when={props.event.editorTip}>
            <span class="icon-chip icon-tip" title="Veckan tipsar!">
              ⭐
            </span>
          </Show>
        </p>
      </div>
      <div class="event-actions">
        <button
          class="icon-button heart-button"
          classList={{ active: props.decision === "favorite" }}
          title="Favoritmarkera detta tillfälle"
          onClick={() => props.onToggle("instance", props.event.id, "favorite")}
        >
          {props.decision === "favorite" ? "❤️" : "🤍"}
        </button>
        <button
          class="icon-button"
          classList={{ active: props.decision === "ignore" }}
          title="Ignorera detta tillfälle"
          onClick={() => props.onToggle("instance", props.event.id, "ignore")}
        >
          🚫
        </button>
        <Show when={props.isRecurring}>
          <button
            class="icon-button series-button"
            title="Favoritmarkera hela serien"
            onClick={() => props.onToggle("series", props.event.seriesKey, "favorite")}
          >
            ❤️ serie
          </button>
          <button
            class="icon-button series-button"
            title="Ignorera hela serien"
            onClick={() => props.onToggle("series", props.event.seriesKey, "ignore")}
          >
            🚫 serie
          </button>
        </Show>
      </div>
    </SwipeableRow>
  );
}
