import JSZip from 'jszip';

export interface DocxSectionItem {
  title: string;
  subtitle?: string;
  date?: string;
  content: string; // Plain text or markdown
  sources?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface DocxExportOptions {
  documentTitle: string;
  sections: DocxSectionItem[];
  includeSources?: boolean;
  includeMetadata?: boolean;
  author?: string;
  creator?: string;
}

const escapeXml = (str: any): string => {
  if (str === null || str === undefined) return '';
  const text = typeof str === 'string' ? str : String(str);
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const cleanMarkdownForDocx = (md: string): string => {
  if (!md) return '';
  return md
    .replace(/<(think|thought|thinking)>[\s\S]*?<\/\1>/gi, '')
    .trim();
};

/**
 * Creates OpenXML content for paragraphs from a markdown/text string.
 */
const markdownToDocxParagraphs = (rawContent: string): string => {
  const content = cleanMarkdownForDocx(rawContent);
  if (!content) {
    return '<w:p><w:r><w:t></w:t></w:r></w:p>';
  }

  const lines = content.split('\n');
  const paragraphs: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  const flushCodeBuffer = () => {
    if (codeBuffer.length === 0) return;
    for (const codeLine of codeBuffer) {
      paragraphs.push(`
        <w:p>
          <w:pPr>
            <w:pBdr>
              <w:left w:val="single" w:sz="18" w:space="8" w:color="B8864D"/>
            </w:pBdr>
            <w:shd w:val="clear" w:color="auto" w:fill="F5F3EF"/>
            <w:ind w:left="360" w:right="360"/>
            <w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>
              <w:color w:val="2D251D"/>
              <w:sz w:val="19"/>
            </w:rPr>
            <w:t xml:space="preserve">${escapeXml(codeLine)}</w:t>
          </w:r>
        </w:p>
      `);
    }
    codeBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    // Code block toggle
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBuffer();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Empty lines create spaced separation
    if (!trimmed) {
      paragraphs.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="100" w:after="100"/>
          </w:pPr>
        </w:p>
      `);
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      paragraphs.push(`
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading1"/>
            <w:spacing w:before="360" w:after="160"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:color w:val="1A1510"/>
              <w:sz w:val="34"/>
            </w:rPr>
            <w:t>${escapeXml(trimmed.replace(/^#\s+/, ''))}</w:t>
          </w:r>
        </w:p>
      `);
      continue;
    }

    if (trimmed.startsWith('## ')) {
      paragraphs.push(`
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading2"/>
            <w:spacing w:before="280" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:color w:val="B8864D"/>
              <w:sz w:val="28"/>
            </w:rPr>
            <w:t>${escapeXml(trimmed.replace(/^##\s+/, ''))}</w:t>
          </w:r>
        </w:p>
      `);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      paragraphs.push(`
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading3"/>
            <w:spacing w:before="200" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:color w:val="332C24"/>
              <w:sz w:val="24"/>
            </w:rPr>
            <w:t>${escapeXml(trimmed.replace(/^###\s+/, ''))}</w:t>
          </w:r>
        </w:p>
      `);
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith('> ')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      paragraphs.push(`
        <w:p>
          <w:pPr>
            <w:pBdr>
              <w:left w:val="single" w:sz="24" w:space="12" w:color="B8864D"/>
            </w:pBdr>
            <w:ind w:left="400"/>
            <w:spacing w:before="120" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:i/>
              <w:color w:val="574B3E"/>
              <w:sz w:val="22"/>
            </w:rPr>
            <w:t>${escapeXml(quoteText)}</w:t>
          </w:r>
        </w:p>
      `);
      continue;
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      paragraphs.push(`
        <w:p>
          <w:pPr>
            <w:pBdr>
              <w:bottom w:val="single" w:sz="8" w:space="12" w:color="E0D9D0"/>
            </w:pBdr>
            <w:spacing w:before="200" w:after="200"/>
          </w:pPr>
        </w:p>
      `);
      continue;
    }

    // List item (bullet or numbered)
    const isBullet = /^[-*+]\s+/.test(trimmed);
    const isNumbered = /^\d+\.\s+/.test(trimmed);

    if (isBullet || isNumbered) {
      const listContent = trimmed.replace(/^([-*+]|\d+\.)\s+/, '');
      paragraphs.push(`
        <w:p>
          <w:pPr>
            <w:ind w:left="480" w:hanging="240"/>
            <w:spacing w:before="60" w:after="60"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:color w:val="B8864D"/>
            </w:rPr>
            <w:t xml:space="preserve">${isBullet ? '•   ' : trimmed.match(/^\d+\./)?.[0] + '  '}</w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:color w:val="2B2520"/>
              <w:sz w:val="22"/>
            </w:rPr>
            <w:t>${escapeXml(listContent)}</w:t>
          </w:r>
        </w:p>
      `);
      continue;
    }

    // Standard paragraph with inline formatting
    paragraphs.push(`
      <w:p>
        <w:pPr>
          <w:spacing w:before="80" w:after="80" w:line="276" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:color w:val="2B2520"/>
            <w:sz w:val="22"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(trimmed)}</w:t>
        </w:r>
      </w:p>
    `);
  }

  flushCodeBuffer();
  return paragraphs.join('\n');
};

/**
 * Builds the complete OpenXML DOCX document package using JSZip.
 */
export async function generateDocxBlob(options: DocxExportOptions): Promise<Blob> {
  const {
    documentTitle,
    sections,
    includeSources = true,
    includeMetadata = true,
    author = 'Artur Kowynia',
  } = options;

  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`,
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
  );

  // 3. docProps/core.xml
  const nowIso = new Date().toISOString();
  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(documentTitle)}</dc:title>
  <dc:creator>${escapeXml(author)}</dc:creator>
  <cp:lastModifiedBy>${escapeXml(author)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified>
</cp:coreProperties>`,
  );

  // 4. word/styles.xml
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="34"/>
      <w:color w:val="1A1510"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:color w:val="B8864D"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:color w:val="332C24"/>
    </w:rPr>
  </w:style>
</w:styles>`,
  );

  // 5. word/document.xml
  const bodyXmlParts: string[] = [];

  // Document Cover / Master Header
  bodyXmlParts.push(`
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:color w:val="B8864D"/>
          <w:sz w:val="42"/>
        </w:rPr>
        <w:t>${escapeXml(documentTitle)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="60" w:after="300"/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="14" w:color="B8864D"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:i/>
          <w:color w:val="78716C"/>
          <w:sz w:val="20"/>
        </w:rPr>
        <w:t>Vane - Community • ${new Date().toLocaleDateString()} • Items: ${sections.length}</w:t>
      </w:r>
    </w:p>
  `);

  // Iterate over individual sections / items
  for (let idx = 0; idx < sections.length; idx++) {
    const section = sections[idx];

    // If not first section, insert page break for clean separation
    if (idx > 0) {
      bodyXmlParts.push(`
        <w:p>
          <w:r>
            <w:br w:type="page"/>
          </w:r>
        </w:p>
      `);
    }

    // Section Title
    bodyXmlParts.push(`
      <w:p>
        <w:pPr>
          <w:pStyle w:val="Heading2"/>
          <w:spacing w:before="240" w:after="100"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:color w:val="B8864D"/>
            <w:sz w:val="30"/>
          </w:rPr>
          <w:t>[${idx + 1}] ${escapeXml(section.title)}</w:t>
        </w:r>
      </w:p>
    `);

    // Metadata line if present and enabled
    if (includeMetadata && (section.date || section.subtitle)) {
      const metaText = [section.date, section.subtitle].filter(Boolean).join(' • ');
      bodyXmlParts.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="40" w:after="160"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:color w:val="8A7E72"/>
              <w:sz w:val="18"/>
            </w:rPr>
            <w:t>${escapeXml(metaText)}</w:t>
          </w:r>
        </w:p>
      `);
    }

    // Main section paragraphs
    bodyXmlParts.push(markdownToDocxParagraphs(section.content));

    // Optional Sources & References
    if (includeSources && section.sources && section.sources.length > 0) {
      bodyXmlParts.push(`
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading3"/>
            <w:spacing w:before="240" w:after="100"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:color w:val="78716C"/>
              <w:sz w:val="22"/>
            </w:rPr>
            <w:t>Sources and References (${section.sources.length})</w:t>
          </w:r>
        </w:p>
      `);

      for (let sIdx = 0; sIdx < section.sources.length; sIdx++) {
        const src = section.sources[sIdx];
        const srcTitle = src.title || src.url || `Source ${sIdx + 1}`;
        bodyXmlParts.push(`
          <w:p>
            <w:pPr>
              <w:ind w:left="360" w:hanging="240"/>
              <w:spacing w:before="40" w:after="40"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:b/>
                <w:color w:val="B8864D"/>
              </w:rPr>
              <w:t>[${sIdx + 1}] </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:color w:val="2D251D"/>
                <w:u w:val="single"/>
              </w:rPr>
              <w:t>${escapeXml(srcTitle)}</w:t>
            </w:r>
            ${src.url ? `
              <w:r>
                <w:rPr>
                  <w:color w:val="8A7E72"/>
                  <w:sz w:val="18"/>
                </w:rPr>
                <w:t xml:space="preserve"> (${escapeXml(src.url)})</w:t>
              </w:r>
            ` : ''}
          </w:p>
        `);
      }
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyXmlParts.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

