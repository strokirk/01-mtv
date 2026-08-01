// Medeltidsveckan 2026's actual festival theme is "en kärlekshistoria" ("a
// love story") — confirmed from medeltidsveckan.se's own homepage copy, not
// assumed. This banner ties the app's reskin to that, with a genuine
// 700-year-old public-domain illumination rather than a generic stock image.
// See public/art/ATTRIBUTIONS.md for source/license detail.
//
// The caption used to sit in a gradient overlay across the bottom of the
// image — which is exactly where the couple's faces, the actual point of
// the illustration, ended up cropped to. Caption now lives below the image
// instead, so nothing needs to fight the crop for legibility.
export default function ThemeBanner() {
  return (
    <div class="theme-banner">
      <img
        src={`${import.meta.env.BASE_URL}art/codex-manesse-altstetten.webp`}
        alt="Konrad von Altstetten i sin älskades famn, under ett rosenbuskage. Miniatyr ur Codex Manesse, ca 1305–1315."
        width="700"
        height="1054"
      />
      <div class="theme-banner-text">
        <p class="theme-banner-title">Årets tema: en kärlekshistoria</p>
        <p class="theme-banner-credit">
          Konrad von Altstetten, <em>Codex Manesse</em> · ca 1305–1315
        </p>
      </div>
    </div>
  );
}
