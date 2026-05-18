// ── Color palette ──────────────────────────────────────────────────────────
export const C = {
  primary:   "#ff7a8a",   // rose pink — main CTA, highlights
  secondary: "#B9A7FF",   // lavender — macro protein, secondary accent
  bg:        "#FFF7F1",   // warm off-white — screen background
  card:      "#FFFFFF",   // pure white — card surfaces
  accent:    "#FFC6A8",   // peach — macro carbs, moderate health
  success:   "#54D6A1",   // mint green — good health, positive
  text:      "#2D1B35",   // deep plum — primary text
  muted:     "#8C748E",   // dusty mauve — secondary text / labels
  border:    "#FFE3E4",   // blush — card borders, dividers
  fill:      "#FFF1F2",   // light blush — input / inner backgrounds
  error:     "#f93a56",   // bright red — over-goal, errors
} as const;

// ── Font families (loaded via @expo-google-fonts/nunito-sans) ──────────────
export const F = {
  regular:   "NunitoSans_400Regular",
  semibold:  "NunitoSans_600SemiBold",
  bold:      "NunitoSans_700Bold",
  extrabold: "NunitoSans_800ExtraBold",
} as const;

// ── Health score → color ────────────────────────────────────────────────────
export function healthColor(score: number): string {
  if (score >= 70) return C.success;
  if (score >= 40) return C.accent;
  return C.error;
}
