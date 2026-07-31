import { createSignal, For, Show } from "solid-js";
import { FaSolidFilter } from "solid-icons/fa";
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
  const [filtersOpen, setFiltersOpen] = createSignal(false);
  const hasActiveFilters = () => Boolean(props.category || props.venue || props.source || props.showIgnored);

  return (
    <div class="filter-bar">
      <div class="search-row">
        <input
          type="search"
          name="search"
          class="search-input"
          placeholder="Sök titel eller arrangör…"
          value={props.search}
          onInput={(e) => props.onSearch(e.currentTarget.value)}
        />
        <button
          type="button"
          class="filter-toggle"
          classList={{ active: hasActiveFilters() }}
          aria-expanded={filtersOpen()}
          aria-label="Fler filter"
          title="Fler filter"
          onClick={() => setFiltersOpen(!filtersOpen())}
        >
          <FaSolidFilter />
        </button>
      </div>

      <Show when={filtersOpen()}>
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
      </Show>
    </div>
  );
}
