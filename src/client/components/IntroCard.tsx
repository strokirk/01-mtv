import { For } from "solid-js";
import { FaSolidXmark, FaSolidHeart, FaSolidBan, FaSolidHandPointer, FaSolidCalendarDay } from "solid-icons/fa";
import { categoryLabel } from "../categoryLabels";
import { categoryStyle, SOURCE_STYLES } from "../categoryStyles";

interface Props {
  categories: string[];
  onClose: () => void;
}

// What the app is, how to drive it, and what the colors mean — the three
// things nothing else on the screen was saying. Dismissible, and reopenable
// from the (i) button in the header.
export default function IntroCard(props: Props) {
  return (
    <section class="intro-card">
      <button class="intro-close" onClick={props.onClose} aria-label="Dölj förklaringen">
        <FaSolidXmark />
      </button>
      <h2>Hela Medeltidsveckan i en lista</h2>
      <p>
        Officiella programmet (medeltidsveckan.se) + det inofficiella (imtv.se), en dag i taget. Markera vad du vill se,
        så byggs <strong>Mitt schema</strong> upp — allt sparas lokalt i den här webbläsaren.
      </p>
      <ul class="intro-hints">
        <li>
          <span class="hint-key hint-fav">
            <FaSolidHeart /> Svep höger
          </span>
          spara som favorit
        </li>
        <li>
          <span class="hint-key hint-ignore">
            <FaSolidBan /> Svep vänster
          </span>
          ignorera — döljs ur listan
        </li>
        <li>
          <span class="hint-key">
            <FaSolidHandPointer /> Tryck
          </span>
          detaljer, länkar och hela serien
        </li>
        <li>
          <span class="hint-key">
            <FaSolidCalendarDay /> Pilarna
          </span>
          byt dag (eller ← → på tangentbord)
        </li>
      </ul>
      <details class="intro-legend">
        <summary>Vad betyder färgerna?</summary>
        <p>
          Färgstrecket till vänster om varje event — och pricken i kategorimärket — visar kategori. Rött/gult märke
          betyder fullbokat respektive få biljetter kvar. Event märkta <em>Inofficiellt</em> kommer från imtv.se; allt
          omärkt är från det officiella programmet.
        </p>
        <ul class="legend-grid">
          <For each={props.categories}>
            {(slug) => (
              <li>
                <span class="legend-swatch" style={{ background: categoryStyle(slug).color }} />
                {categoryLabel(slug)}
              </li>
            )}
          </For>
          <li>
            <span class="legend-swatch" style={{ background: SOURCE_STYLES.official.color }} />
            Officiellt, utan kategori
          </li>
          <li>
            <span class="legend-swatch" style={{ background: SOURCE_STYLES.imtv.color }} />
            Inofficiellt (imtv.se)
          </li>
        </ul>
      </details>
    </section>
  );
}
