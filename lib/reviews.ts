/**
 * Renn Bros — customer reviews.
 *
 * ⚠️  EVERY REVIEW BELOW IS A WRITTEN PLACEHOLDER. NONE OF THEM ARE REAL.
 *
 * They exist so the page can be designed and demonstrated with realistic
 * content. They MUST be replaced with genuine reviews before the site is
 * public: published invented testimonials are treated as deceptive marketing
 * under Canadian competition law, and for a business selling carefulness it is
 * the wrong risk to carry. `scripts/launch-guard.mjs` blocks a launch build
 * while `reviewsArePlaceholder` is true.
 *
 * Genuine reviews are published in the language they were written in; the
 * French text here is only because the placeholders are ours to translate.
 */
import type { Lang } from "@/lib/i18n";

export const reviewsArePlaceholder = true;

export type Review = {
  quote: Record<Lang, string>;
  name: string;
  town: string;
  placeholder: true;
};

export const reviews: Review[] = [
  {
    quote: {
      en: "Booked Thursday night, they were in the driveway Saturday morning. Brakes done before I'd finished my coffee. I didn't move the car once.",
      fr: "Réservé le jeudi soir, ils étaient dans l’entrée le samedi matin. Les freins faits avant que j’aie fini mon café. Je n’ai jamais déplacé la voiture.",
    },
    name: "D. Marchand",
    town: "Beaconsfield",
    placeholder: true,
  },
  {
    quote: {
      en: "Laid a mat down before they touched the wheel. Torqued everything to spec and showed me the readout. That's the part I'm paying for.",
      fr: "Un tapis au sol avant même de toucher la roue. Tout serré au couple prescrit, et on m’a montré les mesures. C’est pour ça que je paie.",
    },
    name: "S. Ferreira",
    town: "Baie-D'Urfé",
    placeholder: true,
  },
  {
    quote: {
      en: "I have three cars and no interest in spending Saturdays at a garage. This is the first service I've found that actually solves that.",
      fr: "J’ai trois voitures et aucune envie de passer mes samedis au garage. C’est le premier service qui règle vraiment ce problème.",
    },
    name: "A. Whitmore",
    town: "Hudson",
    placeholder: true,
  },
  {
    quote: {
      en: "Told me straight that the noise I described wasn't something they take on, and pointed me to someone who does. Booked them for the tires anyway.",
      fr: "On m’a dit franchement que le bruit que je décrivais n’était pas de leur ressort, et on m’a dirigé vers quelqu’un de compétent. Je les ai quand même pris pour les pneus.",
    },
    name: "M. Lapointe",
    town: "Kirkland",
    placeholder: true,
  },
  {
    quote: {
      en: "Seasonal swap at the office while I was in meetings. Text when they arrived, text when they were done, invoice in my inbox. Nothing to manage.",
      fr: "Changement de pneus au bureau pendant mes réunions. Un texto à l’arrivée, un autre à la fin, la facture dans ma boîte courriel. Rien à gérer.",
    },
    name: "R. Nasser",
    town: "Pointe-Claire",
    placeholder: true,
  },
  {
    quote: {
      en: "Cleaner than the shop I used to use, and the shop had a building. Everything came out of the van labelled and went back the same way.",
      fr: "Plus propre que le garage où j’allais avant, et pourtant ce garage avait un bâtiment. Tout est sorti du camion étiqueté et y est retourné de la même façon.",
    },
    name: "J. Carrière",
    town: "Vaudreuil-Dorion",
    placeholder: true,
  },
];

if (reviewsArePlaceholder && process.env.NODE_ENV === "production" && typeof window === "undefined") {
  console.warn(
    "\n⚠️  Renn Bros: reviews are still PLACEHOLDERS. " +
      "Do not launch publicly until lib/reviews.ts holds genuine reviews " +
      "and reviewsArePlaceholder is false.\n",
  );
}
