import { Show, For, createEffect, createMemo } from "solid-js";
import { Dynamic } from "solid-js/web";
import DOMPurify from "dompurify";
import { FaSolidXmark, FaSolidBan, FaSolidHourglassHalf, FaSolidStar, FaSolidLink } from "solid-icons/fa";
import type { EventInstance } from "../../schema";
import { categoryLabel } from "../categoryLabels";
import { categoryStyle, SOURCE_STYLES } from "../categoryStyles";

interface Props {
  event: EventInstance | null;
  onClose: () => void;
}

function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
              <span>
                {event().date} · {event().startTime}
                {event().endTime ? `–${event().endTime}` : ""}
              </span>
              <Show when={event().venue}>{(v) => <span>{v()}</span>}</Show>
              <Show when={event().organizer}>{(o) => <span>{o()}</span>}</Show>
            </p>
            <p class="modal-badges">
              <span>
                <Dynamic component={SOURCE_STYLES[event().source].Icon} /> {SOURCE_STYLES[event().source].label}
              </span>
              <Show when={event().category}>
                {(c) => (
                  <span>
                    <Dynamic component={categoryStyle(c()).Icon} /> {categoryLabel(c())}
                  </span>
                )}
              </Show>
              <Show when={event().bookingStatus === "soldout"}>
                <span>
                  <FaSolidBan /> Fullbokad
                </span>
              </Show>
              <Show when={event().bookingStatus === "few-left"}>
                <span>
                  <FaSolidHourglassHalf /> Få biljetter kvar
                </span>
              </Show>
              <Show when={event().editorTip}>
                <span>
                  <FaSolidStar /> Veckan tipsar!
                </span>
              </Show>
            </p>
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
