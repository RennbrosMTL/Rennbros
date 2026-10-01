"use client";

import { Check, Plus } from "@phosphor-icons/react";
import { useVisit } from "@/lib/visit";

/** The menu's add button, anywhere a single service is shown. */
export function AddToVisit({ slug, add, added, name }: { slug: string; add: string; added: string; name: string }) {
  const { slugs, toggle } = useVisit();
  const on = slugs.includes(slug);
  return (
    <button type="button" className="dish__add" aria-pressed={on} aria-label={`${on ? added : add}: ${name}`} onClick={() => toggle(slug)}>
      <span className="dish__add-icon" aria-hidden>{on ? <Check size={16} weight="bold" /> : <Plus size={16} weight="bold" />}</span>
      <span>{on ? added : add}</span>
    </button>
  );
}
