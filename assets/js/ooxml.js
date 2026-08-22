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

export function buildPptx(data, analysis) {
  const slides = [];
  slides.push(slideXml(
    textBox(2, 'Title', 900000, 1350000, 10400000, 1600000, [
      { text: 'تحليل نتائج نافس وخطة التحسين', size: 3600, bold: true, color: '0B6B52', align: 'ctr' },
      { text: data.school || 'المدرسة', size: 2600, bold: true, color: '183C33', align: 'ctr' },
      { text: `${data.gradeName || ''} · العام الدراسي ${data.academicYear || '—'} · سنة القياس ${data.measurementYear || '—'}`, size: 2000, color: '5B746C', align: 'ctr' }
    ]) + textBox(3, 'Footer', 1400000, 5600000, 9200000, 550000, [{ text: 'أ/ فاطمة هزازي · ملتقى معلمي ومعلمات الرياضيات · ملتقى التعليم التفاعلي', size: 1500, color: '55736A', align: 'ctr' }]), 'EEF9F5'));

  const exec = analysis.executive;
  const cards = [
    ['نسبة المشاركة', valueText(exec.participation, '٪')], ['متوسط الإتقان', valueText(exec.averageMastery, '٪')],
    ['متوسط الدرجات', valueText(exec.averageScore, ' درجة')], ['المؤشر العام', valueText(exec.overallMastery, '٪')]
  ];
  let dashboardShapes = textBox(2, 'Title', 750000, 300000, 10600000, 700000, [{ text: 'لوحة المؤشرات', size: 3000, bold: true, color: '0B6B52' }]);
  cards.forEach((card, index) => {
    const x = 700000 + (index % 2) * 5700000;
    const y = 1350000 + Math.floor(index / 2) * 1900000;
    dashboardShapes += textBox(3 + index, `Card${index}`, x, y, 5100000, 1450000, [
      { text: card[0], size: 1900, bold: true, color: '55736A', align: 'ctr' },
      { text: card[1], size: 3400, bold: true, color: '0B6B52', align: 'ctr' }
    ], { fill: 'FFFFFF', line: 'D6E7E0', radius: true });
  });
  slides.push(slideXml(dashboardShapes));

  let subjectsShapes = textBox(2, 'Title', 750000, 280000, 10600000, 650000, [{ text: 'ملخص المواد', size: 3000, bold: true, color: '0B6B52' }]);
  analysis.subjects.slice(0, 3).forEach((subject, index) => {
    subjectsShapes += textBox(3 + index, `Subject${index}`, 800000, 1150000 + index * 1550000, 10400000, 1250000, [
      { text: subject.name, size: 2300, bold: true, color: '6252A2' },
      { text: `متوسط الدرجة: ${valueText(subject.schoolAvg, ' درجة')}   |   الإتقان: ${valueText(subject.mastery, '٪')}   |   المنخفض والمنخفض جدًا: ${valueText((Number(subject.veryLow) || 0) + (Number(subject.low) || 0), '٪')}`, size: 1850, color: '183C33' }
    ], { fill: 'FFFFFF', line: 'DCE8E3', radius: true });
  });
  slides.push(slideXml(subjectsShapes));

  let prioritiesShapes = textBox(2, 'Title', 750000, 280000, 10600000, 650000, [{ text: 'الأولويات الأعلى', size: 3000, bold: true, color: '0B6B52' }]);
  analysis.actionUnits.slice(0, 4).forEach((unit, index) => {
    prioritiesShapes += textBox(3 + index, `Priority${index}`, 750000, 1100000 + index * 1250000, 10600000, 1000000, [
      { text: `${unit.order}. ${unit.subject} — ${unit.domain}`, size: 2050, bold: true, color: unit.severity === 'remedial' ? 'A53B35' : '7A5A13' },
      { text: unit.reason, size: 1650, color: '405E55' }
    ], { fill: 'FFFFFF', line: 'DCE8E3', radius: true });
  });
  slides.push(slideXml(prioritiesShapes));

  let timelineShapes = textBox(2, 'Title', 750000, 280000, 10600000, 650000, [{ text: 'الخطة الزمنية لأربعة أسابيع', size: 3000, bold: true, color: '0B6B52' }]);
  analysis.timeline.forEach((item, index) => {
    const x = 650000 + index * 2870000;
    timelineShapes += textBox(3 + index, `Week${index}`, x, 1350000, 2500000, 3600000, [
      { text: item.week, size: 2050, bold: true, color: 'FFFFFF', align: 'ctr' },
      { text: item.title, size: 1850, bold: true, color: '183C33', align: 'ctr' },
      { text: item.tasks, size: 1500, color: '405E55', align: 'r' }
    ], { fill: index % 2 ? 'EAF6F2' : 'E9F4FA', line: 'C9DDD5', radius: true, anchor: 't' });
  });
  slides.push(slideXml(timelineShapes));

  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>عرض تحليل نتائج نافس</dc:title><dc:creator>أ/ فاطمة هزازي</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>محلل نتائج نافس الآمن</Application><Slides>${slides.length}</Slides></Properties>`,
    'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="ar-SA"/></a:defPPr></p:defaultTextStyle></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('')}<Relationship Id="rId${slides.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId${slides.length + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId${slides.length + 4}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`,
    'ppt/slideMasters/slideMaster1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name=""><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
    'ppt/slideLayouts/slideLayout1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
    'ppt/theme/theme1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Nafis"><a:themeElements><a:clrScheme name="Nafis"><a:dk1><a:srgbClr val="183C33"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="405E55"/></a:dk2><a:lt2><a:srgbClr val="F7FBF9"/></a:lt2><a:accent1><a:srgbClr val="0B6B52"/></a:accent1><a:accent2><a:srgbClr val="168FB7"/></a:accent2><a:accent3><a:srgbClr val="79BB37"/></a:accent3><a:accent4><a:srgbClr val="EE7D21"/></a:accent4><a:accent5><a:srgbClr val="6252A2"/></a:accent5><a:accent6><a:srgbClr val="C99828"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Nafis"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`,
    'ppt/presProps.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`,
    'ppt/viewProps.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr/><p:slideViewPr/><p:notesTextViewPr/></p:viewPr>`,
    'ppt/tableStyles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`
  };
  slides.forEach((slide, index) => {
    files[`ppt/slides/slide${index + 1}.xml`] = slide;
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
  });
  return zipStore(files);
}
