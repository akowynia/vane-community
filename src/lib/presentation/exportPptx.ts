/**
 * Pure OpenXML (.pptx) presentation generator for Vane AI Slide Decks.
 * Uses JSZip (already present in project dependencies) without external locked dependencies.
 */

import JSZip from 'jszip';
import { ParsedSlide } from '@/components/Presentation/PresentationCanvas';

export interface ExportPptxOptions {
  title: string;
  slides: ParsedSlide[];
  theme?: string;
  sources?: any[];
  includeSpeakerNotes?: boolean;
  includeSources?: boolean;
}

interface ThemePalette {
  backgroundHex: string;
  cardBgHex: string;
  titleHex: string;
  textHex: string;
  accentHex: string;
  mutedHex: string;
}

const THEME_PALETTES: Record<string, ThemePalette> = {
  'dark-modern': {
    backgroundHex: '0B0F17',
    cardBgHex: '1E293B',
    titleHex: 'FFFFFF',
    textHex: 'CBD5E1',
    accentHex: '38BDF8',
    mutedHex: '64748B',
  },
  'minimal-light': {
    backgroundHex: 'F8FAFC',
    cardBgHex: 'FFFFFF',
    titleHex: '0F172A',
    textHex: '334155',
    accentHex: '2563EB',
    mutedHex: '94A3B8',
  },
  'cyber-tech': {
    backgroundHex: '050811',
    cardBgHex: '0B1329',
    titleHex: '22D3EE',
    textHex: '94A3B8',
    accentHex: '06B6D4',
    mutedHex: '475569',
  },
  'business-emerald': {
    backgroundHex: '03221A',
    cardBgHex: '064E3B',
    titleHex: '6EE7B7',
    textHex: 'A7F3D0',
    accentHex: '34D399',
    mutedHex: '059669',
  },
  'warm-gold': {
    backgroundHex: '14120E',
    cardBgHex: '292524',
    titleHex: 'FBBF24',
    textHex: 'D6D3D1',
    accentHex: 'F59E0B',
    mutedHex: '78716C',
  },
};

const xmlEscape = (str: any): string => {
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

const cleanMarkdownForSlide = (md: string): string[] => {
  if (!md) return [];
  const lines = md.split('\n');
  const points: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('```') || line.startsWith('<!--') || line.startsWith('#')) continue;

    // Ignore markdown table divider rows like | --- | :---: |
    if (/^\|?\s*[-:]+[-|\s:]*\|?$/.test(line)) continue;

    // Convert markdown table rows | A | B | into bullet points "A — B"
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cells.length > 0) {
        line = cells.join(' — ');
      }
    }

    line = line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
    // Strip bold & italic formatting
    line = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    // Strip markdown links [Text](url) -> Text
    line = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Strip HTML tags like <span> or <br>
    line = line.replace(/<[^>]*>/g, '');

    if (line.trim().length > 0) {
      points.push(line.trim());
    }
  }

  return points;
};

interface ParsedMdTable {
  columns: string[];
  rows: string[][];
}

const isTableSeparatorRow = (line: string): boolean =>
  /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());

const splitTableRowCells = (line: string): string[] => {
  let inner = line.trim();
  if (inner.startsWith('|')) inner = inner.slice(1);
  if (inner.endsWith('|')) inner = inner.slice(0, -1);
  return inner.split('|').map((c) => c.trim());
};

// Extracts standard markdown pipe-tables out of a slide's body markdown so they can be
// rendered as real OOXML tables instead of being flattened into "A — B — C" bullet lines.
const parseMarkdownTables = (markdown: string): { tables: ParsedMdTable[]; remaining: string } => {
  const lines = markdown.split('\n');
  const tables: ParsedMdTable[] = [];
  const outLines: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const next = (lines[i + 1] || '').trim();
    if (line.startsWith('|') && isTableSeparatorRow(next)) {
      const columns = splitTableRowCells(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        const cells = splitTableRowCells(lines[j]);
        rows.push(columns.map((_, idx) => cells[idx] ?? ''));
        j++;
      }
      tables.push({ columns, rows });
      i = j;
      continue;
    }
    outLines.push(lines[i]);
    i++;
  }
  return { tables, remaining: outLines.join('\n') };
};

