import { Show, For, createEffect, createMemo } from "solid-js";
import DOMPurify from "dompurify";
import {
  FaSolidXmark,
  FaSolidLink,
  FaSolidHeart,
  FaRegularHeart,
  FaSolidBan,
  FaSolidLocationDot,
  FaSolidUsers,
  FaSolidClock,
} from "solid-icons/fa";
import type { EventInstance, InstanceDecision } from "../../schema";
import { categoryLabel } from "../categoryLabels";
import { categoryStyle, SOURCE_STYLES } from "../categoryStyles";

interface Props {
  event: EventInstance | null;
  decision: InstanceDecision;
  seriesCount: number;
  onToggle: (level: "instance" | "series", key: string, decision: "favorite" | "ignore") => void;
  onClose: () => void;
}

function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(date: string): string {
  const label = new Date(`${date}T00:00:00`).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function EventDetailsModal(props: Props) {
  let dialogRef: HTMLDialogElement | undefined;

  createEffect(() => {
    if (props.event && dialogRef && !dialogRef.open) dialogRef.showModal();
    if (!props.event && dialogRef?.open) dialogRef.close();
  });

  const links = createMemo(() => {
    const event = props.event;
    if (!event) return [];
    return Array.from(new Set([...(event.ticketUrl ? [event.ticketUrl] : []), ...(event.links ?? [])]));
  });

  return (
    <dialog
      ref={dialogRef}
      class="event-modal"
      onClose={() => props.onClose()}
      onClick={(e) => {
        if (e.target === dialogRef) props.onClose();
      }}
    >
      <Show when={props.event}>
        {(event) => (
          <>
            <button class="modal-close" onClick={() => props.onClose()} aria-label="Stäng">
              <FaSolidXmark />
            </button>
            <h2>{event().title}</h2>
            <p class="modal-meta">
              <span class="meta-item">
                <FaSolidClock />
                {formatDate(event().date)} · {event().startTime}
                {event().endTime ? `–${event().endTime}` : ""}
              </span>
              <Show when={event().venue}>
                {(v) => (
                  <span class="meta-item">
                    <FaSolidLocationDot />
                    {v()}
                  </span>
                )}
              </Show>
              <Show when={event().organizer}>
                {(o) => (
                  <span class="meta-item meta-organizer">
                    <FaSolidUsers />
                    {o()}
                  </span>
                )}
              </Show>
            </p>
            <p class="modal-badges">
              <Show when={event().category}>
                {(c) => (
                  <span class="tag tag-category" style={{ "--tag-color": categoryStyle(c()).color }}>
                    <span class="tag-dot" />
                    {categoryLabel(c())}
                  </span>
                )}
              </Show>
              <span class={`tag tag-source-${event().source}`}>{SOURCE_STYLES[event().source].label}</span>
              <Show when={event().bookingStatus === "soldout"}>
                <span class="tag tag-danger">Fullbokad</span>
              </Show>
              <Show when={event().bookingStatus === "few-left"}>
                <span class="tag tag-warn">Få biljetter kvar</span>
              </Show>
              <Show when={event().editorTip}>
                <span class="tag tag-tip">Veckan tipsar!</span>
              </Show>
            </p>

            {/* Series-level actions live here rather than in the list row:
                they need a label to be understandable ("alla N tillfällen"),
                and four buttons per row made the list unreadable. */}
            <div class="modal-actions">
              <button
                class="icon-button heart-button"
                classList={{ active: props.decision === "favorite" }}
                onClick={() => props.onToggle("instance", event().id, "favorite")}
              >
                {props.decision === "favorite" ? <FaSolidHeart /> : <FaRegularHeart />} Favorit
              </button>
              <button
                class="icon-button"
                classList={{ active: props.decision === "ignore" }}
                onClick={() => props.onToggle("instance", event().id, "ignore")}
              >
                <FaSolidBan /> Ignorera
              </button>
              <Show when={props.seriesCount > 1}>
                <button class="icon-button" onClick={() => props.onToggle("series", event().seriesKey, "favorite")}>
                  <FaSolidHeart /> Favorit: alla {props.seriesCount} tillfällen
                </button>
                <button class="icon-button" onClick={() => props.onToggle("series", event().seriesKey, "ignore")}>
                  <FaSolidBan /> Ignorera: alla {props.seriesCount} tillfällen
                </button>
              </Show>
            </div>

            <Show when={event().description}>
              {(desc) => (
                <Show when={event().source === "official"} fallback={<p class="modal-description">{desc()}</p>}>
                  {/* Official descriptions are WP-authored HTML; sanitize before injecting. */}
                  <div class="modal-description" innerHTML={DOMPurify.sanitize(desc())} />
                </Show>
              )}
            </Show>
            <Show when={links().length > 0}>
              <div class="modal-links">
                <For each={links()}>
                  {(url) => (
                    <a href={url} target="_blank" rel="noreferrer">
                      <FaSolidLink /> {linkLabel(url)}
                    </a>
                  )}
                </For>
              </div>
            </Show>
          </>
        )}
      </Show>
    </dialog>
  );
}
