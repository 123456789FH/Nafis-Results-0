const encoder = new TextEncoder();
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function arabicizeText(value = '') {
  return String(value)
    .replace(/(\d)\.(?=\d)/g, '$1٫')
    .replace(/\d/g, digit => ARABIC_DIGITS[Number(digit)]);
}

function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function bytes(value) {
  return value instanceof Uint8Array ? value : encoder.encode(String(value));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function writeU16(view, offset, value) { view.setUint16(offset, value, true); }
function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

export function zipStore(fileMap, now = new Date()) {
  const entries = Object.entries(fileMap).map(([name, content]) => ({
    nameBytes: bytes(name), data: bytes(content), name, crc: 0, offset: 0
  }));
  entries.forEach(entry => { entry.crc = crc32(entry.data); });
  const stamp = dosDateTime(now);
  const localParts = [];
  let offset = 0;

  for (const entry of entries) {
    entry.offset = offset;
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    writeU32(view, 0, 0x04034b50);
    writeU16(view, 4, 20);
    writeU16(view, 6, 0x0800);
    writeU16(view, 8, 0);
    writeU16(view, 10, stamp.time);
    writeU16(view, 12, stamp.date);
    writeU32(view, 14, entry.crc);
    writeU32(view, 18, entry.data.length);
    writeU32(view, 22, entry.data.length);
    writeU16(view, 26, entry.nameBytes.length);
    writeU16(view, 28, 0);
    localParts.push(header, entry.nameBytes, entry.data);
    offset += header.length + entry.nameBytes.length + entry.data.length;
  }

  const centralOffset = offset;
  const centralParts = [];
  for (const entry of entries) {
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    writeU32(view, 0, 0x02014b50);
    writeU16(view, 4, 20);
    writeU16(view, 6, 20);
    writeU16(view, 8, 0x0800);
    writeU16(view, 10, 0);
    writeU16(view, 12, stamp.time);
    writeU16(view, 14, stamp.date);
    writeU32(view, 16, entry.crc);
    writeU32(view, 20, entry.data.length);
    writeU32(view, 24, entry.data.length);
    writeU16(view, 28, entry.nameBytes.length);
    writeU16(view, 30, 0);
    writeU16(view, 32, 0);
    writeU16(view, 34, 0);
    writeU16(view, 36, 0);
    writeU32(view, 38, 0);
    writeU32(view, 42, entry.offset);
    centralParts.push(header, entry.nameBytes);
    offset += header.length + entry.nameBytes.length;
  }
  const centralSize = offset - centralOffset;
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, entries.length);
  writeU16(endView, 10, entries.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, centralOffset);
  writeU16(endView, 20, 0);

  const parts = [...localParts, ...centralParts, end];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) { out.set(part, cursor); cursor += part.length; }
  return out;
}

function paragraph(text, options = {}) {
  const style = options.style ? `<w:pStyle w:val="${xmlEscape(options.style)}"/>` : '';
  const align = `<w:jc w:val="${options.align || 'right'}"/><w:bidi/>`;
  const spacing = `<w:spacing w:after="${options.after ?? 100}" w:line="${options.line ?? 360}" w:lineRule="auto"/>`;
  const run = `<w:r><w:rPr><w:rtl/><w:lang w:bidi="ar-SA"/>${options.bold ? '<w:b/>' : ''}${options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xmlEscape(arabicizeText(text))}</w:t></w:r>`;
  return `<w:p><w:pPr>${style}${align}${spacing}</w:pPr>${run}</w:p>`;
}

