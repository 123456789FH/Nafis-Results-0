import { APP_CONFIG, GRADE_META } from './config.js';
import { readNafisFile } from './file-reader.js';
import { isAiConfigured, readNafisWithAI, testAiConnection } from './ai-reader.js';
import {
  parseNafisDocument,
  makeBlankData,
  makeBlankSubject,
  makeDemoData,
  defaultDomainsFor,
  parseNumber,
  toArabicDigits,
  canonicalDomainName
} from './parser.js';
import { analyzeData } from './analysis.js';
import { worksheetsForAnalysis } from './worksheets.js';
import { buildDocx, buildXlsx, buildPptx } from './ooxml.js';
import './pwa.js';

const $ = selector => document.querySelector(selector);
const els = {
  chooseFileBtn: $('#chooseFileBtn'),
  fileInput: $('#fileInput'),
  dropZone: $('#dropZone'),
  gradeHint: $('#gradeHint'),
  ocrToggle: $('#ocrToggle'),
  aiStatusBadge: $('#aiStatusBadge'),
  aiStatusText: $('#aiStatusText'),
  testAiBtn: $('#testAiBtn'),
  demoButtons: [...document.querySelectorAll('[data-demo-grade]')],
  manualBtn: $('#manualBtn'),
  resetBtn: $('#resetBtn'),
  readerStatus: $('#readerStatus'),
  readerResultActions: $('#readerResultActions'),
  jumpReviewBtn: $('#jumpReviewBtn'),
  retryOcrBtn: $('#retryOcrBtn'),
  progressWrap: $('#progressWrap'),
  progressBar: $('#progressBar'),
  progressLabel: $('#progressLabel'),
  progressPercent: $('#progressPercent'),
  fileSummary: $('#fileSummary'),
  previewGrid: $('#previewGrid'),
  rawTextBtn: $('#rawTextBtn'),
  rawDialog: $('#rawDialog'),
  rawText: $('#rawText'),
  privacyBtn: $('#privacyBtn'),
  privacyDialog: $('#privacyDialog'),
  reviewSection: $('#reviewSection'),
  sourceBadge: $('#sourceBadge'),
  metadataFields: $('#metadataFields'),
  subjectsRoot: $('#subjectsRoot'),
  validationRoot: $('#validationRoot'),
  validationCounter: $('#validationCounter'),
  reviewConfirmed: $('#reviewConfirmed'),
  analyzeBtn: $('#analyzeBtn'),
  outputSection: $('#outputSection'),
  analysisRoot: $('#analysisRoot'),
  reportRoot: $('#reportRoot'),
  includeWorksheets: $('#includeWorksheets'),
  printBtn: $('#printBtn'),
  wordBtn: $('#wordBtn'),
  excelBtn: $('#excelBtn'),
  pptBtn: $('#pptBtn'),
  jsonBtn: $('#jsonBtn')
};

const state = {
  file: null,
  data: normalizeData(makeBlankData(), { fillExpectedSubjects: true }),
  analysis: null,
  worksheets: [],
  warnings: [],
  previews: [],
  rawText: '',
  diagnostics: null,
  sourceMode: 'manual',
  controller: null,
  reading: false
};

const arNumber = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 });
const arInteger = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function number(value) { return parseNumber(value); }
function fmt(value, integer = false) {
  const parsed = number(value);
  if (parsed === null) return '—';
  return (integer ? arInteger : arNumber).format(parsed);
}
function pct(value) { return number(value) === null ? '—' : `${fmt(value)}٪`; }
function signed(value) {
  const parsed = number(value);
  if (parsed === null) return '—';
  return `${parsed > 0 ? '+' : ''}${fmt(parsed)}`;
}
function inputValue(value) { return value === null || value === undefined ? '' : String(value); }
function clampPercent(value) {
  const parsed = number(value);
  return parsed === null ? 0 : Math.max(0, Math.min(100, parsed));
}
function gradeMeta(grade) { return GRADE_META[grade] || { name: 'صف غير محدد', stage: '', subjects: [] }; }
function show(element) { element?.classList.remove('hidden'); }
function hide(element) { element?.classList.add('hidden'); }
function scrollToElement(element) {
  if (!element) return;
  const go = () => element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 180);
}
function sourceLabel(mode) {
  return ({
    'ai-secure': 'قارئ AI آمن',
    'pdf-text': 'نص PDF مباشر',
    'pdf-hybrid': 'PDF مع OCR للصفحات اللازمة',
    ocr: 'قراءة ضوئية محلية',
    manual: 'إدخال يدوي',
    demo: 'بيانات تجريبية'
  })[mode] || 'مصدر قراءة';
}
function subjectIcon(name) {
  return ({ الرياضيات: '➗', العلوم: '🔬', القراءة: '📖' })[name] || '📘';
}
function severityLabel(value) {
  return ({ remedial: 'علاجي', improvement: 'تحسين', sustain: 'محافظة على القوة', diagnostic: 'غير مكتمل' })[value] || value;
}
function confidenceLabel(value) {
  return ({ high: 'دقة أولية مرتفعة', medium: 'تحتاج مراجعة', partial: 'قراءة جزئية', low: 'دقة منخفضة', none: 'غير مقروء', demo: 'تجريبي' })[value] || 'تحتاج مراجعة';
}
function safeDownloadName(extension) {
  const date = new Date().toISOString().slice(0, 10);
  return `Nafis_Analysis_${state.data.grade || 'nafis'}_${date}.${extension}`;
}

function blankSubject(name, grade) {
  const subject = makeBlankSubject(name);
  subject.domains = defaultDomainsFor(grade, name).map(domain => ({
    name: domain,
    value: '', admin: '', kingdom: '', benchmark: ''
  }));
  return subject;
}


function looksLikeEducationAdministration(value = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return /إدارة|الادارة|الإدارة|تعليم|التعليم/.test(text) && text.length > 8;
}

function reconcileMetadata(data = {}) {
  const out = { ...data };
  // حماية من عكس «إدارة التعليم» و«المنطقة» في القراءة البصرية.
  if (looksLikeEducationAdministration(out.region) && !looksLikeEducationAdministration(out.educationAdministration)) {
    const tmp = out.educationAdministration;
    out.educationAdministration = out.region;
    out.region = tmp || '';
  }
  // العام الدراسي الهجري لا يتحول إلى سنة القياس الميلادية.
  if (hasValue(out.academicYear) && /^20\d{2}$/.test(String(out.academicYear).trim()) && !hasValue(out.measurementYear)) {
    out.measurementYear = Number(out.academicYear);
    out.academicYear = '';
  }
  return out;
}

