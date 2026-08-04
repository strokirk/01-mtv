import { FaSolidClock } from "solid-icons/fa";

interface Props {
  time: string; // "HH:MM"
}

// The "you are here" line in the day list: drawn between the last event
// that has already started and the first one that hasn't. Rendered by
// App.tsx only for today's group, and never during a search (a search spans
// every day, so a single line through it would mean nothing).
export default function NowMarker(props: Props) {
  return (
    <div class="now-marker" role="separator" aria-label={`Nu, klockan ${props.time}`}>
      <span class="now-marker-time">
        <FaSolidClock aria-hidden="true" /> {props.time}
      </span>
    </div>
  );
}
