import { createSignal, For, Show } from "solid-js";
import { FaSolidFilter, FaSolidXmark } from "solid-icons/fa";
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
  hideSoldOut: boolean;
  onHideSoldOut: (v: boolean) => void;
  hideStarted: boolean;
  onHideStarted: (v: boolean) => void;
  viewIsSchedule: boolean;
}

export default function FilterBar(props: Props) {
  const [filtersOpen, setFiltersOpen] = createSignal(false);
  const hasActiveFilters = () =>
    Boolean(
      props.category || props.venue || props.source || props.showIgnored || props.hideSoldOut || props.hideStarted
    );

  return (
    <div class="filter-bar">
      <div class="search-row">
        <div class="search-input-wrap">
          <input
            type="search"
            name="search"
            class="search-input"
            placeholder="Sök titel eller arrangör…"
            value={props.search}
            onInput={(e) => props.onSearch(e.currentTarget.value)}
          />
          <Show when={props.search}>
            <button type="button" class="search-clear" aria-label="Rensa sökning" onClick={() => props.onSearch("")}>
              <FaSolidXmark />
            </button>
          </Show>
        </div>
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
        <div class="filter-checkboxes">
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
          <label class="show-ignored">
            <input
              type="checkbox"
              name="hideSoldOut"
              checked={props.hideSoldOut}
              onChange={(e) => props.onHideSoldOut(e.currentTarget.checked)}
            />
            Dölj fullbokade
          </label>
          {/* Deliberately not hidden in "Mitt schema" (unlike "Visa
              ignorerade"): a favorite you already missed is exactly as
              useless as any other event that's been and gone. */}
          <label class="show-ignored">
            <input
              type="checkbox"
              name="hideStarted"
              checked={props.hideStarted}
              onChange={(e) => props.onHideStarted(e.currentTarget.checked)}
            />
            Dölj påbörjade
          </label>
        </div>
      </Show>
    </div>
  );
}
