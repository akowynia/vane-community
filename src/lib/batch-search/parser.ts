import { BatchQueryItem, HeaderFormatType } from './types';

function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 5);
  let semicolonCount = 0;
  let commaCount = 0;
  let tabCount = 0;

  for (const line of firstLines) {
    semicolonCount += (line.match(/;/g) || []).length;
    commaCount += (line.match(/,/g) || []).length;
    tabCount += (line.match(/\t/g) || []).length;
  }

  if (semicolonCount >= commaCount && semicolonCount >= tabCount && semicolonCount > 0) {
    return ';';
  }
  if (commaCount > semicolonCount && commaCount >= tabCount) {
    return ',';
  }
  if (tabCount > 0) {
    return '\t';
  }
  return ';';
}

function splitRow(rowText: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      if (inQuotes && rowText[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function isHeaderRow(col1: string, col2: string): boolean {
  const lower1 = col1.toLowerCase().trim();
  const lower2 = col2.toLowerCase().trim();

  const isCol1Header =
    lower1 === 'nr' ||
    lower1 === 'id' ||
    lower1 === 'no' ||
    lower1 === 'no.' ||
    lower1 === 'number' ||
    lower1 === 'lp' ||
    lower1 === 'lp.';

  const isCol2Header =
    lower2.includes('pytanie') ||
    lower2.includes('pojęci') ||
    lower2.includes('question') ||
    lower2.includes('concept') ||
    lower2.includes('query') ||
    lower2.includes('topic') ||
    lower2.includes('prompt');

  return isCol1Header || (isNaN(Number(lower1)) && isCol2Header);
}

export function parseCsvInput(
  rawText: string,
  defaultSources: string[] = ['web'],
  defaultOptimization: 'speed' | 'balanced' | 'quality' = 'balanced',
  defaultModelKey?: string,
  defaultProviderId?: string,
): BatchQueryItem[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const delimiter = detectDelimiter(rawText);
  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: BatchQueryItem[] = [];

  let autoIndex = 1;

  for (let idx = 0; idx < rawLines.length; idx++) {
    const line = rawLines[idx];
    const columns = splitRow(line, delimiter);

    if (columns.length === 0) continue;

    let itemNumber = '';
    let queryText = '';
    let itemOptimization = defaultOptimization;

    if (columns.length === 1) {
      itemNumber = String(autoIndex++);
      queryText = columns[0].replace(/^["']|["']$/g, '').trim();
    } else {
      const firstCol = columns[0].replace(/^["']|["']$/g, '').trim();
      let restCols = columns.slice(1).join(' ').replace(/^["']|["']$/g, '').trim();

      if (idx === 0 && isHeaderRow(firstCol, restCols)) {
        continue;
      }

      itemNumber = firstCol || String(autoIndex++);
      queryText = restCols;

      // Check if 3rd column specifies optimization mode
      if (columns.length >= 3) {
        const lastCol = columns[columns.length - 1].toLowerCase().trim();
        if (['speed', 'szybki'].includes(lastCol)) {
          itemOptimization = 'speed';
          queryText = columns.slice(1, -1).join(' ').replace(/^["']|["']$/g, '').trim();
        } else if (['balanced', 'zrównoważony', 'zrownowazony'].includes(lastCol)) {
          itemOptimization = 'balanced';
          queryText = columns.slice(1, -1).join(' ').replace(/^["']|["']$/g, '').trim();
        } else if (['quality', 'jakość', 'jakosc'].includes(lastCol)) {
          itemOptimization = 'quality';
          queryText = columns.slice(1, -1).join(' ').replace(/^["']|["']$/g, '').trim();
        }
      }
    }

    if (!queryText) continue;

    items.push({
      id: `query_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      number: itemNumber,
      query: queryText,
      sources: [...defaultSources],
      optimizationMode: itemOptimization,
      modelKey: defaultModelKey,
      providerId: defaultProviderId,
      selected: true,
      status: 'pending',
    });
  }

  return items;
}

export function generateSampleCsv(): string {
  return [
    'nr;pytanie / pojęcia',
    '1;Architektura transformerów i mechanizm Multi-Head Attention w LLM',
    '2;Kwantowa supremacja i fizyczna realizacja kubitów',
    '3;Algorytmy konsensusu w sieciach rozproszonych (Raft vs Paxos)',
    '4;Zero-Knowledge Proofs (zk-SNARKs i zk-STARKs) w kryptografii',
    '5;Ekspresja genów i regulacja transkrypcji w komórkach eukariotycznych',
  ].join('\n');
}

export function compileDocument(
  items: BatchQueryItem[],
  headerFormat: HeaderFormatType = 'query_number',
  includeSources: boolean = false,
): string {
  const sections: string[] = [];

  for (const item of items) {
    if (!item.response && item.status !== 'completed') continue;

    const formattedHeader =
      headerFormat === 'query_number'
        ? `${item.query} [${item.number}]`
        : `[${item.number}] ${item.query}`;

    let sectionContent = `# ${formattedHeader}\n\n${(item.response || '').trim()}`;

    if (includeSources && item.sourcesList && item.sourcesList.length > 0) {
      const sourceLinks = item.sourcesList
        .filter((s) => s.url)
        .map((s, i) => `- [${s.title || s.url}](${s.url})`)
        .join('\n');

      if (sourceLinks) {
        sectionContent += `\n\n### References & Sources:\n${sourceLinks}`;
      }
    }

    sections.push(sectionContent);
  }

  return sections.join('\n\n---\n\n');
}

export function exportToCsv(items: BatchQueryItem[]): string {
  const rows = ['nr;pytanie / pojęcia;treść notatki'];

  for (const item of items) {
    const escapedNumber = `"${(item.number || '').replace(/"/g, '""')}"`;
    const escapedQuery = `"${(item.query || '').replace(/"/g, '""')}"`;
    const escapedResponse = `"${(item.response || '').replace(/"/g, '""')}"`;
    rows.push(`${escapedNumber};${escapedQuery};${escapedResponse}`);
  }

  return rows.join('\n');
}