const buildTableCellXml = (text: string, opts: { bold?: boolean; colorHex: string; fillHex: string; sz: number }): string => `
              <a:tc>
                <a:txBody>
                  <a:bodyPr wrap="square" lIns="45720" rIns="45720" tIns="22860" bIns="22860" anchor="ctr"/>
                  <a:lstStyle/>
                  <a:p>
                    <a:r>
                      <a:rPr lang="en-US" sz="${opts.sz}"${opts.bold ? ' b="1"' : ''}>
                        <a:solidFill><a:srgbClr val="${opts.colorHex}"/></a:solidFill>
                      </a:rPr>
                      <a:t>${xmlEscape(text)}</a:t>
                    </a:r>
                  </a:p>
                </a:txBody>
                <a:tcPr><a:solidFill><a:srgbClr val="${opts.fillHex}"/></a:solidFill></a:tcPr>
              </a:tc>`;

const buildTableGraphicFrameXml = (
  table: ParsedMdTable,
  id: number,
  x: number,
  y: number,
  cx: number,
  cy: number,
  palette: ThemePalette,
): string => {
  const colCount = Math.max(table.columns.length, 1);
  const colWidth = Math.floor(cx / colCount);
  const headerH = 500000;
  const dataRowCount = Math.max(table.rows.length, 1);
  const dataH = Math.max(380000, Math.floor((cy - headerH) / dataRowCount));

  const gridCols = table.columns.map(() => `<a:gridCol w="${colWidth}"/>`).join('');

  const headerCells = table.columns
    .map((c) => buildTableCellXml(c, { bold: true, colorHex: palette.titleHex, fillHex: palette.accentHex, sz: 1100 }))
    .join('');
  const headerRow = `<a:tr h="${headerH}">${headerCells}</a:tr>`;

  const dataRows = table.rows
    .map((row, rIdx) => {
      const fillHex = rIdx % 2 === 0 ? palette.cardBgHex : palette.backgroundHex;
      const cells = row.map((cell) => buildTableCellXml(cell, { colorHex: palette.textHex, fillHex, sz: 1000 })).join('');
      return `<a:tr h="${dataH}">${cells}</a:tr>`;
    })
    .join('');

  return `
      <p:graphicFrame>
        <p:nvGraphicFramePr>
          <p:cNvPr id="${id}" name="Table"/>
          <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
          <p:nvPr/>
        </p:nvGraphicFramePr>
        <p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblPr firstRow="1" bandRow="1"/>
              <a:tblGrid>${gridCols}</a:tblGrid>
              ${headerRow}
              ${dataRows}
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>`;
};

