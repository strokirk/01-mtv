import { createSignal, createEffect, For, Show } from "solid-js";
import { FaSolidXmark, FaSolidTrash, FaSolidPlus } from "solid-icons/fa";
import type { TimeBlock } from "../db";

interface Props {
  open: boolean;
  defaultDate?: string;
  blocks: TimeBlock[];
  onClose: () => void;
  onAdd: (block: Omit<TimeBlock, "id">) => void;
  onRemove: (id: string) => void;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function TimeBlocksModal(props: Props) {
  let dialogRef: HTMLDialogElement | undefined;
  const [date, setDate] = createSignal("");
  const [startTime, setStartTime] = createSignal("");
  const [endTime, setEndTime] = createSignal("");
  const [label, setLabel] = createSignal("");
  const [error, setError] = createSignal("");

  createEffect(() => {
    if (props.open && dialogRef && !dialogRef.open) {
      // Prefill with the day the user is currently looking at — that's
      // almost always the day they want to block time on.
      if (!date() && props.defaultDate) setDate(props.defaultDate);
      dialogRef.showModal();
    }
    if (!props.open && dialogRef?.open) dialogRef.close();
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!date() || !startTime() || !endTime()) {
      setError("Fyll i datum, starttid och sluttid.");
      return;
    }
    if (startTime() >= endTime()) {
      setError("Sluttid måste vara efter starttid.");
      return;
    }
    props.onAdd({ date: date(), startTime: startTime(), endTime: endTime(), label: label().trim() || undefined });
    setDate("");
    setStartTime("");
    setEndTime("");
    setLabel("");
    setError("");
  }

  return (
    <dialog
      ref={dialogRef}
      class="event-modal timeblocks-modal"
      onClose={() => props.onClose()}
      onClick={(e) => {
        if (e.target === dialogRef) props.onClose();
      }}
    >
      <div class="modal-header">
        <h2>Otillgänglig tid</h2>
        <button class="modal-close" onClick={() => props.onClose()} aria-label="Stäng">
          <FaSolidXmark />
        </button>
      </div>
      <p class="modal-meta">Event som krockar med dessa tider döljs automatiskt, i alla vyer.</p>

      <Show when={props.blocks.length > 0}>
        <ul class="timeblock-list">
          <For each={props.blocks}>
            {(block) => (
              <li>
                <span>
                  {formatDate(block.date)} {block.startTime}–{block.endTime}
                  {block.label ? ` · ${block.label}` : ""}
                </span>
                <button class="icon-button" onClick={() => props.onRemove(block.id)} title="Ta bort">
                  <FaSolidTrash />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <form class="timeblock-form" onSubmit={handleSubmit}>
        <input type="date" name="date" value={date()} onInput={(e) => setDate(e.currentTarget.value)} />
        <div class="timeblock-time-row">
          <input type="time" name="startTime" value={startTime()} onInput={(e) => setStartTime(e.currentTarget.value)} />
          <span>–</span>
          <input type="time" name="endTime" value={endTime()} onInput={(e) => setEndTime(e.currentTarget.value)} />
        </div>
        <input
          type="text"
          name="label"
          placeholder="Anteckning (valfritt)"
          value={label()}
          onInput={(e) => setLabel(e.currentTarget.value)}
        />
        <Show when={error()}>
          <p class="banner banner-warn">{error()}</p>
        </Show>
        <button type="submit" class="icon-button add-timeblock-button">
          <FaSolidPlus /> Lägg till
        </button>
      </form>
    </dialog>
  );
}
