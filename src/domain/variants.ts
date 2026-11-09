export const VARIANTS = {
  cybertruck: { label: "Cybertruck", w: 1024, h: 768 },
  model3: { label: "Model 3 (pre-Highland)", w: 1024, h: 1024 },
  "model3-2024-base": { label: "Model 3 2024+ Standard/Premium", w: 1024, h: 1024 },
  "model3-2024-performance": { label: "Model 3 2024+ Performance", w: 1024, h: 1024 },
  modely: { label: "Model Y (pre-Juniper)", w: 1024, h: 1024 },
  "modely-2025-base": { label: "Model Y 2025+ Standard", w: 1024, h: 1024 },
  "modely-2025-premium": { label: "Model Y 2025+ Premium", w: 1024, h: 1024 },
  "modely-2025-performance": { label: "Model Y 2025+ Performance", w: 1024, h: 1024 },
  "modely-l": { label: "Model Y L", w: 1024, h: 1024 },
  "models-2021": { label: "Model S 2021+", w: 1024, h: 1024 },
  "models-2025-plaid": { label: "Model S 2025+ Plaid", w: 1024, h: 1024 },
  "modelx-2021": { label: "Model X 2021+", w: 1024, h: 1024 },
} as const;

export type VariantId = keyof typeof VARIANTS;

export function templateUrl(variant: VariantId): string {
  return `https://github.com/teslamotors/custom-wraps/tree/master/${variant}`;
}
