import { Show } from "solid-js";
import DOMPurify from "dompurify";
import type { EventInstance, InstanceDecision } from "../../schema";
import { categoryLabel } from "../categoryLabels";

interface Props {
  event: EventInstance;
  decision: InstanceDecision;
  isRecurring: boolean;
  onToggle: (level: "instance" | "series", key: string, decision: "favorite" | "ignore") => void;
}

export default function EventRow(props: Props) {
  return (
    <article
      class="event-row"
      classList={{ favorite: props.decision === "favorite", ignored: props.decision === "ignore" }}
    >
      <div class="event-time">
        {props.event.startTime}
        {props.event.endTime ? `–${props.event.endTime}` : ""}
      </div>
      <div class="event-body">
        <h3>{props.event.title}</h3>
        <p class="event-meta">
          <Show when={props.event.venue}>{(v) => <span class="venue">{v()}</span>}</Show>
          <Show when={props.event.organizer}>{(o) => <span class="organizer">{o()}</span>}</Show>
          <span class="badge source-badge" data-source={props.event.source}>
            {props.event.source === "official" ? "Officiellt" : "Inofficiellt"}
          </span>
          <Show when={props.event.category}>{(c) => <span class="badge category-badge">{categoryLabel(c())}</span>}</Show>
          <Show when={props.event.bookingStatus === "soldout"}>
            <span class="badge badge-danger">Fullbokad</span>
          </Show>
          <Show when={props.event.bookingStatus === "few-left"}>
            <span class="badge badge-warn">Få biljetter kvar</span>
          </Show>
          <Show when={props.event.editorTip}>
            <span class="badge badge-tip">Veckan tipsar!</span>
          </Show>
        </p>
        <Show when={props.event.description}>
          {(desc) => (
            <Show when={props.event.source === "official"} fallback={<p class="event-description">{desc()}</p>}>
              {/* Official descriptions are WP-authored HTML; sanitize before injecting. */}
              <div class="event-description" innerHTML={DOMPurify.sanitize(desc())} />
            </Show>
          )}
        </Show>
        <Show when={props.event.ticketUrl}>
          {(url) => (
            <a class="ticket-link" href={url()} target="_blank" rel="noreferrer">
              Köp biljett
            </a>
          )}
        </Show>
      </div>
      <div class="event-actions">
        <button
          class="icon-button"
          classList={{ active: props.decision === "favorite" }}
          title="Favoritmarkera detta tillfälle"
          onClick={() => props.onToggle("instance", props.event.id, "favorite")}
        >
          ★
        </button>
        <button
          class="icon-button"
          classList={{ active: props.decision === "ignore" }}
          title="Ignorera detta tillfälle"
          onClick={() => props.onToggle("instance", props.event.id, "ignore")}
        >
          ✕
        </button>
        <Show when={props.isRecurring}>
          <button
            class="icon-button series-button"
            title="Favoritmarkera hela serien"
            onClick={() => props.onToggle("series", props.event.seriesKey, "favorite")}
          >
            ★ serie
          </button>
          <button
            class="icon-button series-button"
            title="Ignorera hela serien"
            onClick={() => props.onToggle("series", props.event.seriesKey, "ignore")}
          >
            ✕ serie
          </button>
        </Show>
      </div>
    </article>
  );
}
