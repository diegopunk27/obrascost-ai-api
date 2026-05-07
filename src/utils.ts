export function extractJsonBlock(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start === -1 || end === 0) return {};
  try {
    return JSON.parse(text.slice(start, end)) as Record<string, unknown>;
  } catch {
    return {};
  }
}
