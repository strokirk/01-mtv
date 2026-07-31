import { Show } from "solid-js";
import {
  FaSolidHeart,
  FaRegularHeart,
  FaSolidBan,
  FaSolidLocationDot,
  FaSolidUsers,
} from "solid-icons/fa";
import type { EventInstance, InstanceDecision } from "../../schema";
import { categoryLabel } from "../categoryLabels";
import { categoryStyle, eventAccentColor, SOURCE_STYLES } from "../categoryStyles";
import SwipeableRow from "./SwipeableRow";

interface Props {
  event: EventInstance;
  decision: InstanceDecision;
  onToggle: (level: "instance" | "series", key: string, decision: "favorite" | "ignore") => void;
  onOpenDetails: (event: EventInstance) => void;
}

export default function EventRow(props: Props) {
  const hasTags = () =>
    Boolean(
      props.event.category ||
        props.event.source === "imtv" ||
        props.event.bookingStatus === "soldout" ||
        props.event.bookingStatus === "few-left" ||
        props.event.editorTip
    );

  return (
    <SwipeableRow
      class="event-row"
      classList={{ favorite: props.decision === "favorite", ignored: props.decision === "ignore" }}
      onSwipeRight={() => props.onToggle("instance", props.event.id, "favorite")}
      onSwipeLeft={() => props.onToggle("instance", props.event.id, "ignore")}
      onTap={() => props.onOpenDetails(props.event)}
    >
      <div class="event-stripe" style={{ background: eventAccentColor(props.event) }} />
      <div class="event-time">
        {props.event.startTime}
        <Show when={props.event.endTime}>{(end) => <span class="time-end">–{end()}</span>}</Show>
      </div>
      <div class="event-body">
        <h3>{props.event.title}</h3>
        <p class="event-meta">
          <Show when={props.event.venue}>
            {(v) => (
              <span class="meta-item meta-venue">
                <FaSolidLocationDot />
                <span class="meta-text">{v()}</span>
              </span>
            )}
          </Show>
          <Show when={props.event.organizer}>
            {(o) => (
              <span class="meta-item meta-organizer">
                <FaSolidUsers />
                <span class="meta-text">{o()}</span>
              </span>
            )}
          </Show>
        </p>
        {/* Text tags rather than icon chips: the icons needed a legend to
            mean anything, and "Konsert" costs barely more width than an
            unexplained note glyph did. The category color still carries
            the fast visual grouping, via the stripe and the tag dot.
            Source is only tagged for imtv — 9 out of 10 events are
            official, so tagging those too would just be noise on every
            row; the legend says as much. */}
        <Show when={hasTags()}>
          <p class="event-tags">
            <Show when={props.event.category}>
              {(c) => (
                <span class="tag tag-category" style={{ "--tag-color": categoryStyle(c()).color }}>
                  <span class="tag-dot" />
                  {categoryLabel(c())}
                </span>
              )}
            </Show>
            <Show when={props.event.source === "imtv"}>
              <span class="tag tag-source-imtv">{SOURCE_STYLES.imtv.label}</span>
            </Show>
            <Show when={props.event.bookingStatus === "soldout"}>
              <span class="tag tag-danger">Fullbokad</span>
            </Show>
            <Show when={props.event.bookingStatus === "few-left"}>
              <span class="tag tag-warn">Få biljetter kvar</span>
            </Show>
            <Show when={props.event.editorTip}>
              <span class="tag tag-tip">Veckan tipsar</span>
            </Show>
          </p>
        </Show>
      </div>
      {/* Only the two per-instance actions live in the row; the
          whole-series equivalents moved into the details modal, where
          there's room to say what they actually do. */}
      <div class="event-actions">
        <button
          class="icon-button heart-button"
          classList={{ active: props.decision === "favorite" }}
          title="Favoritmarkera detta tillfälle"
          aria-label="Favoritmarkera detta tillfälle"
          aria-pressed={props.decision === "favorite"}
          onClick={() => props.onToggle("instance", props.event.id, "favorite")}
        >
          {props.decision === "favorite" ? <FaSolidHeart /> : <FaRegularHeart />}
        </button>
        <button
          class="icon-button"
          classList={{ active: props.decision === "ignore" }}
          title="Ignorera detta tillfälle"
          aria-label="Ignorera detta tillfälle"
          aria-pressed={props.decision === "ignore"}
          onClick={() => props.onToggle("instance", props.event.id, "ignore")}
        >
          <FaSolidBan />
        </button>
      </div>
    </SwipeableRow>
  );
}