export const exportPresentationToPptx = async (options: ExportPptxOptions): Promise<void> => {
  const {
    title,
    slides,
    theme = 'dark-modern',
    sources = [],
    includeSpeakerNotes = true,
    includeSources = true,
  } = options;

  const palette = THEME_PALETTES[theme] || THEME_PALETTES['dark-modern'];

  // Initialize JSZip instance
  const JSZipConstructor = (JSZip as any).default || JSZip;
  const zip = new JSZipConstructor();

  // Slide dimensions 16:9 in EMUs: 12,192,000 x 6,858,000 (13.333" x 7.5")
  const totalSlidesCount = slides.length + (includeSources && sources.length > 0 ? 2 : 1); // Cover + slides + optional biblio

  // Helper to validate and add XML file to zip
  const validateAndAddXml = (path: string, xmlContent: string) => {
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'application/xml');
        const parserErrors = doc.getElementsByTagName('parsererror');
        if (parserErrors.length > 0 || doc.documentElement?.nodeName === 'parsererror') {
          const errorMsg = parserErrors[0]?.textContent || doc.documentElement?.textContent || 'XML syntax error';
          console.warn(`[PPTX Validator Warning] ${path}:`, errorMsg);
        }
      } catch (parseErr) {
        console.warn(`[PPTX Validator Warning] ${path}:`, parseErr);
      }
    }
    zip.file(path, xmlContent);
  };

  // 1. [Content_Types].xml
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
`;

  for (let i = 1; i <= totalSlidesCount; i++) {
    contentTypesXml += `  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`;
    if (includeSpeakerNotes) {
      contentTypesXml += `  <Override PartName="/ppt/notesSlides/notesSlide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>\n`;
    }
  }
  contentTypesXml += `</Types>`;
  validateAndAddXml('[Content_Types].xml', contentTypesXml);

  // 2. _rels/.rels
  validateAndAddXml(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  );

  // 3. ppt/theme/theme1.xml
  const themeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Vane Theme">
  <a:themeElements>
    <a:clrScheme name="Vane">
      <a:dk1><a:srgbClr val="${palette.backgroundHex}"/></a:dk1>
      <a:lt1><a:srgbClr val="${palette.titleHex}"/></a:lt1>
      <a:dk2><a:srgbClr val="${palette.cardBgHex}"/></a:dk2>
      <a:lt2><a:srgbClr val="${palette.textHex}"/></a:lt2>
      <a:accent1><a:srgbClr val="${palette.accentHex}"/></a:accent1>
      <a:accent2><a:srgbClr val="38BDF8"/></a:accent2>
      <a:accent3><a:srgbClr val="34D399"/></a:accent3>
      <a:accent4><a:srgbClr val="FBBF24"/></a:accent4>
      <a:accent5><a:srgbClr val="F87171"/></a:accent5>
      <a:accent6><a:srgbClr val="A78BFA"/></a:accent6>
      <a:hlink><a:srgbClr val="${palette.accentHex}"/></a:hlink>
      <a:folHlink><a:srgbClr val="${palette.accentHex}"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Vane">
      <a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Vane">
      <a:fillStyleLst><a:solidFill><a:srgbClr val="${palette.backgroundHex}"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="12700"><a:solidFill><a:srgbClr val="${palette.accentHex}"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:srgbClr val="${palette.backgroundHex}"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;
  validateAndAddXml('ppt/theme/theme1.xml', themeXml);

  // 4. ppt/slideMasters/slideMaster1.xml and rels
  const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
    <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rIdLayout1"/>
  </p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle>
      <a:lvl1pPr algn="l">
        <a:defRPr sz="4400" kern="1200">
          <a:solidFill><a:schemeClr val="tx1"/></a:solidFill>
          <a:latin typeface="+mj-lt"/>
        </a:defRPr>
      </a:lvl1pPr>
    </p:titleStyle>
    <p:bodyStyle>
      <a:lvl1pPr algn="l">
        <a:defRPr sz="2000" kern="1200">
          <a:solidFill><a:schemeClr val="tx2"/></a:solidFill>
          <a:latin typeface="+mn-lt"/>
        </a:defRPr>
      </a:lvl1pPr>
    </p:bodyStyle>
    <p:otherStyle>
      <a:defPPr>
        <a:defRPr lang="en-US"/>
      </a:defPPr>
    </p:otherStyle>
  </p:txStyles>
</p:sldMaster>`;
  validateAndAddXml('ppt/slideMasters/slideMaster1.xml', slideMasterXml);

  validateAndAddXml(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdTheme1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
  );

  // 5. ppt/slideLayouts/slideLayout1.xml and rels
  const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
  validateAndAddXml('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml);

  validateAndAddXml(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
  );

  // 6. ppt/_rels/presentation.xml.rels
  let presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
`;
  for (let i = 1; i <= totalSlidesCount; i++) {
    presRelsXml += `  <Relationship Id="rIdSlide${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>\n`;
  }
  presRelsXml += `</Relationships>`;
  validateAndAddXml('ppt/_rels/presentation.xml.rels', presRelsXml);

  // 7. ppt/presentation.xml
  let presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rIdMaster1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
