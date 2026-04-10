const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9])/g;
const ACTION_KEYWORD_BREAK =
  /([a-z0-9\)])\s+(?=(Understand|Learn|Study|Check|Go through|Add|Improve|Create|Test|Make sure|Use tools|Provide|Fix|Implement|Update|Review|Analyze|Ensure|Document|Validate)\b)/gi;
const PHASE_HEADER = /^phase\s*(\d+)\s*:\s*(.+)$/i;
const GENERIC_SECTION_HEADER = /^(Expected Result|Expected Outcome|Deliverables?|Notes?)\s*[:\-]?\s*(.*)$/i;

export type TaskBriefSection = {
  title: string;
  points: string[];
};

export type TaskBriefing = {
  intro: string[];
  sections: TaskBriefSection[];
};

export const normalizeTaskDescription = (input?: string): string => {
  if (!input) return "";
  const normalized = input
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ");

  return normalized
    .replace(/([^\n])\s+(?=Phase\s*\d+\s*:)/gi, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const taskDescriptionToLines = (input?: string): string[] => {
  const normalized = normalizeTaskDescription(input);
  if (!normalized) return [];

  const withBullets = normalized
    .replace(/\s*[•●]\s*/g, "\n• ")
    .replace(ACTION_KEYWORD_BREAK, "$1\n")
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

const splitHeadingAndRemainder = (value: string): { heading: string; remainder: string } => {
  const trimmed = value.trim();
  if (!trimmed) return { heading: "", remainder: "" };

  const keywordIndex = trimmed.search(
    /\s(?=Understand|Learn|Study|Check|Go through|Add|Improve|Create|Test|Make sure|Use tools|Provide|Fix|Implement|Update|Review|Analyze|Ensure|Document|Validate\b)/i
  );
  if (keywordIndex > 0) {
    return {
      heading: trimmed.slice(0, keywordIndex).trim(),
      remainder: trimmed.slice(keywordIndex).trim(),
    };
  }

  const sentenceBreakIndex = trimmed.search(/[.!?]\s+/);
  if (sentenceBreakIndex > 0) {
    return {
      heading: trimmed.slice(0, sentenceBreakIndex + 1).trim(),
      remainder: trimmed.slice(sentenceBreakIndex + 1).trim(),
    };
  }

  return { heading: trimmed, remainder: "" };
};

const splitLineIntoPoints = (line: string): string[] =>
  line
    .replace(ACTION_KEYWORD_BREAK, "$1\n")
    .split(/\n|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((part) => part.replace(/^[•-]\s*/, "").trim())
    .filter(Boolean);

export const buildTaskBriefing = (input?: string): TaskBriefing => {
  const lines = taskDescriptionToLines(input);
  const briefing: TaskBriefing = { intro: [], sections: [] };

  let currentSection: TaskBriefSection | null = null;

  const pushCurrentSection = () => {
    if (currentSection && (currentSection.title || currentSection.points.length > 0)) {
      briefing.sections.push(currentSection);
    }
    currentSection = null;
  };

  for (const line of lines) {
    const phaseMatch = line.match(PHASE_HEADER);
    if (phaseMatch) {
      pushCurrentSection();
      const phaseNumber = phaseMatch[1];
      const sectionContent = phaseMatch[2] || "";
      const { heading, remainder } = splitHeadingAndRemainder(sectionContent);
      currentSection = {
        title: heading ? `Phase ${phaseNumber}: ${heading}` : `Phase ${phaseNumber}`,
        points: remainder ? splitLineIntoPoints(remainder) : [],
      };
      continue;
    }

    const genericMatch = line.match(GENERIC_SECTION_HEADER);
    if (genericMatch) {
      pushCurrentSection();
      const title = genericMatch[1].trim();
      const remainder = (genericMatch[2] || "").trim();
      currentSection = {
        title,
        points: remainder ? splitLineIntoPoints(remainder) : [],
      };
      continue;
    }

    const points = splitLineIntoPoints(line);
    if (currentSection) {
      currentSection.points.push(...points);
    } else {
      briefing.intro.push(...points);
    }
  }

  pushCurrentSection();
  return briefing;
};
