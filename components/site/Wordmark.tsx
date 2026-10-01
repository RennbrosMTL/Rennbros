import { business } from "@/lib/business";

/**
 * The lockup: the RB mark (from the business card, traced to a vector) and
 * the name as on the card, RENN in red and BROS in ink. The mark is a cached
 * SVG used as a CSS mask, so it follows the text colour in both themes.
 */
export function Wordmark({ imprint = true }: { imprint?: boolean }) {
  return (
    <span className="mark">
      <span className="mark__rb" aria-hidden="true" />
      <span className="mark__text">
        <span className="mark__name">
          <span className="mark__renn">Renn</span> Bros
        </span>
        {imprint && <span className="mark__imprint">{business.tagline}</span>}
      </span>
    </span>
  );
}