`;
  for (let i = 1; i <= totalSlidesCount; i++) {
    presentationXml += `    <p:sldId id="${255 + i}" r:id="rIdSlide${i}"/>\n`;
  }
  presentationXml += `  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
  validateAndAddXml('ppt/presentation.xml', presentationXml);

  // Helper to generate notesSlide XML and rels
  const createNotesSlide = (slideIndex: number, notesText: string) => {
    const notesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="3429000"/><a:ext cx="5943600" cy="5257800"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1200"/>
              <a:t>${xmlEscape(notesText)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:notes>`;

    const notesRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideIndex}.xml"/>
</Relationships>`;

    validateAndAddXml(`ppt/notesSlides/notesSlide${slideIndex}.xml`, notesXml);
    validateAndAddXml(`ppt/notesSlides/_rels/notesSlide${slideIndex}.xml.rels`, notesRelsXml);
  };

  // Helper to create slide rels linking to slideLayout1 and optional notesSlide
  const createSlideRels = (slideIndex: number, hasNotes: boolean) => {
    let rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
`;
    if (hasNotes) {
      rels += `  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${slideIndex}.xml"/>\n`;
    }
    rels += `</Relationships>`;
    validateAndAddXml(`ppt/slides/_rels/slide${slideIndex}.xml.rels`, rels);
  };

  // 5. SLIDE 1: COVER SLIDE
  const coverSlideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      
      <!-- Background Solid Fill -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Background"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${palette.backgroundHex}"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <!-- Decorative Accent Line -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="AccentLine"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="2000000"/><a:ext cx="120000" cy="2800000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${palette.accentHex}"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <!-- Cover Badge & Title & Subtitle -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="TitleBox"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1200000" y="1800000"/><a:ext cx="10000000" cy="3500000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <!-- Badge -->
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1300" b="1">
                <a:solidFill><a:srgbClr val="${palette.accentHex}"/></a:solidFill>
              </a:rPr>
              <a:t>PRESENTATION • VANE AI</a:t>
            </a:r>
          </a:p>
          <!-- Main Title -->
          <a:p>
            <a:pPr spaceBefore="150000"/>
            <a:r>
              <a:rPr lang="en-US" sz="3600" b="1">
                <a:solidFill><a:srgbClr val="${palette.titleHex}"/></a:solidFill>
              </a:rPr>
              <a:t>${xmlEscape(title || 'AI Presentation')}</a:t>
            </a:r>
          </a:p>
          <!-- Subtitle / Meta -->
          <a:p>
            <a:pPr spaceBefore="200000"/>
            <a:r>
              <a:rPr lang="en-US" sz="1400">
                <a:solidFill><a:srgbClr val="${palette.textHex}"/></a:solidFill>
              </a:rPr>
              <a:t>Slides: ${slides.length}  |  Generated by Vane AI  |  ${new Date().toLocaleDateString('en-US')}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
  validateAndAddXml('ppt/slides/slide1.xml', coverSlideXml);
  createSlideRels(1, includeSpeakerNotes);
  if (includeSpeakerNotes) {
    createNotesSlide(1, `Introduction to the presentation: ${title}`);
  }

  // 6. CONTENT SLIDES (Slide 2 .. N+1)
  slides.forEach((slideItem, sIdx) => {
    const slideNumber = sIdx + 2;
    // Pull real markdown tables out first so they render as native OOXML tables instead
    // of being flattened into "A — B — C" bullet lines.
    const { tables, remaining: bulletsMarkdown } = parseMarkdownTables(slideItem.bodyMarkdown);
    const bulletPoints = cleanMarkdownForSlide(bulletsMarkdown);
    const hasTables = tables.length > 0;
    const hasCharts = !!(slideItem.charts && slideItem.charts.length > 0);

    // Build XML paragraphs for bullet points
    let bodyParagraphsXml = '';
    if (bulletPoints.length > 0) {
      bulletPoints.forEach((point) => {
        bodyParagraphsXml += `
          <a:p>
            <a:pPr marL="285750" indent="-285750" spaceBefore="120000">
              <a:buClr><a:srgbClr val="${palette.accentHex}"/></a:buClr>
              <a:buSzPct val="80000"/>
              <a:buChar char="•"/>
            </a:pPr>
            <a:r>
              <a:rPr lang="en-US" sz="1500">
                <a:solidFill><a:srgbClr val="${palette.textHex}"/></a:solidFill>
              </a:rPr>
              <a:t>${xmlEscape(point)}</a:t>
            </a:r>
          </a:p>`;
      });
    } else if (!hasTables) {
      // Only fall back to a raw dump when there's truly no structured content to show —
      // never when a table was extracted, or its markdown would leak back in as text.
      bodyParagraphsXml = `
        <a:p>
          <a:r>
            <a:rPr lang="en-US" sz="1500">
              <a:solidFill><a:srgbClr val="${palette.textHex}"/></a:solidFill>
            </a:rPr>
            <a:t>${xmlEscape(slideItem.bodyMarkdown)}</a:t>
          </a:r>
        </a:p>`;
    }

    // Chart text summary box if chart exists
    let chartBoxXml = '';
    if (slideItem.charts && slideItem.charts.length > 0) {
      const chart = slideItem.charts[0];
      const chartTitle = chart.title || 'Data Chart';
      const seriesPoints = (chart.series?.[0]?.data || [])
        .map((d) => `• ${d.label}: ${d.value}`)
        .join('   ');

      chartBoxXml = `
      <!-- Data / Chart Card -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="${slideNumber * 10 + 5}" name="ChartCard"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="5000000"/><a:ext cx="10363200" cy="1100000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 10000"/></a:avLst></a:prstGeom>
          <a:solidFill><a:srgbClr val="${palette.cardBgHex}"/></a:solidFill>
        </p:spPr>
        <p:txBody>
          <a:bodyPr vertOverflow="clip" anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1200" b="1">
                <a:solidFill><a:srgbClr val="${palette.accentHex}"/></a:solidFill>
              </a:rPr>
              <a:t>📊 ${xmlEscape(chartTitle)}: </a:t>
            </a:r>
            <a:r>
              <a:rPr lang="en-US" sz="1200">
                <a:solidFill><a:srgbClr val="${palette.textHex}"/></a:solidFill>
              </a:rPr>
              <a:t>${xmlEscape(seriesPoints)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
    }

    // Native OOXML table(s), stacked below the bullets (or filling the body area if the
    // slide is table-only), leaving room for a chart card and the footer if present.
    const bodyHeight = hasTables
      ? (bulletPoints.length > 0 ? 900000 : 50000)
      : hasCharts
        ? 2800000
        : 4200000;

    let tablesXml = '';
    if (hasTables) {
      const tableAreaY = 2000000 + bodyHeight + (bulletPoints.length > 0 ? 150000 : 0);
      const chartReserved = hasCharts ? 1250000 : 0;
      const tableAreaHeight = Math.max(6300000 - tableAreaY - chartReserved - 150000, 400000);
      const gap = 150000;
      const perTableHeight = Math.max(Math.floor((tableAreaHeight - gap * (tables.length - 1)) / tables.length), 400000);

      let cursorY = tableAreaY;
      tables.forEach((table, tIdx) => {
        tablesXml += buildTableGraphicFrameXml(
          table,
          slideNumber * 10 + 7 + tIdx,
          914400,
          cursorY,
          10363200,
          perTableHeight,
          palette,
        );
        cursorY += perTableHeight + gap;
      });
    }

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>

      <!-- Background Solid Fill -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Background"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${palette.backgroundHex}"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <!-- Slide Header: Number Badge & Title -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Header"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="500000"/><a:ext cx="10363200" cy="1400000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <!-- Badge -->
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1100" b="1">
                <a:solidFill><a:srgbClr val="${palette.accentHex}"/></a:solidFill>
              </a:rPr>
              <a:t>SLIDE ${sIdx + 1} / ${slides.length}</a:t>
            </a:r>
          </a:p>
          <!-- Title -->
          <a:p>
            <a:pPr spaceBefore="50000"/>
            <a:r>
              <a:rPr lang="en-US" sz="2400" b="1">
                <a:solidFill><a:srgbClr val="${palette.titleHex}"/></a:solidFill>
              </a:rPr>
              <a:t>${xmlEscape(slideItem.title || `Slide ${sIdx + 1}`)}</a:t>
            </a:r>
          </a:p>
          ${
            slideItem.subtitle
              ? `
          <a:p>
            <a:pPr spaceBefore="40000"/>
            <a:r>
              <a:rPr lang="en-US" sz="1300" i="1">
                <a:solidFill><a:srgbClr val="${palette.mutedHex}"/></a:solidFill>
              </a:rPr>
              <a:t>${xmlEscape(slideItem.subtitle)}</a:t>
            </a:r>
          </a:p>`
              : ''
          }
        </p:txBody>
      </p:sp>

      <!-- Body Points Container -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="BodyContent"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="2000000"/><a:ext cx="10363200" cy="${bodyHeight}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          ${bodyParagraphsXml}
        </p:txBody>
      </p:sp>

      ${chartBoxXml}

      ${tablesXml}

      <!-- Footer: Citations and Presentation Title -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="${slideNumber * 10 + 6}" name="Footer"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="6300000"/><a:ext cx="10363200" cy="350000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1000">
                <a:solidFill><a:srgbClr val="${palette.mutedHex}"/></a:solidFill>
              </a:rPr>
              <a:t>${xmlEscape(title || 'Presentation')}   ${slideItem.citations?.length ? `|  Sources: [${slideItem.citations.join(', ')}]` : ''}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;

    validateAndAddXml(`ppt/slides/slide${slideNumber}.xml`, slideXml);
    createSlideRels(slideNumber, includeSpeakerNotes);
    if (includeSpeakerNotes) {
      createNotesSlide(slideNumber, slideItem.speakerNotes || `Notes for slide ${sIdx + 1}`);
    }
  });

  // 7. OPTIONAL BIBLIOGRAPHY SLIDE
  if (includeSources && sources && sources.length > 0) {
    const biblioSlideNumber = totalSlidesCount;
    const sourcePointsXml = sources
      .map((s, idx) => {
        const srcTitle = s?.metadata?.title || s?.metadata?.fileName || `Source [${idx + 1}]`;
        const url = s?.metadata?.url || '';
        return `
          <a:p>
            <a:pPr marL="285750" indent="-285750" spaceBefore="80000">
              <a:buClr><a:srgbClr val="${palette.accentHex}"/></a:buClr>
              <a:buSzPct val="80000"/>
              <a:buChar char="•"/>
            </a:pPr>
            <a:r>
              <a:rPr lang="en-US" sz="1200" b="1">
                <a:solidFill><a:srgbClr val="${palette.titleHex}"/></a:solidFill>
              </a:rPr>
              <a:t>[${idx + 1}] ${xmlEscape(srcTitle)}: </a:t>
            </a:r>
            <a:r>
              <a:rPr lang="en-US" sz="1100">
                <a:solidFill><a:srgbClr val="${palette.accentHex}"/></a:solidFill>
              </a:rPr>
              <a:t>${xmlEscape(url || '')}</a:t>
            </a:r>
          </a:p>`;
      })
      .join('\n');

    const biblioSlideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>

      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Background"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${palette.backgroundHex}"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="600000"/><a:ext cx="10363200" cy="1000000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="2400" b="1">
                <a:solidFill><a:srgbClr val="${palette.titleHex}"/></a:solidFill>
              </a:rPr>
              <a:t>BIBLIOGRAPHY AND RESEARCH SOURCES</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="SourcesContent"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="1800000"/><a:ext cx="10363200" cy="4600000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr><a:normAutofit fontScale="${sources.length > 14 ? '70000' : sources.length > 9 ? '85000' : '100000'}" lnSpcReduction="${sources.length > 14 ? '20000' : '0'}"/></a:bodyPr>
          <a:lstStyle/>
          ${sourcePointsXml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;

    validateAndAddXml(`ppt/slides/slide${biblioSlideNumber}.xml`, biblioSlideXml);
    createSlideRels(biblioSlideNumber, includeSpeakerNotes);
    if (includeSpeakerNotes) {
      createNotesSlide(biblioSlideNumber, 'Overview of sources collected during web research.');
    }
  }

  // Generate binary PPTX blob & trigger download
  const pptxBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });

  const filename = `${(title || 'presentation').toLowerCase().replace(/[^a-z0-9а-яążśźęćńółüöä-]/gi, '_')}.pptx`;
  const url = URL.createObjectURL(pptxBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