function table(rows, widths = []) {
  const grid = widths.length ? `<w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>` : '';
  const body = rows.map((row, rowIndex) => `<w:tr>${row.map((cell, colIndex) => {
    const width = widths[colIndex] ? `<w:tcW w:w="${widths[colIndex]}" w:type="dxa"/>` : '';
    const shading = rowIndex === 0 ? '<w:shd w:fill="DDEFE8"/>' : '';
    return `<w:tc><w:tcPr>${width}${shading}<w:vAlign w:val="center"/></w:tcPr>${paragraph(cell ?? '', { bold: rowIndex === 0, size: rowIndex === 0 ? 22 : 20, after: 40 })}</w:tc>`;
  }).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/><w:bidiVisual/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8CDC5"/><w:left w:val="single" w:sz="4" w:color="B8CDC5"/><w:bottom w:val="single" w:sz="4" w:color="B8CDC5"/><w:right w:val="single" w:sz="4" w:color="B8CDC5"/><w:insideH w:val="single" w:sz="4" w:color="DCE8E3"/><w:insideV w:val="single" w:sz="4" w:color="DCE8E3"/></w:tblBorders></w:tblPr>${grid}${body}</w:tbl>`;
}

function valueText(value, suffix = '') {
  return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`;
}

function classificationText(severity) {
  return ({ remedial: 'علاجي', improvement: 'تحسين', sustain: 'محافظة على القوة', diagnostic: 'غير مكتمل' })[severity] || severity || '—';
}

export function buildDocx(data, analysis, worksheets = []) {
  const metaRows = [
    ['البيان', 'القيمة'],
    ['المدرسة', data.school || '—'],
    ['الرقم الوزاري', data.ministerialId || '—'],
    ['الصف', data.gradeName || data.grade || '—'],
    ['العام الدراسي', valueText(data.academicYear)],
    ['سنة القياس', valueText(data.measurementYear)],
    ['عدد الطلبة', valueText(data.total)],
    ['المختبرون', valueText(data.tested)],
    ['إدارة التعليم', data.educationAdministration || '—'],
    ['المنطقة', data.region || '—'],
    ['نوع المدرسة', data.schoolType || 'غير محدد'],
    ['الإتقان العام', valueText(data.overallMastery, '٪')],
    ['مقدار التغير العام', valueText(data.overallChange, ' نقطة')]
  ];
  let body = paragraph('لوحة تحليل نتائج نافس وخطة رفع مستوى الأداء', { style: 'Title', bold: true, size: 34, after: 180 });
  body += paragraph(data.school || 'المدرسة', { style: 'Subtitle', bold: true, size: 28, after: 180 });
  body += table(metaRows, [2200, 6500]);
  body += paragraph('الملخص التنفيذي', { style: 'Heading1', bold: true, size: 28, after: 100 });
  body += paragraph(`نسبة المشاركة: ${valueText(analysis.executive.participation, '٪')}، متوسط الإتقان عبر المواد: ${valueText(analysis.executive.averageMastery, '٪')}، ومتوسط الدرجات المقروءة: ${valueText(analysis.executive.averageScore, ' درجة')}.`, { size: 22 });
  const topAction = analysis.actionUnits?.[0];
  if (topAction) body += paragraph(`الأولوية الأعلى: ${topAction.subject} — ${topAction.domain}. ${topAction.reason}`, { size: 22 });
  body += paragraph('ملخص المواد', { style: 'Heading1', bold: true, size: 28 });
  body += table([
    ['المادة', 'متوسط الدرجة', 'الإتقان', 'منخفض جدًا', 'منخفض', 'متوسط', 'مرتفع'],
    ...analysis.subjects.map(subject => [subject.name, valueText(subject.schoolAvg, ' درجة'), valueText(subject.mastery, '٪'), valueText(subject.veryLow, '٪'), valueText(subject.low, '٪'), valueText(subject.medium, '٪'), valueText(subject.high, '٪')])
  ], [1550, 1200, 1100, 1100, 1000, 1000, 1000]);

  for (const subject of analysis.subjects) {
    body += paragraph(`مجالات ${subject.name}`, { style: 'Heading2', bold: true, size: 25 });
    body += table([
      ['المجال', 'المدرسة', 'إدارة التعليم', 'المملكة', 'المستهدف', 'التصنيف'],
      ...(subject.domains || []).map(domain => {
        const priority = analysis.priorities.find(item => item.subject === subject.name && item.domain === domain.name);
        return [domain.name, valueText(domain.value, '٪'), valueText(domain.admin, '٪'), valueText(domain.kingdom, '٪'), valueText(domain.benchmark, '٪'), classificationText(priority?.severity)];
      })
    ], [3000, 1100, 1300, 1100, 1100, 1300]);
  }

  body += paragraph('الأولويات وخطط التحسين', { style: 'Heading1', bold: true, size: 28 });
  analysis.actionUnits.forEach(unit => {
    body += paragraph(`${unit.order}. ${unit.subject} — ${unit.domain}`, { style: 'Heading2', bold: true, size: 24, after: 50 });
    body += paragraph(unit.reason, { size: 21, after: 50 });
    body += table([
      ['المسار', 'الإجراءات'],
      ['الطالب', unit.studentActions.join(' • ')], ['المعلم/ة', unit.teacherActions.join(' • ')],
      ['الأسرة', unit.familyActions.join(' • ')], ['القيادة المدرسية', unit.leadershipActions.join(' • ')],
      ['محك النجاح', unit.successCriterion]
    ], [1900, 6900]);
  });

  if (analysis.strengths?.length) {
    body += paragraph('مجالات المحافظة على القوة', { style: 'Heading2', bold: true, size: 24 });
    analysis.strengths.forEach(item => {
      body += paragraph(`${item.subject} — ${item.domain}: ${item.reason} الإجراء: تثبيت الممارسة الناجحة والمتابعة الدورية والإثراء.`, { size: 20, after: 60 });
    });
  }

  body += paragraph('الخطة الزمنية لأربعة أسابيع', { style: 'Heading1', bold: true, size: 28 });
  body += table([['الأسبوع', 'المحور', 'المهام'], ...analysis.timeline.map(item => [item.week, item.title, item.tasks])], [1500, 2200, 5000]);

  if (worksheets.length) {
    body += paragraph('أوراق العمل ونماذج الإجابة', { style: 'Heading1', bold: true, size: 28 });
    worksheets.forEach((worksheet, index) => {
      body += paragraph(`ورقة ${index + 1}: ${worksheet.title}`, { style: 'Heading2', bold: true, size: 24 });
      body += paragraph(worksheet.disclaimer, { size: 19 });
      worksheet.questions.forEach(question => { body += paragraph(`${question.number}. ${question.text}`, { size: 21, after: 90 }); });
      body += paragraph('نموذج الإجابة', { style: 'Heading3', bold: true, size: 22 });
      body += table([['السؤال', 'الإجابة الصحيحة/المحك'], ...worksheet.questions.map(question => [String(question.number), question.answer])], [1100, 7600]);
    });
  }

  body += paragraph('تنبيه مهني: هذا تحليل مدرسي مبني على البيانات التي راجعها المستخدم واعتمدها، وليس تقريرًا رسميًا صادرًا من هيئة تقويم التعليم والتدريب، ولا يثبت سببًا للنتائج دون تشخيص إضافي.', { size: 18, after: 80 });
  body += paragraph('أ/ فاطمة هزازي — ملتقى معلمي ومعلمات الرياضيات · ملتقى التعليم التفاعلي', { bold: true, size: 20 });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:bidi/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:lang w:val="ar-SA" w:bidi="ar-SA"/><w:rtl/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape('تحليل نتائج نافس وخطة التحسين')}</dc:title><dc:creator>${xmlEscape('أ/ فاطمة هزازي')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`;
  return zipStore({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    'docProps/core.xml': core,
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>محلل نتائج نافس الآمن</Application></Properties>`,
    'word/document.xml': documentXml,
    'word/styles.xml': stylesXml,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  });
}

function columnName(index) {
  let n = index + 1;
  let name = '';
  while (n > 0) { n -= 1; name = String.fromCharCode(65 + (n % 26)) + name; n = Math.floor(n / 26); }
  return name;
}

function sheetXml(rows) {
  const cells = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, colIndex) => {
    const ref = `${columnName(colIndex)}${rowIndex + 1}`;
    const number = typeof value === 'number' && Number.isFinite(value);
    if (number) return `<c r="${ref}" s="${rowIndex === 0 ? 1 : 0}"><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr" s="${rowIndex === 0 ? 1 : 0}"><is><t xml:space="preserve">${xmlEscape(value ?? '')}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetFormatPr defaultColWidth="18" defaultRowHeight="20"/><sheetData>${cells}</sheetData></worksheet>`;
}

export function buildXlsx(data, analysis) {
  const metadata = [
    ['البيان', 'القيمة'],
    ['المدرسة', data.school || ''],
    ['الرقم الوزاري', data.ministerialId || ''],
    ['الصف', data.gradeName || data.grade || ''],
    ['العام الدراسي', data.academicYear ?? ''],
    ['سنة القياس', data.measurementYear ?? ''],
    ['عدد الطلبة', data.total ?? ''],
    ['المختبرون', data.tested ?? ''],
    ['إدارة التعليم', data.educationAdministration || ''],
    ['المنطقة', data.region || ''],
    ['نوع المدرسة', data.schoolType || 'غير محدد'],
    ['المؤشر العام', data.overallMastery ?? ''],
    ['مقدار التغير العام', data.overallChange ?? '']
  ];
  const subjectRows = [['المادة', 'متوسط الدرجة', 'تغير المتوسط', 'الإتقان', 'تغير الإتقان', 'منخفض جدًا', 'منخفض', 'متوسط', 'مرتفع']];
  analysis.subjects.forEach(subject => subjectRows.push([subject.name, subject.schoolAvg ?? '', subject.averageChange ?? '', subject.mastery ?? '', subject.masteryChange ?? '', subject.veryLow ?? '', subject.low ?? '', subject.medium ?? '', subject.high ?? '']));
  const domainRows = [['المادة', 'المجال', 'المدرسة', 'إدارة التعليم', 'المملكة', 'المستهدف', 'التصنيف']];
  analysis.subjects.forEach(subject => (subject.domains || []).forEach(domain => {
    const priority = analysis.priorities.find(item => item.subject === subject.name && item.domain === domain.name);
    domainRows.push([subject.name, domain.name, domain.value ?? '', domain.admin ?? '', domain.kingdom ?? '', domain.benchmark ?? '', classificationText(priority?.severity)]);
  }));
  const priorityRows = [['الترتيب', 'المادة', 'المجال', 'الأداء', 'المرجع', 'الفجوة', 'التصنيف', 'محك النجاح']];
  analysis.actionUnits.forEach(unit => priorityRows.push([unit.order, unit.subject, unit.domain, unit.value ?? '', unit.reference ?? '', unit.gap ?? '', classificationText(unit.severity), unit.successCriterion]));
  analysis.strengths?.forEach(item => priorityRows.push(['', item.subject, item.domain, item.value ?? '', item.reference ?? '', item.gap ?? '', 'محافظة على القوة', 'تثبيت الممارسة والمتابعة الدورية والإثراء']));
  const sheets = [
    { name: 'البيانات', rows: metadata }, { name: 'المواد', rows: subjectRows }, { name: 'المجالات', rows: domainRows }, { name: 'الأولويات', rows: priorityRows }
  ];
  const contentOverrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentOverrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>بيانات تحليل نافس</dc:title><dc:creator>أ/ فاطمة هزازي</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>محلل نتائج نافس الآمن</Application></Properties>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${workbookSheets}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B6B52"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" readingOrder="2" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" readingOrder="2" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = sheetXml(sheet.rows); });
  return zipStore(files);
}

function pPr(align = 'r') { return `<a:pPr algn="${align}" rtl="1"/>`; }
function textRun(text, size = 2400, bold = false, color = '183C33') { return `<a:r><a:rPr lang="ar-SA" sz="${size}"${bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>${xmlEscape(arabicizeText(text))}</a:t></a:r>`; }
function textBox(id, name, x, y, cx, cy, paragraphs, options = {}) {
  const fill = options.fill ? `<a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill>` : '<a:noFill/>';
  const line = options.line ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${options.line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  const radius = options.radius ? 'roundRect' : 'rect';
  const body = paragraphs.map(item => `<a:p>${pPr(item.align || 'r')}${textRun(item.text, item.size || 2400, item.bold, item.color || '183C33')}<a:endParaRPr lang="ar-SA"/></a:p>`).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xmlEscape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${radius}"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="1" anchor="${options.anchor || 'ctr'}" lIns="160000" rIns="160000" tIns="100000" bIns="100000"/><a:lstStyle/>${body}</p:txBody></p:sp>`;
}

function slideXml(shapes, background = 'F7FBF9') {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

export async function buildPptx(data, analysis) {
  const PptxGenJS = globalThis.PptxGenJS;
  if (typeof PptxGenJS !== 'function') throw new Error('مكتبة PowerPoint لم تُحمّل. حدّثي الصفحة ثم أعيدي المحاولة.');

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'أ/ فاطمة هزازي';
  pptx.company = 'ملتقى التعليم التفاعلي';
  pptx.subject = 'تحليل نتائج نافس وخطة التحسين';
  pptx.title = `تحليل نتائج نافس - ${data.school || 'المدرسة'}`;
  pptx.lang = 'ar-SA';
  pptx.rtlMode = true;
  pptx.theme = {
    headFontFace: 'Arial', bodyFontFace: 'Arial', lang: 'ar-SA'
  };

  const C = { green: '0B6B52', green2: '118667', ink: '183C33', muted: '5B746C', soft: 'F4FAF7', line: 'D6E7E0', purple: '6252A2', red: 'A53B35', gold: '9A6A08', white: 'FFFFFF', blue: '168FB7' };
  const addText = (slide, text, opts = {}) => slide.addText(arabicizeText(text ?? ''), {
    fontFace: 'Arial', color: C.ink, fontSize: 20, margin: 0.08,
    rtlMode: true, breakLine: false, valign: 'mid', align: 'right',
    fit: 'shrink', ...opts
  });
  const addTitle = (slide, title, subtitle = '') => {
    slide.background = { color: 'F7FBF9' };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.16, line: { color: C.green }, fill: { color: C.green } });
    addText(slide, title, { x: 0.65, y: 0.38, w: 12, h: 0.55, fontSize: 27, bold: true, color: C.green });
    if (subtitle) addText(slide, subtitle, { x: 0.65, y: 0.94, w: 12, h: 0.35, fontSize: 12.5, color: C.muted });
  };
  const addFooter = slide => addText(slide, 'أ/ فاطمة هزازي · ملتقى معلمي ومعلمات الرياضيات · ملتقى التعليم التفاعلي', { x: 0.6, y: 7.08, w: 12.1, h: 0.22, fontSize: 9.5, color: C.muted, align: 'center' });
  const card = (slide, x, y, w, h, title, value, color = C.green) => {
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.06, line: { color: C.line, pt: 1 }, fill: { color: C.white }, radius: 0.06 });
    addText(slide, title, { x: x+0.15, y: y+0.15, w: w-0.3, h: 0.28, fontSize: 11, bold: true, color: C.muted, align: 'center' });
    addText(slide, value, { x: x+0.15, y: y+0.55, w: w-0.3, h: h-0.7, fontSize: 24, bold: true, color, align: 'center' });
  };

  // 1: cover
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'EEF9F5' };
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 0.8, w: 11.9, h: 5.5, line: { color: 'CFE4DC', pt: 1 }, fill: { color: C.white } });
    addText(slide, 'تحليل نتائج نافس وخطة التحسين', { x: 1.1, y: 1.45, w: 11.1, h: 0.8, fontSize: 31, bold: true, color: C.green, align: 'center' });
    addText(slide, data.school || 'المدرسة', { x: 1.1, y: 2.35, w: 11.1, h: 0.6, fontSize: 23, bold: true, align: 'center' });
    addText(slide, `${data.gradeName || ''} · العام الدراسي ${data.academicYear || '—'} · سنة القياس ${data.measurementYear || '—'}`, { x: 1.1, y: 3.1, w: 11.1, h: 0.45, fontSize: 15, color: C.muted, align: 'center' });
    addText(slide, `الرقم الوزاري: ${data.ministerialId || '—'}   |   إدارة التعليم: ${data.educationAdministration || '—'}   |   المنطقة: ${data.region || '—'}`, { x: 1.1, y: 3.75, w: 11.1, h: 0.5, fontSize: 12.5, color: C.muted, align: 'center' });
    addText(slide, 'تقرير مدرسي مساند - مراجعة بشرية إلزامية قبل الاعتماد', { x: 1.2, y: 5.1, w: 10.9, h: 0.4, fontSize: 12, color: C.green, bold: true, align: 'center' });
    addFooter(slide);
  }

  // 2: executive KPIs
  {
    const slide = pptx.addSlide();
    addTitle(slide, 'الملخص التنفيذي', `${data.school || ''} · ${data.gradeName || ''}`);
    const e = analysis.executive || {};
    card(slide, 0.8, 1.55, 2.9, 1.55, 'المشاركة', valueText(e.participation, '٪'));
    card(slide, 3.95, 1.55, 2.9, 1.55, 'متوسط الإتقان', valueText(e.averageMastery, '٪'));
    card(slide, 7.1, 1.55, 2.9, 1.55, 'متوسط الدرجات', valueText(e.averageScore, ''));
    card(slide, 10.25, 1.55, 2.25, 1.55, 'الإتقان العام', valueText(e.overallMastery, '٪'));
    card(slide, 4.7, 3.55, 3.9, 1.5, 'التغير العام', valueText(e.overallChange, ' نقطة'), Number(e.overallChange) < 0 ? C.red : C.green);
    if (analysis.actionUnits?.[0]) addText(slide, `الأولوية الأعلى: ${analysis.actionUnits[0].subject} - ${analysis.actionUnits[0].domain}`, { x: 1.2, y: 5.45, w: 10.9, h: 0.55, fontSize: 17, bold: true, color: C.red, align: 'center' });
    addFooter(slide);
  }

  // 3: subjects
  {
    const slide = pptx.addSlide();
    addTitle(slide, 'مؤشرات المواد', 'متوسط الدرجة، الإتقان، وتوزيع مستويات الأداء');
    (analysis.subjects || []).slice(0,3).forEach((subject, i) => {
      const y = 1.42 + i*1.72;
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.75, y, w: 11.85, h: 1.38, line: { color: C.line, pt: 1 }, fill: { color: C.white } });
      addText(slide, subject.name, { x: 10.5, y:y+0.15, w:1.75, h:0.36, fontSize:18, bold:true, color:C.purple });
      addText(slide, `متوسط الدرجة: ${valueText(subject.schoolAvg)}   |   الإتقان: ${valueText(subject.mastery,'٪')}   |   منخفض جدًا + منخفض: ${valueText((Number(subject.veryLow)||0)+(Number(subject.low)||0),'٪')}`, { x: 1.05, y:y+0.54, w:10.9, h:0.4, fontSize:14 });
      addText(slide, `مرتفع ${valueText(subject.high,'٪')}   ·   متوسط ${valueText(subject.medium,'٪')}   ·   منخفض ${valueText(subject.low,'٪')}   ·   منخفض جدًا ${valueText(subject.veryLow,'٪')}`, { x: 1.05, y:y+0.95, w:10.9, h:0.28, fontSize:11.5, color:C.muted });
    });
    addFooter(slide);
  }

  // 4: domains and classification
  {
    const slide = pptx.addSlide();
    addTitle(slide, 'المجالات والتصنيف', 'التصنيف يوازن بين الأداء المطلق والفجوة عن المرجع');
    const rows = [];
    for (const subject of analysis.subjects || []) for (const domain of subject.domains || []) {
      const p = analysis.priorities.find(x => x.subject === subject.name && x.domain === domain.name);
      rows.push([subject.name, domain.name, valueText(domain.value,'٪'), valueText(domain.kingdom,'٪'), classificationText(p?.severity)]);
    }
    const shown = rows.slice(0,9);
    const y0=1.35, rowH=0.55;
    const headers=['المادة','المجال','المدرسة','المملكة','التصنيف'];
    const xs=[10.9,5.8,4.25,2.7,0.75], ws=[1.65,4.95,1.45,1.45,1.8];
    headers.forEach((h,i)=>{ slide.addShape(pptx.ShapeType.rect,{x:xs[i],y:y0,w:ws[i],h:rowH,line:{color:C.line,pt:1},fill:{color:'DDEFE8'}}); addText(slide,h,{x:xs[i]+0.05,y:y0+0.05,w:ws[i]-0.1,h:rowH-0.1,fontSize:11,bold:true,align:'center'}); });
    shown.forEach((r,ri)=>r.forEach((v,i)=>{const y=y0+(ri+1)*rowH; slide.addShape(pptx.ShapeType.rect,{x:xs[i],y,w:ws[i],h:rowH,line:{color:'E3ECE8',pt:0.7},fill:{color:C.white}}); addText(slide,v,{x:xs[i]+0.05,y:y+0.05,w:ws[i]-0.1,h:rowH-0.1,fontSize:10.5,align:i===1?'right':'center',color:i===4?(v==='علاجي'?C.red:v==='تحسين'?C.gold:C.green):C.ink,bold:i===4}); }));
    addFooter(slide);
  }

  // 5: priorities
  {
    const slide = pptx.addSlide();
    addTitle(slide, 'الأولويات وخطة التحسين', `علاجي: ${(analysis.priorities||[]).filter(x=>x.severity==='remedial').length} · تحسين: ${(analysis.priorities||[]).filter(x=>x.severity==='improvement').length} · محافظة على القوة: ${(analysis.priorities||[]).filter(x=>x.severity==='sustain').length}`);
    (analysis.actionUnits || []).slice(0,5).forEach((unit,i)=>{
      const y=1.35+i*1.05;
      slide.addShape(pptx.ShapeType.roundRect,{x:0.75,y,w:11.85,h:0.86,line:{color:C.line,pt:1},fill:{color:C.white}});
      addText(slide,`${unit.order}. ${unit.subject} - ${unit.domain}`,{x:7.5,y:y+0.12,w:4.65,h:0.28,fontSize:14,bold:true,color:unit.severity==='remedial'?C.red:C.gold});
      addText(slide,unit.reason,{x:1.05,y:y+0.38,w:11.05,h:0.34,fontSize:10.5,color:C.muted});
    });
    addFooter(slide);
  }

  // 6: timeline
  {
    const slide = pptx.addSlide();
    addTitle(slide, 'الخطة الزمنية', 'أربعة أسابيع للتشخيص والتدخل والقياس');
    (analysis.timeline || []).slice(0,4).forEach((item,i)=>{
      const x=0.72+i*3.12;
      slide.addShape(pptx.ShapeType.roundRect,{x,y:1.55,w:2.75,h:4.55,line:{color:C.line,pt:1},fill:{color:i%2?'EAF6F2':'E9F4FA'}});
      addText(slide,item.week,{x:x+0.12,y:1.85,w:2.5,h:0.45,fontSize:15,bold:true,color:C.green,align:'center'});
      addText(slide,item.title,{x:x+0.12,y:2.48,w:2.5,h:0.6,fontSize:14,bold:true,align:'center'});
      addText(slide,item.tasks,{x:x+0.2,y:3.25,w:2.35,h:2.3,fontSize:11,color:C.muted,valign:'top'});
    });
    addFooter(slide);
  }

  const result = await pptx.write({ outputType: 'arraybuffer', compression: true });
  return new Uint8Array(result);
}

