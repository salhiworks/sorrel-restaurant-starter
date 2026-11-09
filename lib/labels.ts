import type { Allergen, DietaryTag } from "./types"

export const DIETARY_LABELS: Record<DietaryTag, { label: string; short: string }> = {
  vegetarian: { label: "Vegetarian", short: "V" },
  vegan: { label: "Vegan", short: "VG" },
  "gluten-free": { label: "Gluten-free", short: "GF" },
  "dairy-free": { label: "Dairy-free", short: "DF" },
  spicy: { label: "Spicy", short: "Hot" },
}

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten",
  crustaceans: "Crustaceans",
  eggs: "Eggs",
  fish: "Fish",
  peanuts: "Peanuts",
  soy: "Soy",
  milk: "Milk",
  nuts: "Tree nuts",
  celery: "Celery",
  mustard: "Mustard",
  sesame: "Sesame",
  sulphites: "Sulphites",
  lupin: "Lupin",
  molluscs: "Molluscs",
}
