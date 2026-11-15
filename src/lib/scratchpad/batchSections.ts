export interface BatchSection {
  id: string;
  index: number;
  number: string;
  title: string;
  header: string;
  content: string;
  body: string;
}

export function parseBatchSections(rawContent: string): BatchSection[] {
  if (!rawContent || !rawContent.trim()) {
    return [];
  }

  const normalized = rawContent.replace(/\r\n/g, '\n');

  let rawChunks: string[] = [];

  if (/\n\s*---\s*\n(?=#\s)/.test(normalized)) {
    rawChunks = normalized.split(/\n\s*---\s*\n(?=#\s)/).filter((c) => c.trim().length > 0);
  } else if (/(?:^|\n)(?=#\s+[^\n]+)/.test(normalized)) {
    rawChunks = normalized
      .split(/(?:^|\n)(?=#\s+[^\n]+)/)
      .map((c) => c.replace(/^\s*---\s*\n*/, '').trim())
      .filter((c) => c.length > 0);
  } else if (/\n\s*---\s*\n/.test(normalized)) {
    rawChunks = normalized.split(/\n\s*---\s*\n/).filter((c) => c.trim().length > 0);
  } else {
    rawChunks = [normalized.trim()];
  }

  return rawChunks.map((chunk, idx) => {
    const trimmedChunk = chunk.trim();
    const lines = trimmedChunk.split('\n');
    let header = '';
    let body = trimmedChunk;

    if (lines.length > 0 && lines[0].trim().startsWith('#')) {
      header = lines[0].trim();
      body = lines.slice(1).join('\n').trim();
    }

    let parsedNumber = String(idx + 1);
    let parsedTitle = header.replace(/^#+\s*/, '').trim() || `Item ${idx + 1}`;

    const bracketPrefixMatch = header.match(/^#+\s*\[(\d+)\]\s*(.+)$/);
    const bracketSuffixMatch = header.match(/^#+\s*(.+?)\s*\[(\d+)\]$/);
    const dotNumberMatch = header.match(/^#+\s*(\d+)[\.\)]\s*(.+)$/);

    if (bracketPrefixMatch) {
      parsedNumber = bracketPrefixMatch[1].trim();
      parsedTitle = bracketPrefixMatch[2].trim();
    } else if (bracketSuffixMatch) {
      parsedNumber = bracketSuffixMatch[2].trim();
      parsedTitle = bracketSuffixMatch[1].trim();
    } else if (dotNumberMatch) {
      parsedNumber = dotNumberMatch[1].trim();
      parsedTitle = dotNumberMatch[2].trim();
    }

    return {
      id: `query-section-${idx}-${parsedNumber}`,
      index: idx,
      number: parsedNumber,
      title: parsedTitle,
      header: header || `# [${parsedNumber}] ${parsedTitle}`,
      content: trimmedChunk,
      body,
    };
  });
}

export function reconstructBatchDocument(sections: BatchSection[]): string {
  if (!sections || sections.length === 0) {
    return '';
  }
  return sections.map((s) => s.content.trim()).join('\n\n---\n\n');
}

export function replaceBatchSection(
  fullMarkdown: string,
  sectionIndex: number,
  newSectionText: string,
): string {
  const sections = parseBatchSections(fullMarkdown);
  if (sectionIndex < 0 || sectionIndex >= sections.length) {
    return fullMarkdown;
  }

  const target = sections[sectionIndex];
  const cleanedNew = newSectionText.trim();

  let updatedContent = cleanedNew;
  if (!cleanedNew.startsWith('#')) {
    updatedContent = `${target.header}\n\n${cleanedNew}`;
  }

  sections[sectionIndex] = {
    ...target,
    content: updatedContent,
    body: cleanedNew.startsWith('#')
      ? cleanedNew.split('\n').slice(1).join('\n').trim()
      : cleanedNew,
  };

  return reconstructBatchDocument(sections);
}

export function findSectionIndexBySnippet(
  sections: BatchSection[],
  snippet: string,
): number {
  if (!snippet || !snippet.trim() || sections.length === 0) {
    return -1;
  }

  const cleanSnippet = snippet.trim();

  for (let i = 0; i < sections.length; i++) {
    if (sections[i].content.includes(cleanSnippet)) {
      return i;
    }
  }

  const shortSnippet = cleanSnippet.slice(0, 50);
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].content.includes(shortSnippet)) {
      return i;
    }
  }

  return -1;
}

