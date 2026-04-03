const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9])/g;

export const normalizeTaskDescription = (input?: string): string => {
  if (!input) return "";
  return input.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
};

export const taskDescriptionToLines = (input?: string): string[] => {
  const normalized = normalizeTaskDescription(input);
  if (!normalized) return [];

  const withBullets = normalized
    .replace(/\s*[•●]\s*/g, "\n• ")
    .replace(/\n{3,}/g, "\n\n");

  const rawLines = withBullets.includes("\n")
    ? withBullets.split("\n")
    : withBullets.split(SENTENCE_BREAK);

  return rawLines
    .map((line) => line.trim())
    .filter(Boolean);
};

export const taskDescriptionPreview = (input?: string, lineLimit = 4): string =>
  taskDescriptionToLines(input).slice(0, lineLimit).join("\n");

export const taskDescriptionParagraphs = (input?: string, sentenceChunk = 3): string[] => {
  const lines = taskDescriptionToLines(input);
  if (lines.length === 0) return [];

  const hasBullets = lines.some((line) => line.startsWith("•") || line.startsWith("-"));
  if (hasBullets) return lines;

  const size = Math.max(1, sentenceChunk);
  const paragraphs: string[] = [];
  for (let index = 0; index < lines.length; index += size) {
    paragraphs.push(lines.slice(index, index + size).join(" "));
  }
  return paragraphs;
};

