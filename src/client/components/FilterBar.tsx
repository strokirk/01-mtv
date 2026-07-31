import { For, Show } from "solid-js";
import { categoryLabel } from "../categoryLabels";

interface Props {
  categories: string[];
  venues: string[];
  category: string;
  onCategory: (v: string) => void;
  venue: string;
  onVenue: (v: string) => void;
  source: string;
  onSource: (v: string) => void;
  search: string;
  onSearch: (v: string) => void;
  showIgnored: boolean;
  onShowIgnored: (v: boolean) => void;
  viewIsSchedule: boolean;
}

export default function FilterBar(props: Props) {
  return (
    <div class="filter-bar">
      <input
        type="search"
        name="search"
        class="search-input"
        placeholder="Sök titel eller arrangör…"
        value={props.search}
        onInput={(e) => props.onSearch(e.currentTarget.value)}
      />
      <div class="filter-selects">
        <select name="category" value={props.category} onChange={(e) => props.onCategory(e.currentTarget.value)}>
          <option value="">Alla kategorier</option>
          <For each={props.categories}>{(c) => <option value={c}>{categoryLabel(c)}</option>}</For>
        </select>
        <select name="venue" value={props.venue} onChange={(e) => props.onVenue(e.currentTarget.value)}>
          <option value="">Alla platser</option>
          <For each={props.venues}>{(v) => <option value={v}>{v}</option>}</For>
        </select>
        <select name="source" value={props.source} onChange={(e) => props.onSource(e.currentTarget.value)}>
          <option value="">Alla källor</option>
          <option value="official">Officiellt</option>
          <option value="imtv">Inofficiellt</option>
        </select>
      </div>
      <Show when={!props.viewIsSchedule}>
        <label class="show-ignored">
          <input
            type="checkbox"
            name="showIgnored"
            checked={props.showIgnored}
            onChange={(e) => props.onShowIgnored(e.currentTarget.checked)}
          />
          Visa ignorerade
        </label>
      </Show>
    </div>
  );
}
