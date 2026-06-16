export function sanitizeText(input: string): string {
  if (!input) return input;
  let out = input.replace(/<[^>]*>/g, "");
  out = out.replace(/javascript\s*:/gi, "");
  out = out.replace(/data\s*:/gi, "");
  return out.trim();
}

export function sanitizeUrl(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return trimmed;
  } catch {
    return "";
  }
}

export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}
