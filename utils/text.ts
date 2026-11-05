/**
 * Keep generated text to one readable paragraph: the first paragraph only, cut at a sentence
 * boundary when it runs past `maxChars` (older scans were stored with long, multi-paragraph text).
 */
export function oneParagraph(text: string | undefined | null, maxChars = 320): string {
  if (!text) return '';
  const first = text.trim().split(/\n\s*\n|\n/)[0].trim();
  if (first.length <= maxChars) return first;
  const sentences = first.match(/[^.!?…]+[.!?…]+["'”»)]?\s*/g) ?? [first];
  let out = '';
  for (const s of sentences) {
    if ((out + s).trim().length > maxChars) break;
    out += s;
  }
  out = out.trim();
  if (out) return out;
  // a single very long sentence: cut at a word boundary
  return `${first.slice(0, maxChars).replace(/\s+\S*$/, '')}…`;
}
