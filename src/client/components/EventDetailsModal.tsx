import { Show, For, createEffect, createMemo } from "solid-js";
import DOMPurify from "dompurify";
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
              ✕
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
                {SOURCE_STYLES[event().source].icon} {SOURCE_STYLES[event().source].label}
              </span>
              <Show when={event().category}>
                {(c) => (
                  <span>
                    {categoryStyle(c()).icon} {categoryLabel(c())}
                  </span>
                )}
              </Show>
              <Show when={event().bookingStatus === "soldout"}>
                <span>🚫 Fullbokad</span>
              </Show>
              <Show when={event().bookingStatus === "few-left"}>
                <span>⏳ Få biljetter kvar</span>
              </Show>
              <Show when={event().editorTip}>
                <span>⭐ Veckan tipsar!</span>
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
                <For each={links()}>{(url) => <a href={url} target="_blank" rel="noreferrer">🔗 {linkLabel(url)}</a>}</For>
              </div>
            </Show>
          </>
        )}
      </Show>
    </dialog>
  );
}