function normalizeData(data, { fillExpectedSubjects = false } = {}) {
  const base = makeBlankData();
  data = reconcileMetadata(data || {});
  const normalized = { ...base, ...(data || {}) };
  // توافق مع النسخ السابقة دون تثبيت أي بيانات: region القديمة كانت تعني إدارة التعليم، وarea كانت تعني المنطقة.
  if (!hasValue(normalized.educationAdministration) && hasValue(data?.region) && hasValue(data?.area)) {
    normalized.educationAdministration = data.region;
    normalized.region = data.area;
  }
  normalized.educationAdministration = normalized.educationAdministration || '';
  normalized.region = normalized.region || '';
  normalized.academicYear = normalized.academicYear || '';
  normalized.measurementYear = normalized.measurementYear || (number(normalized.year) >= 2000 ? number(normalized.year) : '');
  normalized.overallChange = hasValue(normalized.overallChange) ? normalized.overallChange : normalized.change;
  normalized.change = normalized.overallChange;
  const resolvedGrade = GRADE_META[normalized.grade] ? normalized.grade : '';
  normalized.grade = resolvedGrade;
  normalized.gradeName = resolvedGrade ? GRADE_META[resolvedGrade].name : '';
  normalized.stage = normalized.stage || (resolvedGrade ? GRADE_META[resolvedGrade].stage : '');
  normalized.source = normalized.source || 'manual';
  normalized.subjects = Array.isArray(normalized.subjects) ? normalized.subjects : [];

  normalized.subjects = normalized.subjects.map(raw => {
    const name = String(raw?.name || 'الرياضيات');
    const subject = { ...makeBlankSubject(name), ...(raw || {}), name };
    subject.domains = Array.isArray(raw?.domains)
      ? raw.domains.map(domain => ({
          name: canonicalDomainName(domain?.name || ''),
          value: domain?.value ?? '',
          admin: domain?.admin ?? '',
          kingdom: domain?.kingdom ?? '',
          benchmark: domain?.benchmark ?? ''
        }))
      : [];
    if (!subject.domains.length) subject.domains = blankSubject(name, normalized.grade).domains;
    return subject;
  });

  if ((fillExpectedSubjects || !normalized.subjects.length) && resolvedGrade) {
    const existing = new Map(normalized.subjects.map(subject => [subject.name, subject]));
    normalized.subjects = GRADE_META[resolvedGrade].subjects.map(name => existing.get(name) || blankSubject(name, resolvedGrade));
  }
  return normalized;
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function extractionQuality(data) {
  const grade = GRADE_META[data?.grade] ? data.grade : '';
  const expected = grade ? GRADE_META[grade].subjects : [];
  const subjects = Array.isArray(data?.subjects) ? data.subjects : [];
  const subjectMap = new Map(subjects.map(subject => [subject.name, subject]));

  const metadataFields = [
    data?.school, data?.ministerialId, data?.educationAdministration, data?.region,
    grade, data?.academicYear, data?.measurementYear, data?.total, data?.tested
  ];
  const metadataReady = metadataFields.filter(hasValue).length;
  const metadataRatio = metadataReady / metadataFields.length;

  const coreReady = expected.filter(name => {
    const subject = subjectMap.get(name);
    if (!subject) return false;
    const levels = ['veryLow', 'low', 'medium', 'high'].filter(key => number(subject[key]) !== null).length;
    return levels === 4 && number(subject.schoolAvg) !== null && number(subject.mastery) !== null;
  }).length;
  const expectedCount = expected.length;
  const foundExpected = expected.filter(name => subjectMap.has(name)).length;
  const subjectRatio = expectedCount ? coreReady / expectedCount : 0;

  const expectedDomainCount = subjects.reduce((sum, subject) => sum + defaultDomainsFor(grade, subject.name).length, 0);
  const readableDomains = subjects.reduce((count, subject) => count + (subject.domains || []).filter(domain => number(domain.value) !== null).length, 0);
  const domainRatio = expectedDomainCount ? Math.min(1, readableDomains / expectedDomainCount) : (readableDomains ? 1 : 0);

  const overallReady = [data?.overallMastery, data?.overallChange].filter(value => number(value) !== null).length;
  const overallRatio = overallReady / 2;

  const completeSubjects = expectedCount ? coreReady === expectedCount : false;
  const needsOcr = !grade || metadataRatio < 0.55 || (expectedCount > 0 && (foundExpected < expectedCount || !completeSubjects)) || domainRatio < 0.5;
  const usable = Boolean(grade && subjects.length && coreReady > 0);
  const score = Math.round(metadataRatio * 25 + subjectRatio * 40 + domainRatio * 25 + overallRatio * 10);
  return {
    grade, expectedCount, foundExpected, coreReady, domainValues: readableDomains,
    metadataReady, needsOcr, usable, score: Math.max(0, Math.min(100, score))
  };
}

function mergeSubject(primary = {}, secondary = {}, grade = '') {
  const name = primary.name || secondary.name || 'الرياضيات';
  const out = { ...makeBlankSubject(name), ...secondary, ...primary, name };
  for (const key of ['veryLow','low','medium','high','schoolAvg','adminAvg','kingdomAvg','averageChange','mastery','masteryChange','target','target2030']) {
    if (!hasValue(primary[key]) && hasValue(secondary[key])) out[key] = secondary[key];
  }
  const pDomains = Array.isArray(primary.domains) ? primary.domains : [];
  const sDomains = Array.isArray(secondary.domains) ? secondary.domains : [];
  const order = [...pDomains.map(d => canonicalDomainName(d.name || '')), ...sDomains.map(d => canonicalDomainName(d.name || ''))].filter(Boolean);
  const names = [...new Set(order)];
  out.domains = names.map(domainName => {
    const p = pDomains.find(d => canonicalDomainName(d.name || '') === domainName) || {};
    const q = sDomains.find(d => canonicalDomainName(d.name || '') === domainName) || {};
    return {
      name: domainName,
      value: hasValue(p.value) ? p.value : (q.value ?? ''),
      admin: hasValue(p.admin) ? p.admin : (q.admin ?? ''),
      kingdom: hasValue(p.kingdom) ? p.kingdom : (q.kingdom ?? ''),
      benchmark: hasValue(p.benchmark) ? p.benchmark : (q.benchmark ?? '')
    };
  });
  if (!out.domains.length) out.domains = blankSubject(name, grade).domains;
  out.extractionConfidence = { ...(secondary.extractionConfidence || {}), ...(primary.extractionConfidence || {}) };
  return out;
}

function mergeParsedData(primary, secondary) {
  const grade = GRADE_META[primary?.grade] ? primary.grade : (GRADE_META[secondary?.grade] ? secondary.grade : '');
  const out = { ...(secondary || {}), ...(primary || {}) };
  for (const key of ['school','ministerialId','gender','schoolType','educationAdministration','region','stage','grade','gradeName','academicYear','measurementYear','year','total','tested','overallChange','change','overallMastery']) {
    if (!hasValue(primary?.[key]) && hasValue(secondary?.[key])) out[key] = secondary[key];
  }
  if (!GRADE_META[out.grade] && grade) out.grade = grade;
  if (GRADE_META[out.grade]) {
    out.gradeName = GRADE_META[out.grade].name;
    out.stage = out.stage || GRADE_META[out.grade].stage;
  }
  const pSubjects = new Map((primary?.subjects || []).map(subject => [subject.name, subject]));
  const sSubjects = new Map((secondary?.subjects || []).map(subject => [subject.name, subject]));
  const expected = GRADE_META[out.grade]?.subjects || [...new Set([...pSubjects.keys(), ...sSubjects.keys()])];
  out.subjects = expected.map(name => mergeSubject(pSubjects.get(name) || {}, sSubjects.get(name) || {}, out.grade));
  out.overallHistory = (primary?.overallHistory?.length ? primary.overallHistory : secondary?.overallHistory) || [];
  return out;
}

function setStatus(message, type = '') {
  els.readerStatus.textContent = message;
  els.readerStatus.className = `statusBox${type ? ` ${type}` : ''}`;
}

function updateProgress({ value = 0, message = '', detail = '' }) {
  show(els.progressWrap);
  els.progressWrap.setAttribute('aria-hidden', 'false');
  els.progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
  els.progressLabel.textContent = detail ? `${message} — ${detail}` : message;
  els.progressPercent.textContent = `${arInteger.format(Math.round(value))}٪`;
}

function setReading(reading) {
  state.reading = reading;
  [els.chooseFileBtn, ...els.demoButtons, els.manualBtn, els.resetBtn].forEach(button => {
    if (button) button.disabled = reading;
  });
  els.fileInput.disabled = reading;
  if (!reading) {
    setTimeout(() => {
      hide(els.progressWrap);
      els.progressWrap.setAttribute('aria-hidden', 'true');
    }, 320);
  }
}

function resetApprovalAndOutput() {
  els.reviewConfirmed.checked = false;
  state.analysis = null;
  state.worksheets = [];
  hide(els.outputSection);
  els.analysisRoot.replaceChildren();
  els.reportRoot.replaceChildren();
}

function renderEmptyPreview() {
  els.previewGrid.innerHTML = '<div class="emptyState">ستظهر صفحات البطاقة هنا بعد فتح الملف.</div>';
}

function renderPreviews() {
  if (!state.previews.length) { renderEmptyPreview(); return; }
  els.previewGrid.innerHTML = state.previews.map(preview => `
    <figure class="previewPage">
      <img src="${esc(preview.url)}" alt="معاينة الصفحة ${fmt(preview.pageNumber, true)} من بطاقة نافس" loading="lazy" decoding="async">
      <figcaption>الصفحة ${fmt(preview.pageNumber, true)}</figcaption>
    </figure>
  `).join('');
}

function renderFileSummary(meta = null, pageCount = null, quality = null) {
  if (!meta) {
    els.fileSummary.className = 'fileSummary empty';
    els.fileSummary.textContent = 'لا توجد بطاقة مرفوعة.';
    return;
  }
  const kind = ({ pdf: 'PDF', png: 'PNG', jpeg: 'JPG' })[meta.type] || meta.type;
  const extraction = quality ? `<div class="fileExtractionSummary${quality.needsOcr ? ' warn' : ''}">
    <b>${quality.usable ? 'تم استخراج بيانات قابلة للمراجعة.' : 'تم فتح الملف، لكن الاستخراج ما زال جزئيًا.'}</b>
    الصف: ${quality.grade ? esc(gradeMeta(quality.grade).name) : 'غير مكتشف'} · المواد المكتشفة: ${fmt(quality.foundExpected, true)} من ${fmt(quality.expectedCount, true)} · جودة القراءة الأولية: ${fmt(quality.score, true)}٪.
  </div>` : '';
  els.fileSummary.className = 'fileSummary';
  els.fileSummary.innerHTML = `<div class="fileSummaryGrid">
    <div><small>الملف</small><b>ملف محلي مختار</b></div>
    <div><small>النوع</small><b>${esc(kind)}</b></div>
    <div><small>الحجم</small><b>${(meta.size / 1024 / 1024).toFixed(2)} MB</b></div>
    <div><small>الصفحات</small><b>${pageCount === null ? '—' : fmt(pageCount, true)}</b></div>
  </div>${extraction}`;
}

function clearAll({ quiet = false } = {}) {
  state.controller?.abort();
  state.controller = null;
  state.file = null;
  state.data = normalizeData(makeBlankData(), { fillExpectedSubjects: true });
  state.analysis = null;
  state.worksheets = [];
  state.warnings = [];
  state.previews = [];
  state.rawText = '';
  state.diagnostics = null;
  state.sourceMode = 'manual';
  els.fileInput.value = '';
  hide(els.reviewSection);
  hide(els.outputSection);
  hide(els.rawTextBtn);
  hide(els.readerResultActions);
  hide(els.retryOcrBtn);
  renderFileSummary();
  renderEmptyPreview();
  resetApprovalAndOutput();
  if (!quiet) setStatus('تم مسح الملف والبيانات من ذاكرة الصفحة.', 'good');
}

function fieldHtml({ key, label, value, type = 'text', span = '', options = [], readonly = false, hint = '' }) {
  const className = ['field', span].filter(Boolean).join(' ');
  if (type === 'select') {
    return `<label class="${className}"><span>${esc(label)}</span><select data-meta="${esc(key)}">${options.map(option => {
      const item = typeof option === 'string' ? { value: option, label: option } : option;
      return `<option value="${esc(item.value)}"${String(value) === String(item.value) ? ' selected' : ''}>${esc(item.label)}</option>`;
    }).join('')}</select>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
  }
  return `<label class="${className}"><span>${esc(label)}</span><input data-meta="${esc(key)}" type="${esc(type)}" value="${esc(inputValue(value))}"${type === 'number' ? ' step="any" inputmode="decimal"' : ''}${readonly ? ' readonly' : ''}>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

function renderMetadata() {
  const d = state.data;
  els.metadataFields.innerHTML = [
    fieldHtml({ key: 'school', label: 'اسم المدرسة', value: d.school, span: 'span2' }),
    fieldHtml({ key: 'ministerialId', label: 'الرقم الوزاري', value: d.ministerialId }),
    fieldHtml({ key: 'gender', label: 'الفئة', value: d.gender, type: 'select', options: ['غير محدد', 'بنين', 'بنات'] }),
    fieldHtml({ key: 'educationAdministration', label: 'إدارة التعليم', value: d.educationAdministration, span: 'span2' }),
    fieldHtml({ key: 'region', label: 'المنطقة', value: d.region }),
    fieldHtml({ key: 'schoolType', label: 'نوع المدرسة', value: d.schoolType, type: 'select', options: ['غير محدد', 'حكومي', 'أهلي', 'عالمي'] }),
    fieldHtml({ key: 'grade', label: 'الصف', value: d.grade, type: 'select', options: [
      { value: '', label: '— حددي الصف —' },
      ...Object.entries(GRADE_META).map(([value, meta]) => ({ value, label: meta.name }))
    ] }),
    fieldHtml({ key: 'stage', label: 'المرحلة', value: d.stage }),
    fieldHtml({ key: 'academicYear', label: 'العام الدراسي', value: d.academicYear, hint: 'يظهر كما ورد في البطاقة، مثل ١٤٤٧هـ.' }),
    fieldHtml({ key: 'measurementYear', label: 'سنة القياس', value: d.measurementYear, type: 'number', hint: 'السنة الحالية في الرسوم، مثل ٢٠٢٦.' }),
    fieldHtml({ key: 'pageCount', label: 'عدد صفحات المصدر', value: d.pageCount || '', type: 'number', readonly: true }),
    fieldHtml({ key: 'total', label: 'عدد الطلبة الإجمالي', value: d.total, type: 'number' }),
    fieldHtml({ key: 'tested', label: 'عدد المختبرين', value: d.tested, type: 'number' }),
    fieldHtml({ key: 'overallChange', label: 'مقدار التغير العام', value: d.overallChange, type: 'number' }),
    fieldHtml({ key: 'overallMastery', label: 'الإتقان العام المشترك', value: d.overallMastery, type: 'number', hint: 'اتركيه فارغًا إن لم يظهر بوضوح.' })
  ].join('');
}

function confidenceBadges(subject) {
  const confidence = subject.extractionConfidence || {};
  const values = [confidence.levels, confidence.average, confidence.mastery, confidence.domains].filter(Boolean);
  const worst = values.includes('none') ? 'none'
    : values.includes('low') ? 'low'
      : values.includes('partial') ? 'partial'
        : values.includes('medium') ? 'medium'
          : values.includes('demo') ? 'demo'
            : 'high';
  return `<span class="confidence ${esc(worst)}">${esc(confidenceLabel(worst))}</span>`;
}

function numericInput({ subjectIndex, field, label, value, className = '' }) {
  return `<label class="field ${esc(className)}"><span>${esc(label)}</span><input type="number" step="any" inputmode="decimal" data-subject-index="${subjectIndex}" data-subject-field="${esc(field)}" value="${esc(inputValue(value))}"></label>`;
}

function domainRow(subjectIndex, domainIndex, domain) {
  return `<tr>
    <td><input class="domainName" type="text" data-subject-index="${subjectIndex}" data-domain-index="${domainIndex}" data-domain-field="name" value="${esc(domain.name || '')}" aria-label="اسم المجال"></td>
    <td><input type="number" step="any" data-subject-index="${subjectIndex}" data-domain-index="${domainIndex}" data-domain-field="value" value="${esc(inputValue(domain.value))}" aria-label="نتيجة المدرسة"></td>
    <td><input type="number" step="any" data-subject-index="${subjectIndex}" data-domain-index="${domainIndex}" data-domain-field="admin" value="${esc(inputValue(domain.admin))}" aria-label="مرجع إدارة التعليم"></td>
    <td><input type="number" step="any" data-subject-index="${subjectIndex}" data-domain-index="${domainIndex}" data-domain-field="kingdom" value="${esc(inputValue(domain.kingdom))}" aria-label="مرجع المملكة"></td>
    <td><input type="number" step="any" data-subject-index="${subjectIndex}" data-domain-index="${domainIndex}" data-domain-field="benchmark" value="${esc(inputValue(domain.benchmark))}" aria-label="المستهدف"></td>
    <td><button type="button" class="iconButton remove" data-action="remove-domain" data-subject-index="${subjectIndex}" data-domain-index="${domainIndex}" aria-label="حذف المجال">×</button></td>
  </tr>`;
}

function renderSubjects() {
  const cards = state.data.subjects.map((subject, subjectIndex) => `
    <article class="panel subjectPanel">
      <header class="subjectHeader">
        <div class="subjectIdentity">
          <span class="subjectIcon" aria-hidden="true">${subjectIcon(subject.name)}</span>
          <div><h3>${esc(subject.name)}</h3><small>راجعي النسب والمتوسطات والمجالات كما تظهر في البطاقة.</small></div>
        </div>
        <div class="confidenceRow">${confidenceBadges(subject)}<button type="button" class="button dangerText small" data-action="remove-subject" data-subject-index="${subjectIndex}">حذف المادة</button></div>
      </header>

      <div class="subjectGrid">
        <section class="subBlock"><h4>مستويات الأداء</h4><div class="levelInputs">
          ${numericInput({ subjectIndex, field: 'veryLow', label: 'منخفض جدًا ٪', value: subject.veryLow, className: 'levelField vl' })}
          ${numericInput({ subjectIndex, field: 'low', label: 'منخفض ٪', value: subject.low, className: 'levelField low' })}
          ${numericInput({ subjectIndex, field: 'medium', label: 'متوسط ٪', value: subject.medium, className: 'levelField mid' })}
          ${numericInput({ subjectIndex, field: 'high', label: 'مرتفع ٪', value: subject.high, className: 'levelField high' })}
        </div></section>
        <section class="subBlock"><h4>المتوسط والإتقان</h4><div class="metricInputs">
          ${numericInput({ subjectIndex, field: 'schoolAvg', label: 'متوسط المدرسة', value: subject.schoolAvg })}
          ${numericInput({ subjectIndex, field: 'averageChange', label: 'تغير المتوسط', value: subject.averageChange })}
          ${numericInput({ subjectIndex, field: 'mastery', label: 'الإتقان ٪', value: subject.mastery })}
          ${numericInput({ subjectIndex, field: 'masteryChange', label: 'تغير الإتقان', value: subject.masteryChange })}
          ${numericInput({ subjectIndex, field: 'target', label: 'المستهدف القريب ٪', value: subject.target })}
          ${numericInput({ subjectIndex, field: 'target2030', label: 'مستهدف ٢٠٣٠ ٪', value: subject.target2030 })}
        </div></section>
        <section class="subBlock domainsBlock">
          <div class="panelTitle"><div><h4>المجالات الفرعية</h4><p>الخانة الفارغة تعني أن القيمة لم تُقرأ، وليست صفرًا.</p></div><button type="button" class="button secondary small" data-action="add-domain" data-subject-index="${subjectIndex}">إضافة مجال</button></div>
          <div class="tableWrap"><table class="editTable"><thead><tr><th>المجال</th><th>المدرسة ٪</th><th>إدارة التعليم ٪</th><th>المملكة ٪</th><th>المستهدف ٪</th><th>إجراء</th></tr></thead><tbody>${(subject.domains || []).map((domain, domainIndex) => domainRow(subjectIndex, domainIndex, domain)).join('')}</tbody></table></div>
        </section>
      </div>
    </article>
  `).join('');

  const existing = new Set(state.data.subjects.map(subject => subject.name));
  const gradeProfile = GRADE_META[state.data.grade];
  const missing = gradeProfile ? gradeProfile.subjects.filter(subject => !existing.has(subject)) : [];
  const addPanel = missing.length ? `<article class="addSubjectPanel"><strong>مادة مدعومة غير مضافة:</strong>${missing.map(name => `<button type="button" class="button secondary small" data-action="add-subject" data-subject-name="${esc(name)}">${esc(name)}</button>`).join('')}</article>` : '';
  els.subjectsRoot.innerHTML = cards + addPanel;
}

function renderValidation() {
  const analysis = analyzeData(state.data);
  const issues = analysis.validation || [];
  const errors = issues.filter(item => item.level === 'error');
  const warnings = issues.filter(item => item.level === 'warning');
  els.validationCounter.className = `badge ${errors.length ? 'bad' : warnings.length ? 'warn' : 'good'}`;
  els.validationCounter.textContent = `${fmt(errors.length, true)} أخطاء · ${fmt(warnings.length, true)} تنبيهات`;

  const sourceWarnings = state.warnings.map(message => ({ level: 'warning', message, code: 'reader-warning' }));
  const all = [...sourceWarnings, ...issues];
  els.validationRoot.innerHTML = `<div class="validationSummary">
    <div><b>${fmt(errors.length, true)}</b><small>أخطاء مانعة</small></div>
    <div><b>${fmt(warnings.length + sourceWarnings.length, true)}</b><small>تنبيهات للمراجعة</small></div>
    <div><b>${fmt(state.data.subjects.length, true)}</b><small>مواد مدخلة</small></div>
  </div><div class="issueList">${all.length ? all.map(item => `<div class="issue ${esc(item.level)}"><span>${item.level === 'error' ? '⛔' : '⚠️'}</span><div>${esc(item.message)}${item.code ? `<br><code>${esc(item.code)}</code>` : ''}</div></div>`).join('') : '<div class="issue good"><span>✓</span><div>اجتازت البيانات اختبارات الاتساق الأساسية. تبقى المقارنة بالبطاقة الأصلية إلزامية.</div></div>'}</div>`;
  return analysis;
}

function renderReview() {
  state.data = normalizeData(state.data);
  resetApprovalAndOutput();
  els.sourceBadge.textContent = sourceLabel(state.sourceMode);
  els.sourceBadge.className = `badge ${state.sourceMode === 'ocr' || state.sourceMode === 'pdf-hybrid' ? 'warn' : 'good'}`;
  renderMetadata();
  renderSubjects();
  renderValidation();
  show(els.reviewSection);
}

function inputValueFromElement(element) {
  if (element.type === 'number') return element.value === '' ? '' : Number(element.value);
  return element.value;
}

function resetAfterEdit() {
  resetApprovalAndOutput();
  renderValidation();
}

function changeGrade(grade) {
  const meta = GRADE_META[grade];
  if (!meta) {
    state.data.grade = '';
    state.data.gradeName = '';
    state.data.stage = '';
    renderMetadata();
    renderSubjects();
    return;
  }
  const existing = new Map(state.data.subjects.map(subject => [subject.name, subject]));
  state.data.grade = grade;
  state.data.gradeName = meta.name;
  state.data.stage = meta.stage;
  state.data.subjects = meta.subjects.map(name => existing.get(name) || blankSubject(name, grade));
  renderMetadata();
  renderSubjects();
}

function handleReviewInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
  if (target === els.reviewConfirmed) return;

  if (target.dataset.meta) {
    const key = target.dataset.meta;
    if (key !== 'pageCount') state.data[key] = inputValueFromElement(target);
    if (key === 'grade') changeGrade(state.data.grade);
    resetAfterEdit();
    return;
  }

  const subjectIndex = Number(target.dataset.subjectIndex);
  if (!Number.isInteger(subjectIndex) || !state.data.subjects[subjectIndex]) return;
  if (target.dataset.subjectField) {
    state.data.subjects[subjectIndex][target.dataset.subjectField] = inputValueFromElement(target);
    resetAfterEdit();
    return;
  }

  const domainIndex = Number(target.dataset.domainIndex);
  if (target.dataset.domainField && Number.isInteger(domainIndex) && state.data.subjects[subjectIndex].domains[domainIndex]) {
    state.data.subjects[subjectIndex].domains[domainIndex][target.dataset.domainField] = inputValueFromElement(target);
    resetAfterEdit();
  }
}

function handleReviewAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const subjectIndex = Number(button.dataset.subjectIndex);

  if (action === 'add-subject') {
    const name = button.dataset.subjectName;
    if (name && !state.data.subjects.some(subject => subject.name === name)) state.data.subjects.push(blankSubject(name, state.data.grade));
  } else if (action === 'remove-subject' && Number.isInteger(subjectIndex)) {
    state.data.subjects.splice(subjectIndex, 1);
  } else if (action === 'add-domain' && state.data.subjects[subjectIndex]) {
    state.data.subjects[subjectIndex].domains.push({ name: '', value: '', admin: '', kingdom: '', benchmark: '' });
  } else if (action === 'remove-domain' && state.data.subjects[subjectIndex]) {
    const domainIndex = Number(button.dataset.domainIndex);
    if (Number.isInteger(domainIndex)) state.data.subjects[subjectIndex].domains.splice(domainIndex, 1);
  }
  renderSubjects();
  resetAfterEdit();
}

async function handleFile(file, { forceOcr = false } = {}) {
  if (!file || state.reading) return;
  state.controller?.abort();
  state.controller = new AbortController();
  state.file = file;
  // عزل كل عملية قراءة عن السابقة: لا تبقى أي بيانات مدرسة/ملف سابق في الحالة.
  state.data = normalizeData(makeBlankData());
  state.analysis = null;
  state.worksheets = [];
  state.warnings = [];
  state.previews = [];
  state.rawText = '';
  state.diagnostics = null;
  hide(els.reviewSection);
  hide(els.outputSection);
  hide(els.rawTextBtn);
  hide(els.readerResultActions);
  hide(els.retryOcrBtn);
  renderFileSummary({ type: file.type || '—', size: file.size }, null);
  renderEmptyPreview();
  setReading(true);

  try {
    // المسار الأساسي في الإصدار ٧: AI يقرأ، والتحليل الحسابي وخطة التحسين تبقيان محليين.
    if (isAiConfigured() && !forceOcr) {
      setStatus('بدأت القراءة بالذكاء الاصطناعي الآمن. سيُرسل محتوى البطاقة مؤقتًا عبر الخادم الوسيط، دون اسم الملف الأصلي.', 'good');

      // المعاينة فقط تتم محليًا لتتمكني من مطابقة الأرقام بصريًا. فشل المعاينة لا يمنع AI.
      let previewResult = null;
      try {
        previewResult = await readNafisFile(file, {
          allowOcr: false,
          forceOcr: false,
          signal: state.controller.signal,
          onProgress: progress => {
            const value = Math.min(18, Math.round((progress?.value || 0) * 0.18));
            updateProgress({ ...progress, value, message: 'تجهيز المعاينة المحلية' });
          }
        });
      } catch (previewError) {
        if (previewError?.name === 'AbortError') throw previewError;
        state.warnings.push('تعذرت معاينة بعض الصفحات محليًا، لكن استمرت قراءة AI.');
      }

      const ai = await readNafisWithAI(file, {
        gradeHint: els.gradeHint.value || '',
        signal: state.controller.signal,
        onProgress: updateProgress
      });
      const aiData = { ...(ai.data || {}) };
      aiData.source = 'ai-secure';
      aiData.pageCount = aiData.pageCount || previewResult?.pages?.length || 0;

      // بيانات الصفحة الأولى المباشرة (العام الدراسي، الإدارة، المنطقة...)
      // تُستخدم فقط لملء ما تركه AI فارغًا، ولا تستبدل نتائج المواد المقروءة بالذكاء الاصطناعي.
      let localMetadata = null;
      if (previewResult?.pages?.length) {
        try {
          localMetadata = parseNafisDocument(previewResult.pages, {
            source: previewResult.extractionMode || 'pdf-text',
            gradeHint: els.gradeHint.value || aiData.grade || ''
          });
        } catch (metadataError) {
          console.warn('تعذر دمج بيانات الصفحة الأولى المحلية', metadataError);
        }
      }
      const combinedData = localMetadata ? mergeParsedData(aiData, localMetadata) : aiData;
      // لا نقبل نوع مدرسة افترضه النموذج ما لم يظهر حرفيًا في طبقة النص المحلية.
      const localEvidenceText = String(previewResult?.rawText || (previewResult?.pages || []).map(page => page?.text || '').join(' '));
      if (!/(حكومي|أهلي|عالمي)/.test(localEvidenceText)) combinedData.schoolType = 'غير محدد';
      state.data = normalizeData(combinedData);
      state.sourceMode = 'ai-secure';
      state.warnings = [...state.warnings, ...(ai.warnings || [])];
      state.previews = previewResult?.previews || [];
      state.rawText = '';
      state.diagnostics = ai.meta || null;

      const quality = extractionQuality(state.data);
      renderFileSummary({ type: file.type || '—', size: file.size, ai: true }, state.data.pageCount || null, quality);
      renderPreviews();
      renderReview();
      show(els.readerResultActions);
      hide(els.retryOcrBtn);
      if (quality.usable) {
        setStatus(`اكتملت قراءة AI واستخراج ${fmt(quality.foundExpected, true)} مادة. راجعي جميع القيم مقابل البطاقة قبل الاعتماد.`, quality.needsOcr ? 'warn' : 'good');
      } else {
        setStatus('اكتملت قراءة AI، لكن بعض البيانات الأساسية بقيت غير مؤكدة. لم تُخمَّن القيم؛ راجعي الخانات الفارغة وأدخليها يدويًا.', 'warn');
      }
      scrollToElement(els.reviewSection);
      return;
    }

    // المسار المحلي الاحتياطي عند عدم ربط AI أو عند اختيار OCR يدويًا.
    setStatus(forceOcr ? 'بدأت إعادة القراءة الضوئية المحلية.' : 'قارئ AI غير مربوط؛ يجري استخدام القارئ المحلي الاحتياطي.', 'warn');
    let result = await readNafisFile(file, {
      allowOcr: els.ocrToggle.checked,
      forceOcr,
      signal: state.controller.signal,
      onProgress: updateProgress
    });
    let parsed = parseNafisDocument(result.pages, {
      source: result.extractionMode,
      gradeHint: els.gradeHint.value || ''
    });
    let quality = extractionQuality(parsed);

    if (!forceOcr && els.ocrToggle.checked && result.type === 'pdf' && quality.needsOcr && (result.pages?.length || 0) <= APP_CONFIG.maxOcrPages) {
      setStatus('القارئ المحلي لم يستخرج القيم بثقة؛ يجري تشغيل OCR كامل مرة واحدة. لا تُعتمد أي قيمة تخمينية.', 'warn');
      const firstResult = result;
      const ocrResult = await readNafisFile(file, {
        allowOcr: true,
        forceOcr: true,
        signal: state.controller.signal,
        onProgress: updateProgress
      });
      const ocrParsed = parseNafisDocument(ocrResult.pages, {
        source: ocrResult.extractionMode,
        gradeHint: els.gradeHint.value || parsed.grade || ''
      });
      parsed = mergeParsedData(parsed, ocrParsed);
      quality = extractionQuality(parsed);
      result = {
        ...ocrResult,
        previews: firstResult.previews?.length ? firstResult.previews : ocrResult.previews,
        rawText: [firstResult.rawText, ocrResult.rawText].filter(Boolean).join('\n\n--- OCR ---\n\n'),
        warnings: [...(firstResult.warnings || []), ...(ocrResult.warnings || []), 'تم تشغيل OCR المحلي كاملًا لأن الاستخراج الأول كان غير مكتمل.'],
        extractionMode: 'pdf-hybrid'
      };
    }

    parsed.source = result.extractionMode;
    parsed.pageCount = result.pages.length;
    state.data = normalizeData(parsed);
    state.sourceMode = result.extractionMode;
    state.warnings = result.warnings || [];
    state.previews = result.previews || [];
    state.rawText = result.rawText || '';
    state.diagnostics = result.diagnostics || null;
    quality = extractionQuality(state.data);
    renderFileSummary(result.meta, result.pages.length, quality);
    renderPreviews();
    if (state.rawText) show(els.rawTextBtn);
    renderReview();
    show(els.readerResultActions);
    if (quality.needsOcr && !forceOcr && result.type === 'pdf') show(els.retryOcrBtn);
    else hide(els.retryOcrBtn);

    if (quality.usable) {
      setStatus(`اكتملت القراءة المحلية واستخراج ${fmt(quality.foundExpected, true)} مادة. راجعيها قبل الاعتماد.`, quality.needsOcr ? 'warn' : 'good');
    } else {
      setStatus('القارئ المحلي لم يستخرج القيم بما يكفي. لا تعتمدي النتائج قبل الإدخال اليدوي أو ربط قارئ AI.', 'warn');
    }
    scrollToElement(els.reviewSection);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    console.error(error);
    state.warnings = [error?.message || 'تعذر قراءة الملف.'];
    setStatus(`${error?.message || 'تعذر قراءة الملف.'} لم تُعتمد أي قيمة. يمكنك استخدام الإدخال اليدوي.`, 'error');
  } finally {
    setReading(false);
  }
}

function loadManual() {
  clearAll({ quiet: true });
  state.data = normalizeData(makeBlankData(), { fillExpectedSubjects: true });
  state.data.source = 'manual';
  state.sourceMode = 'manual';
  state.warnings = ['تم فتح نموذج الإدخال اليدوي. أدخلي القيم كما تظهر في البطاقة الأصلية.'];
  renderReview();
  setStatus('نموذج الإدخال اليدوي جاهز.', 'good');
  scrollToElement(els.reviewSection);
}

function loadDemo(gradeOverride = '') {
  clearAll({ quiet: true });
  const grade = GRADE_META[gradeOverride] ? gradeOverride : (els.gradeHint.value || 'g6');
  els.gradeHint.value = grade;
  state.data = normalizeData(makeDemoData(grade));
  state.sourceMode = 'demo';
  state.warnings = ['هذه بيانات افتراضية عامة للتجربة ولا ترتبط بأي مدرسة أو مستخدم.'];
  renderReview();
  setStatus(`تم تحميل بيانات تجريبية للصف ${gradeMeta(grade).name}.`, 'good');
  scrollToElement(els.reviewSection);
}

function requireApprovedData() {
  const analysis = renderValidation();
  if (!els.reviewConfirmed.checked) {
    const panel = els.reviewConfirmed.closest('.approvalPanel');
    panel?.classList.add('shake');
    setTimeout(() => panel?.classList.remove('shake'), 520);
    setStatus('راجعي القيم ثم فعّلي مربع تأكيد المراجعة.', 'warn');
    scrollToElement(panel);
    return null;
  }
  if (analysis.hasBlockingErrors) {
    setStatus('توجد أخطاء حمراء يجب تصحيحها قبل إنشاء التحليل.', 'error');
    scrollToElement(els.validationRoot);
    return null;
  }
  return analysis;
}

function kpi(label, value, note = '') {
  return `<article class="kpiCard"><span>${esc(label)}</span><b>${esc(value)}</b>${note ? `<small>${esc(note)}</small>` : ''}</article>`;
}

function performanceSegment(subject) {
  const values = [subject.veryLow, subject.low, subject.medium, subject.high].map(clampPercent);
  const classes = ['vl', 'lo', 'me', 'hi'];
  return `<div class="segmented" aria-label="توزيع مستويات الأداء">${values.map((value, index) => `<span class="seg ${classes[index]}" style="width:${value}%">${value >= 9 ? `${fmt(value)}٪` : ''}</span>`).join('')}</div>`;
}

function priorityBadge(severity) {
  return `<span class="priorityBadge ${esc(severity)}">${esc(severityLabel(severity))}</span>`;
}

function compareBar(value, reference) {
  const school = clampPercent(value);
  const ref = clampPercent(reference);
  return `<div class="barCompare">
    <div class="barLine"><span>المدرسة</span><div class="barTrack"><i style="width:${school}%"></i></div><b>${number(value) === null ? '—' : fmt(value)}</b></div>
    <div class="barLine ref"><span>المرجع</span><div class="barTrack"><i style="width:${ref}%"></i></div><b>${number(reference) === null ? '—' : fmt(reference)}</b></div>
  </div>`;
}

function actorBlock(title, items) {
  return `<div class="actor"><b>${esc(title)}</b><ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>`;
}

function worksheetHtml(sheet, { includeAnswers = true, open = false } = {}) {
  return `<details class="worksheetCard"${open ? ' open' : ''}>
    <summary><span>${esc(sheet.title)}</span><small>${esc(severityLabel(sheet.priority?.severity || 'diagnostic'))}</small></summary>
    <div class="worksheetBody">
      <div class="worksheetNotice">${esc(sheet.disclaimer)}</div>
      <ol class="questionList">${sheet.questions.map(question => `<li><b>${esc(question.type)}:</b> ${esc(question.text)}</li>`).join('')}</ol>
      ${includeAnswers ? `<div class="tableWrap answerTable"><table class="dataTable"><thead><tr><th>م</th><th>الإجابة الصحيحة / المحك</th></tr></thead><tbody>${sheet.questions.map(question => `<tr><td>${fmt(question.number, true)}</td><td>${esc(question.answer)}${question.explanation ? `<br><small>${esc(question.explanation)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </div>
  </details>`;
}

function renderAnalysis() {
  const a = state.analysis;
  const e = a.executive;
  const weak = e.weakest;
  const strong = e.strongest;

  const subjectCards = a.interpretations.map((item, index) => {
    const subject = a.subjects[index];
    return `<article class="subjectSummary"><h4>${esc(item.name)}</h4>${performanceSegment(subject)}<div class="miniKpis">
      <div><small>المتوسط</small><b>${fmt(item.average)}</b></div>
      <div><small>الإتقان</small><b>${pct(item.mastery)}</b></div>
      <div><small>المستويان المنخفضان</small><b>${pct(item.lowCombined)}</b></div>
    </div><ul class="observationList">${item.observations.length ? item.observations.map(text => `<li>${esc(text)}</li>`).join('') : '<li>البيانات غير مكتملة وتحتاج مراجعة.</li>'}</ul></article>`;
  }).join('');

  const priorities = a.priorities.map(priority => `<tr>
    <td><b>${esc(priority.subject)}</b><br>${esc(priority.domain)}</td>
    <td>${compareBar(priority.value, priority.reference)}</td>
    <td>${priority.gap === null ? '—' : `${signed(priority.gap)} نقطة`}</td>
    <td>${priorityBadge(priority.severity)}</td>
    <td>${esc(priority.reason)}</td>
  </tr>`).join('');

  const actions = a.actionUnits.map(unit => `<article class="actionCard">
    <header class="actionHead"><div><h4>${fmt(unit.order, true)}. ${esc(unit.subject)} — ${esc(unit.domain)}</h4><small>${esc(unit.reason)}</small></div>${priorityBadge(unit.severity)}</header>
    <div class="actionBody"><div class="actorGrid">
      ${actorBlock('الطالب', unit.studentActions)}
      ${actorBlock('المعلم/ة', unit.teacherActions)}
      ${actorBlock('الأسرة', unit.familyActions)}
      ${actorBlock('القيادة المدرسية', unit.leadershipActions)}
    </div><div class="successLine"><b>محك النجاح:</b> ${esc(unit.successCriterion)}</div></div>
  </article>`).join('');

  const impactEntries = [
    ['خط الأساس', a.impact.baseline],
    ['المتابعة التكوينية', a.impact.formative],
    ['القياس البعدي', a.impact.post],
    ['حساب التحسن', a.impact.calculation],
    ['قرار الاستمرار أو التعديل', a.impact.decision]
  ];

  els.analysisRoot.innerHTML = `
    <section class="analysisBlock"><h3>الملخص التنفيذي</h3><p class="analysisIntro">مؤشرات مختصرة مبنية على القيم التي تمت مراجعتها.</p><div class="metricsGrid">
      ${kpi('نسبة المشاركة', pct(e.participation), number(state.data.tested) !== null && number(state.data.total) !== null ? `${fmt(state.data.tested, true)} من ${fmt(state.data.total, true)}` : '')}
      ${kpi('متوسط إتقان المواد', pct(e.averageMastery), 'متوسط المواد المكتملة')}
      ${kpi('متوسط الدرجات', fmt(e.averageScore), 'ليس نسبة الإتقان')}
      ${kpi('الإتقان العام', pct(e.overallMastery), 'كما ورد في البطاقة')}
      ${kpi('التغير العام', signed(e.overallChange), 'مرتبط بالمؤشر العام')}
      ${kpi('أعلى مجال', strong ? pct(strong.value) : '—', strong ? `${strong.subject} · ${strong.domain}` : '')}
    </div></section>

    <section class="analysisBlock"><h3>تفسير المواد</h3><p class="analysisIntro">وصف مباشر للبيانات دون افتراض أسباب لم تثبت بقياس تشخيصي.</p><div class="subjectSummaryGrid">${subjectCards}</div></section>

    <section class="analysisBlock"><h3>تصنيف المجالات حسب الحاجة</h3><p class="analysisIntro">التصنيف: علاجي عند فجوة كبيرة، تحسين عند فجوة متوسطة، ومحافظة على القوة عندما يكون الأداء قريبًا من المرجع أو أعلى منه.</p><div class="tableWrap"><table class="dataTable"><thead><tr><th>المادة والمجال</th><th>المقارنة</th><th>الفجوة</th><th>التصنيف</th><th>التفسير</th></tr></thead><tbody>${priorities}</tbody></table></div></section>

    <section class="analysisBlock"><h3>خطة التحسين العملية</h3><p class="analysisIntro">إجراءات مرتبطة بالأولوية وشواهد قابلة للمتابعة.</p>${actions ? `<div class="actionGrid">${actions}</div>` : '<div class="issue good">لا توجد مجالات مصنفة كعلاجية أو تحسين وفق البيانات المكتملة.</div>'}</section>

    <section class="analysisBlock"><h3>قياس الأثر</h3><div class="impactGrid">${impactEntries.map(([title, text]) => `<article class="impactCard"><b>${esc(title)}</b><p>${esc(text)}</p></article>`).join('')}</div></section>

    <section class="analysisBlock"><h3>خطة زمنية لأربعة أسابيع</h3><div class="timelineGrid">${a.timeline.map(item => `<article class="timelineItem"><span>${esc(item.week)}</span><h4>${esc(item.title)}</h4><p>${esc(item.tasks)}</p></article>`).join('')}</div></section>

    <section class="analysisBlock"><h3>أوراق العمل ونماذج الإجابة</h3><p class="analysisIntro">١٠ أسئلة متدرجة، وسؤالان للتفكير، و٣ أسئلة ختامية لكل أولوية.</p>${state.worksheets.length ? `<div class="worksheetList">${state.worksheets.map(sheet => worksheetHtml(sheet)).join('')}</div>` : '<div class="issue good">لا تُنشأ ورقة عمل إلا لمجال مصنف علاجيًا أو للتحسين.</div>'}</section>
  `;
}

function reportSubjectHtml(subject, interpretation) {
  return `<article class="reportSubject">
    <header class="reportSubjectHead"><h4>${esc(subject.name)}</h4><span>المتوسط ${fmt(subject.schoolAvg)} · الإتقان ${pct(subject.mastery)}</span></header>
    <div class="reportSubjectBody"><div class="reportLevels">
      <div class="reportLevel vl"><small>منخفض جدًا</small><b>${pct(subject.veryLow)}</b></div>
      <div class="reportLevel lo"><small>منخفض</small><b>${pct(subject.low)}</b></div>
      <div class="reportLevel me"><small>متوسط</small><b>${pct(subject.medium)}</b></div>
      <div class="reportLevel hi"><small>مرتفع</small><b>${pct(subject.high)}</b></div>
    </div><p class="reportNarrative">${esc(interpretation.observations.join(' ') || 'البيانات تحتاج مراجعة إضافية.')}</p></div>
  </article>`;
}

function reportWorksheetsHtml() {
  if (!els.includeWorksheets.checked || !state.worksheets.length) return '';
  return `<section class="reportSection pageBreak"><div class="reportSectionTitle"><span>٧</span><h3>أوراق العمل العلاجية ونماذج الإجابة</h3></div>${state.worksheets.map(sheet => `<article class="reportWorksheet"><h4>${esc(sheet.title)}</h4><p class="worksheetNotice">${esc(sheet.disclaimer)}</p><ol>${sheet.questions.map(question => `<li><b>${esc(question.type)}:</b> ${esc(question.text)}</li>`).join('')}</ol><div class="tableWrap reportWorksheetAnswers"><table class="dataTable"><thead><tr><th>م</th><th>الإجابة / المحك</th></tr></thead><tbody>${sheet.questions.map(question => `<tr><td>${fmt(question.number, true)}</td><td>${esc(question.answer)}</td></tr>`).join('')}</tbody></table></div></article>`).join('')}</section>`;
}

function buildReportHtml() {
  const d = state.data;
  const a = state.analysis;
  const e = a.executive;
  const validationWarnings = a.validation.filter(item => item.level === 'warning');
  const domains = a.subjects.flatMap(subject => (subject.domains || []).map(domain => {
    const priority = a.priorities.find(item => item.subject === subject.name && item.domain === domain.name);
    return `<tr><td><b>${esc(subject.name)}</b></td><td>${esc(domain.name)}</td><td>${pct(domain.value)}</td><td>${pct(domain.admin)}</td><td>${pct(domain.kingdom)}</td><td>${pct(domain.benchmark)}</td><td>${priority ? priorityBadge(priority.severity) : '—'}</td></tr>`;
  })).join('');

  const remedial = a.priorities.filter(item => item.severity === 'remedial');
  const improvement = a.priorities.filter(item => item.severity === 'improvement');
  const sustain = a.priorities.filter(item => item.severity === 'sustain');

  const actionSection = a.actionUnits.length
    ? a.actionUnits.map(unit => `<article class="reportAction ${esc(unit.severity)}"><h4>${fmt(unit.order, true)}. ${esc(unit.subject)} — ${esc(unit.domain)}</h4><p>${esc(unit.reason)}</p><ul>${unit.teacherActions.map(item => `<li>${esc(item)}</li>`).join('')}</ul><p><b>محك النجاح:</b> ${esc(unit.successCriterion)}</p></article>`).join('')
    : '<p>لا توجد مجالات مصنفة كأولوية علاجية أو تحسين وفق القيم المرجعية المكتملة.</p>';

  const sustainSection = sustain.length
    ? `<div class="sustainGrid">${sustain.map(item => `<article class="sustainCard"><b>${esc(item.subject)} — ${esc(item.domain)}</b><p>${esc(item.reason)}</p><small>الإجراء: تثبيت الممارسة الناجحة، متابعة دورية، وإثراء للمتقنين.</small></article>`).join('')}</div>`
    : '<p class="muted">لا توجد مجالات مكتملة مصنفة للمحافظة على القوة.</p>';

  const academicYearText = hasValue(d.academicYear) ? toArabicDigits(String(d.academicYear)) : '—';
  const measurementYearText = number(d.measurementYear) === null ? '—' : fmt(d.measurementYear, true);

  return `<article class="reportDocument">
    <header class="reportCover"><div class="reportCoverInner"><div><small>لوحة تحليل نتائج نافس وخطة رفع مستوى الأداء</small><h2>${esc(d.school || 'المدرسة')}</h2><p>${esc(d.gradeName || gradeMeta(d.grade).name)} · العام الدراسي ${esc(academicYearText)} · سنة القياس ${esc(measurementYearText)}</p></div><img class="reportLogo" src="assets/images/logo.jpg" alt="شعار ملتقى التعليم التفاعلي"></div></header>
    <div class="reportMeta">
      <div><small>الصف</small><b>${esc(d.gradeName || gradeMeta(d.grade).name)}</b></div>
      <div><small>العام الدراسي</small><b>${esc(academicYearText)}</b></div>
      <div><small>سنة القياس</small><b>${esc(measurementYearText)}</b></div>
      <div><small>الرقم الوزاري</small><b>${esc(d.ministerialId || '—')}</b></div>
      <div><small>الطلبة</small><b>${fmt(d.total, true)}</b></div>
      <div><small>المختبرون</small><b>${fmt(d.tested, true)}</b></div>
      <div><small>الفئة</small><b>${esc(d.gender || '—')}</b></div>
      <div><small>نوع المدرسة</small><b>${esc(d.schoolType || 'غير محدد')}</b></div>
      <div><small>إدارة التعليم</small><b>${esc(d.educationAdministration || '—')}</b></div>
      <div><small>المنطقة</small><b>${esc(d.region || '—')}</b></div>
    </div>
    <div class="reportBody">
      <section class="reportSection"><div class="reportSectionTitle"><span>١</span><h3>الملخص التنفيذي</h3></div><div class="reportExecutive">
        <div class="reportMetric"><small>المشاركة</small><b>${pct(e.participation)}</b></div>
        <div class="reportMetric"><small>متوسط الإتقان</small><b>${pct(e.averageMastery)}</b></div>
        <div class="reportMetric"><small>متوسط الدرجات</small><b>${fmt(e.averageScore)}</b></div>
        <div class="reportMetric"><small>الإتقان العام</small><b>${pct(e.overallMastery)}</b></div>
        <div class="reportMetric"><small>التغير العام</small><b>${signed(e.overallChange)}</b></div>
      </div><p class="reportNarrative">تم بناء التقرير من بيانات الملف الحالي بعد مراجعة المستخدم. لا يحتفظ التقرير بأي قيم من ملف سابق، ولا يفترض بيانات مدرسة أو نوع مدرسة غير موجودة في المصدر.</p></section>

      <section class="reportSection"><div class="reportSectionTitle"><span>٢</span><h3>مؤشرات المواد</h3></div><div class="reportSubjects">${a.subjects.map((subject, index) => reportSubjectHtml(subject, a.interpretations[index])).join('')}</div></section>

      <section class="reportSection"><div class="reportSectionTitle"><span>٣</span><h3>المجالات والمراجع والتصنيف</h3></div><div class="tableWrap"><table class="dataTable"><thead><tr><th>المادة</th><th>المجال</th><th>المدرسة</th><th>إدارة التعليم</th><th>المملكة</th><th>المستهدف</th><th>التصنيف</th></tr></thead><tbody>${domains}</tbody></table></div></section>

      <section class="reportSection"><div class="reportSectionTitle"><span>٤</span><h3>الأولويات وخطة التحسين</h3></div>
        <div class="classificationSummary"><span class="classChip remedial">علاجي: ${fmt(remedial.length, true)}</span><span class="classChip improvement">تحسين: ${fmt(improvement.length, true)}</span><span class="classChip sustain">محافظة على القوة: ${fmt(sustain.length, true)}</span></div>
        ${actionSection}
        <h4 class="subsectionTitle">مجالات المحافظة على القوة</h4>${sustainSection}
      </section>

      <section class="reportSection"><div class="reportSectionTitle"><span>٥</span><h3>قياس الأثر</h3></div><div class="impactGrid"><article class="impactCard"><b>القياس القبلي</b><p>${esc(a.impact.baseline)}</p></article><article class="impactCard"><b>المتابعة</b><p>${esc(a.impact.formative)}</p></article><article class="impactCard"><b>القياس البعدي</b><p>${esc(a.impact.post)}</p></article><article class="impactCard"><b>اتخاذ القرار</b><p>${esc(a.impact.decision)}</p></article></div></section>

      <section class="reportSection"><div class="reportSectionTitle"><span>٦</span><h3>الخطة الزمنية</h3></div><div class="timelineGrid">${a.timeline.map(item => `<article class="timelineItem"><span>${esc(item.week)}</span><h4>${esc(item.title)}</h4><p>${esc(item.tasks)}</p></article>`).join('')}</div></section>

      ${validationWarnings.length ? `<section class="reportSection"><div class="reportSectionTitle"><span>!</span><h3>ملاحظات التحقق</h3></div><ul class="observationList">${validationWarnings.map(item => `<li>${esc(item.message)}</li>`).join('')}</ul></section>` : ''}
      ${reportWorksheetsHtml()}
    </div>
    <footer class="reportFooter"><small class="reportDisclaimer">تحليل مدرسي مساند مبني على بيانات راجعها المستخدم واعتمدها. لا يُعد تقريرًا رسميًا صادرًا من هيئة تقويم التعليم والتدريب، ولا يثبت سببًا للنتائج دون تشخيص إضافي.</small><div class="reportSignature"><img src="assets/images/logo.jpg" alt=""><div><b>${esc(APP_CONFIG.ownerName)}</b><span>${APP_CONFIG.communities.map(esc).join(' · ')}</span></div></div></footer>
  </article>`;
}

function buildAnalysis() {
  const analysis = requireApprovedData();
  if (!analysis) return;
  state.analysis = analysis;
  state.worksheets = worksheetsForAnalysis(state.data, analysis);
  renderAnalysis();
  els.reportRoot.innerHTML = buildReportHtml();
  show(els.outputSection);
  setStatus('اكتمل التحليل وبناء التقرير. راجعي المخرجات قبل التصدير.', 'good');
  scrollToElement(els.outputSection);
}

function ensureExportReady() {
  if (!state.analysis) {
    const analysis = requireApprovedData();
    if (!analysis) return false;
    state.analysis = analysis;
    state.worksheets = worksheetsForAnalysis(state.data, analysis);
  }
  if (state.analysis.hasBlockingErrors) return false;
  els.reportRoot.innerHTML = buildReportHtml();
  return true;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1800);
}

async function exportOffice(type) {
  if (!ensureExportReady()) return;
  try {
    let bytes;
    let mime;
    if (type === 'docx') {
      bytes = buildDocx(state.data, state.analysis, els.includeWorksheets.checked ? state.worksheets : []);
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (type === 'xlsx') {
      bytes = buildXlsx(state.data, state.analysis);
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      bytes = await buildPptx(state.data, state.analysis);
      mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    downloadBlob(new Blob([bytes], { type: mime }), safeDownloadName(type));
    setStatus(`تم إنشاء ملف ${type.toUpperCase()} محليًا.`, 'good');
  } catch (error) {
    console.error(error);
    setStatus(`تعذر إنشاء ملف ${type.toUpperCase()}: ${error.message}`, 'error');
  }
}

function exportJson() {
  if (!ensureExportReady()) return;
  const payload = {
    schema: 'nafis-results-secure',
    version: APP_CONFIG.versionCode,
    exportedAt: new Date().toISOString(),
    data: state.data,
    analysis: state.analysis
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    safeDownloadName('json')
  );
}

function chooseFile() {
  if (!state.reading) els.fileInput.click();
}

// بعض مجموعات الأزرار اختيارية (مثل أزرار البيانات التجريبية التي أزيلت من النسخة العامة).
// لا نوقف التطبيق كله إذا كانت المجموعة الاختيارية فارغة؛ نتحقق فقط من العناصر المفردة الإلزامية.
const missingElements = Object.entries(els)
  .filter(([, value]) => !Array.isArray(value) && !value)
  .map(([key]) => key);
if (missingElements.length) {
  throw new Error(`تعذر تشغيل الواجهة: عناصر مفقودة (${missingElements.join(', ')}).`);
}

document.querySelectorAll('[data-hero-action]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.heroAction === 'manual') loadManual();
    else {
      scrollToElement(document.querySelector('#readerSection'));
      chooseFile();
    }
  });
});

els.chooseFileBtn.addEventListener('click', event => { event.stopPropagation(); chooseFile(); });
els.fileInput.addEventListener('change', () => handleFile(els.fileInput.files?.[0]));
els.dropZone.addEventListener('click', event => { if (!event.target.closest('button')) chooseFile(); });
els.dropZone.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseFile(); }
});
['dragenter', 'dragover'].forEach(type => els.dropZone.addEventListener(type, event => {
  event.preventDefault();
  els.dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach(type => els.dropZone.addEventListener(type, event => {
  event.preventDefault();
  els.dropZone.classList.remove('dragging');
}));
els.dropZone.addEventListener('drop', event => handleFile(event.dataTransfer?.files?.[0]));
els.jumpReviewBtn.addEventListener('click', () => scrollToElement(els.reviewSection));
els.retryOcrBtn.addEventListener('click', () => { if (state.file) handleFile(state.file, { forceOcr: true }); });

els.demoButtons.forEach(button => button.addEventListener('click', () => loadDemo(button.dataset.demoGrade || '')));
els.manualBtn.addEventListener('click', loadManual);
els.resetBtn.addEventListener('click', () => clearAll());
els.metadataFields.addEventListener('input', handleReviewInput);
els.metadataFields.addEventListener('change', handleReviewInput);
els.subjectsRoot.addEventListener('input', handleReviewInput);
els.subjectsRoot.addEventListener('change', handleReviewInput);
els.subjectsRoot.addEventListener('click', handleReviewAction);
els.reviewConfirmed.addEventListener('change', () => {
  if (els.reviewConfirmed.checked) setStatus('تم تأكيد المراجعة البشرية. يمكنك بناء التحليل.', 'good');
});
els.analyzeBtn.addEventListener('click', buildAnalysis);
els.includeWorksheets.addEventListener('change', () => {
  if (state.analysis) els.reportRoot.innerHTML = buildReportHtml();
});
els.printBtn.addEventListener('click', () => {
  if (!ensureExportReady()) return;
  window.print();
});
els.wordBtn.addEventListener('click', () => exportOffice('docx'));
els.excelBtn.addEventListener('click', () => exportOffice('xlsx'));
els.pptBtn.addEventListener('click', () => exportOffice('pptx'));
els.jsonBtn.addEventListener('click', exportJson);
els.testAiBtn.addEventListener('click', () => { void refreshAiStatus(); });
els.privacyBtn.addEventListener('click', () => els.privacyDialog.showModal());
els.rawTextBtn.addEventListener('click', () => {
  els.rawText.textContent = state.rawText || 'لا يوجد نص خام متاح.';
  els.rawDialog.showModal();
});
window.addEventListener('beforeunload', () => state.controller?.abort());


async function refreshAiStatus() {
  if (!els.aiStatusBadge || !els.aiStatusText) return;
  if (!isAiConfigured()) {
    els.aiStatusBadge.textContent = 'AI غير مربوط';
    els.aiStatusBadge.className = 'badge warn';
    els.aiStatusText.textContent = 'القارئ المحلي الاحتياطي فقط. بعد نشر الخادم الآمن ضعي رابطه في runtime-config.js.';
    return;
  }
  els.aiStatusBadge.textContent = 'فحص الاتصال…';
  els.aiStatusBadge.className = 'badge info';
  const result = await testAiConnection();
  els.aiStatusBadge.textContent = result.ok ? 'AI جاهز ✓' : 'AI غير متاح';
  els.aiStatusBadge.className = `badge ${result.ok ? 'secure' : 'warn'}`;
  els.aiStatusText.textContent = result.message;
}
renderEmptyPreview();
renderFileSummary();
setStatus('لم يتم اختيار ملف بعد.');
// فحص الاتصال غير حاجب للواجهة؛ تبقى جميع الأزرار عاملة حتى لو تعذر الخادم مؤقتًا.
void refreshAiStatus();
