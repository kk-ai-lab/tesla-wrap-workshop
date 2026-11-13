export type LaunchMode = "preview" | "public";

export function launchMode(value: string | undefined): LaunchMode {
  if (value === "true") {
    return "public";
  }
  if (value === undefined || value === "false") {
    return "preview";
  }
  throw new Error('PUBLIC_LAUNCH must be exactly "true" or "false" when set');
}
