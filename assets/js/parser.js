import { GRADE_PROFILES } from './config.js';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const LATIN_DIGITS = '0123456789';

const KNOWN_LABELS = [
  'بيانات المدرسة', 'الرقم الوزاري', 'اسم المدرسة', 'جنس المدرسة',
  'ادارة التعليم', 'المنطقة', 'المرحلة الدراسية', 'بيانات الصف الدراسي',
  'الصف', 'العام الدراسي', 'عدد الطلبة الاجمالي', 'المختبرين',
  'مقدار التغير', 'بطاقة نافس'
];

export function toLatinDigits(value = '') {
  return String(value)
    .replace(/[٠-٩]/g, d => LATIN_DIGITS[ARABIC_DIGITS.indexOf(d)])
    .replace(/[۰-۹]/g, d => LATIN_DIGITS[PERSIAN_DIGITS.indexOf(d)]);
}

export function toArabicDigits(value = '') {
  return String(value).replace(/\d/g, d => ARABIC_DIGITS[Number(d)]);
}

export function cleanDisplayText(value = '') {
  return String(value)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeArabic(value = '') {
  return toLatinDigits(cleanDisplayText(value))
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[“”"'`]/g, '')
    .replace(/[^\p{L}\p{N}%+\-.,: ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function compactArabic(value = '') {
  return normalizeArabic(value).replace(/\s+/g, '');
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = toLatinDigits(cleanDisplayText(value))
    .replace(/٪/g, '%')
    .replace(/٬/g, '')
    .replace(/٫/g, '.')
    .replace(/,/g, '')
    .replace(/\s/g, '');
  const match = normalized.match(/[+\-]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

export function round1(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

export function round2(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function uniqueItems(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${cleanDisplayText(item.str)}|${Math.round(item.x * 2)}|${Math.round(item.y * 2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSegments(page) {
  const items = uniqueItems((page?.items || [])
    .map(item => ({
      str: cleanDisplayText(item.str),
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      width: Math.max(0, Number(item.width) || 0),
      height: Math.max(1, Number(item.height) || 10)
    }))
    .filter(item => item.str));

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const item of sorted) {
    const tolerance = Math.max(3.5, Math.min(8, item.height * 0.55));
    let row = rows.find(candidate => Math.abs(candidate.y - item.y) <= tolerance);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
    row.y = row.items.reduce((sum, entry) => sum + entry.y, 0) / row.items.length;
  }

  const segments = [];
  for (const row of rows.sort((a, b) => a.y - b.y)) {
    const rowItems = [...row.items].sort((a, b) => a.x - b.x);
    let current = [];
    for (const item of rowItems) {
      const previous = current[current.length - 1];
      const gap = previous ? item.x - (previous.x + previous.width) : 0;
      if (previous && gap > 44) {
        segments.push(makeSegment(current));
        current = [];
      }
      current.push(item);
    }
    if (current.length) segments.push(makeSegment(current));
  }
  return segments.sort((a, b) => a.y - b.y || a.x - b.x);
}

function makeSegment(items) {
  const x = Math.min(...items.map(item => item.x));
  const y = items.reduce((sum, item) => sum + item.y, 0) / items.length;
  const right = Math.max(...items.map(item => item.x + item.width));
  const bottom = Math.max(...items.map(item => item.y + item.height));
  const rtlItems = [...items].sort((a, b) => b.x - a.x);
  return {
    items,
    x,
    y,
    width: right - x,
    height: bottom - y,
    centerX: (x + right) / 2,
    text: cleanDisplayText(rtlItems.map(item => item.str).join(' '))
  };
}

function aliasMatch(text, aliases) {
  const normalized = compactArabic(text);
  return aliases.some(alias => normalized.includes(compactArabic(alias)));
}

function isKnownLabel(text) {
  return KNOWN_LABELS.some(label => aliasMatch(text, [label]));
}

function valueBelowLabel(page, aliases, options = {}) {
  const segments = page.segments || buildSegments(page);
  const maxY = options.maxLabelY ?? page.height * 0.48;
  const labels = segments.filter(segment => segment.y < maxY && aliasMatch(segment.text, aliases));
  if (!labels.length) return '';
  const label = labels.sort((a, b) => a.y - b.y || a.width - b.width)[0];

  // بطاقات نافس الرسمية تقسم بيانات التعريف إلى ثلاثة أعمدة متساوية تقريبًا.
  // نجمع كلمات صف القيمة داخل عمود الملصق فقط حتى لا تختلط مثلًا "بنات" باسم المدرسة.
  const columnWidth = page.width / 3;
  const column = Math.min(2, Math.max(0, Math.floor(label.centerX / columnWidth)));
  const minX = column * columnWidth;
  const maxX = (column + 1) * columnWidth;
  const minDy = options.minDy ?? 10;
  const maxDy = options.maxDy ?? 47;
  const candidateItems = (page.items || []).filter(item => {
    const centerX = item.x + (item.width || 0) / 2;
    const dy = item.y - label.y;
    return dy >= minDy && dy <= maxDy && centerX >= minX && centerX < maxX;
  });
  if (!candidateItems.length) return '';

  const yGroups = [];
  for (const item of candidateItems.sort((a, b) => a.y - b.y || b.x - a.x)) {
    let group = yGroups.find(entry => Math.abs(entry.y - item.y) <= 5);
    if (!group) {
      group = { y: item.y, items: [] };
      yGroups.push(group);
    }
    group.items.push(item);
  }
  const group = yGroups.sort((a, b) => Math.abs(a.y - (label.y + 21)) - Math.abs(b.y - (label.y + 21)))[0];
  if (!group) return '';
  const text = cleanDisplayText([...group.items].sort((a, b) => b.x - a.x).map(item => item.str).join(' '));
  return isKnownLabel(text) ? '' : text;
}

function signedNumberNearLabel(page, aliases) {
  const segments = page.segments || buildSegments(page);
  const label = segments.find(segment => aliasMatch(segment.text, aliases));
  if (!label) return null;
  const candidates = (page.items || []).filter(item => {
    const value = parseNumber(item.str);
    return value !== null && Math.abs(item.y - label.y) < 18 && item.x < label.x + label.width + 120;
  });
  const signed = candidates.find(item => /[+\-]/.test(toLatinDigits(item.str)));
  return parseNumber(signed?.str ?? candidates[0]?.str);
}

function extractOverallTrend(page) {
  const years = (page.items || [])
    .map(item => ({ ...item, value: parseNumber(item.str) }))
    .filter(item => item.value >= 2020 && item.value <= 2035 && item.y > page.height * 0.68);
  if (!years.length) return { current: null, history: [] };
  const history = years.map(yearItem => {
    const candidates = (page.items || [])
      .map(item => ({ ...item, value: parseNumber(item.str) }))
      .filter(item => item.value !== null && item.value >= 0 && item.value <= 100
        && item.y < yearItem.y - 15 && item.y > yearItem.y - page.height * 0.18
        && Math.abs((item.x + (item.width || 0) / 2) - (yearItem.x + (yearItem.width || 0) / 2)) < 45);
    candidates.sort((a, b) => Math.abs(a.x - yearItem.x) - Math.abs(b.x - yearItem.x));
    return { year: yearItem.value, value: candidates[0]?.value ?? null };
  }).filter(entry => entry.value !== null);
  history.sort((a, b) => b.year - a.year);
  return { current: history[0]?.value ?? null, history };
}

function detectGrade(value) {
  const compact = compactArabic(value);
  if (/ثالث(?:ال)?ابتدا/.test(compact) || compact.includes('الصفالثالثالابتدايي')) return 'g3';
  if (/سادس(?:ال)?ابتدا/.test(compact) || compact.includes('الصفالسادسالابتدايي')) return 'g6';
  if (/ثالث(?:ال)?متوسط/.test(compact) || compact.includes('الصفالثالثالمتوسط')) return 'g9';
  return '';
}

function subjectFromText(value = '') {
  const compact = compactArabic(value);
  if (compact.includes('الرياضيات') || compact.includes('الرياضيـات')) return 'الرياضيات';
  if (compact.includes('القراءه') || compact.includes('القراءة')) return 'القراءة';
  if (compact.includes('العلوم')) return 'العلوم';
  return '';
}

function detectSubject(page) {
  const items = page.items || [];
  const topText = items
    .filter(item => item.y < page.height * 0.19)
    .map(item => item.str)
    .join(' ');
  const topMatch = subjectFromText(topText);
  if (topMatch) return topMatch;

  const upperText = items
    .filter(item => item.y < page.height * 0.42)
    .map(item => item.str)
    .join(' ');
  const upperCompact = compactArabic(upperText);
  if (upperCompact.includes('توزيعطلبهالمدرسهعليمستوياتالاداء') || upperCompact.includes('متوسطدرجهالطلبه')) {
    return subjectFromText(upperText);
  }

  const pageText = page.text || '';
  const pageCompact = compactArabic(pageText);
  if (pageCompact.includes('توزيعطلبهالمدرسهعليمستوياتالاداء')) return subjectFromText(pageText);
  return '';
}

function parseLevels(page) {
  const candidates = (page.items || [])
    .map(item => ({ ...item, value: parseNumber(item.str) }))
    .filter(item => item.value !== null && item.value >= 0 && item.value <= 100
      && item.y >= page.height * 0.16 && item.y <= page.height * 0.245);
  const yBuckets = [];
  for (const item of candidates.sort((a, b) => a.y - b.y)) {
    let bucket = yBuckets.find(entry => Math.abs(entry.y - item.y) < 10);
    if (!bucket) {
      bucket = { y: item.y, items: [] };
      yBuckets.push(bucket);
    }
    bucket.items.push(item);
  }
  const bucket = yBuckets.sort((a, b) => b.items.length - a.items.length)[0];
  if (!bucket || bucket.items.length < 4) return { veryLow: '', low: '', medium: '', high: '', confidence: 'none' };
  const values = bucket.items.sort((a, b) => a.x - b.x).slice(0, 4).map(item => round1(item.value));
  const sum = values.reduce((total, value) => total + value, 0);
  const confidence = Math.abs(sum - 100) <= 1.6 ? 'high' : Math.abs(sum - 100) <= 4 ? 'medium' : 'low';
  return { veryLow: values[0], low: values[1], medium: values[2], high: values[3], confidence };
}

function parseSubjectChanges(page) {
  const candidates = (page.items || [])
    .filter(item => item.y >= page.height * 0.315 && item.y <= page.height * 0.39)
    .filter(item => /[+\-]/.test(toLatinDigits(item.str)) && parseNumber(item.str) !== null)
    .sort((a, b) => a.x - b.x);
  return {
    average: parseNumber(candidates[0]?.str),
    mastery: parseNumber(candidates[candidates.length - 1]?.str)
  };
}

function chartYearClusters(page, area) {
  const years = (page.items || [])
    .map(item => ({ ...item, value: parseNumber(item.str) }))
    .filter(item => item.value >= 2020 && item.value <= 2035
      && item.x >= area.xMin && item.x <= area.xMax
      && item.y >= page.height * 0.60 && item.y <= page.height * 0.70);
  const clusters = [];
  for (const year of years) {
    const center = year.x + (year.width || 0) / 2;
    const values = (page.items || [])
      .map(item => ({ ...item, value: parseNumber(item.str) }))
      .filter(item => item.value !== null && item.value >= 0 && item.value <= 100
        && item.y >= page.height * 0.38 && item.y <= page.height * 0.61
        && item.x >= area.xMin && item.x <= area.xMax
        && Math.abs((item.x + (item.width || 0) / 2) - center) <= (area.radius || 34)
        && !(item.value >= 2020 && item.value <= 2035));
    const unique = [];
    for (const value of values) {
      if (!unique.some(item => Math.abs(item.value - value.value) < 0.001 && Math.abs(item.y - value.y) < 3)) unique.push(value);
    }
    clusters.push({ year: year.value, x: center, values: unique.map(item => item.value) });
  }
  clusters.sort((a, b) => b.year - a.year);
  return clusters;
}

function chooseCurrentByChange(clusters, change) {
  if (!clusters.length) return { value: null, confidence: 'none' };
  const current = clusters[0];
  const previous = clusters[1];
  if (change !== null && previous) {
    let best = null;
    for (const currentValue of current.values) {
      for (const previousValue of previous.values) {
        const error = Math.abs((currentValue - previousValue) - change);
        if (!best || error < best.error) best = { value: currentValue, previous: previousValue, error };
      }
    }
    if (best && best.error <= 0.16) return { value: round2(best.value), confidence: 'high', previous: round2(best.previous) };
  }
  if (current.values.length === 1) return { value: round2(current.values[0]), confidence: 'medium' };
  return { value: null, confidence: 'none' };
}

const DOMAIN_CANONICAL = [
  { keys: ['دلالاتالالفاظ', 'دالالتالالفاظ', 'دالالتااللفاظ', 'لالاتالالفاظ'], name: 'دلالات الألفاظ' },
  { keys: ['استيعابالمقروء', 'استيعاباملقروء'], name: 'استيعاب المقروء' },
  { keys: ['الجبر والدوال الحقيقيه والتحليل الرياضي', 'الجرب والدوال الحقيقيه والتحليل الرياضي', 'الجرب والدوال الحقيقيه والتحليل الريايض', 'الجبر والدوال الحقيقيه والتحليل الريايض'], name: 'الجبر والدوال الحقيقية والتحليل الرياضي' },
  { keys: ['الجبر', 'الجرب'], name: 'الجبر' },
  { keys: ['الهندسه والقياس'], name: 'الهندسة والقياس' },
  { keys: ['الاعداد والعمليات عليها', 'عداد والعمليات عليها'], name: 'الأعداد والعمليات عليها' },
  { keys: ['البيانات والاحتمالات', 'البيانات واالحتماالت'], name: 'البيانات والاحتمالات' },
  { keys: ['علوم الحياه'], name: 'علوم الحياة' },
  { keys: ['العلوم الفيزيائيه والكيميائيه', 'العلوم الفزييائيه والكيميائيه', 'العلوم الفزي يائيه والكيميائيه'], name: 'العلوم الفيزيائية والكيميائية' },
  { keys: ['علم الارض والفلك', 'علم االرض والفلك'], name: 'علم الأرض والفلك' }
];

export function canonicalDomainName(value) {
  const compact = compactArabic(value);
  if ((compact.includes('الجبر') || compact.includes('الجرب')) && (compact.includes('الدوال') || compact.includes('التحليل'))) {
    return 'الجبر والدوال الحقيقية والتحليل الرياضي';
  }
  for (const entry of DOMAIN_CANONICAL) {
    if (entry.keys.some(key => compact.includes(compactArabic(key)))) return entry.name;
  }
  return cleanDisplayText(value)
    .replace(/املقروء/g, 'المقروء')
    .replace(/األلفاظ/g, 'الألفاظ')
    .replace(/االحتماالت/g, 'الاحتمالات')
    .replace(/الفزي\s*يائية/g, 'الفيزيائية');
}

export function defaultDomainsFor(grade, subject) {
  const templates = {
    g3: {
      'القراءة': ['دلالات الألفاظ', 'استيعاب المقروء'],
      'الرياضيات': ['الجبر والدوال الحقيقية والتحليل الرياضي', 'الهندسة والقياس', 'الأعداد والعمليات عليها']
    },
    g6: {
      'القراءة': ['استيعاب المقروء', 'دلالات الألفاظ'],
      'الرياضيات': ['الجبر', 'الأعداد والعمليات عليها', 'البيانات والاحتمالات', 'الهندسة والقياس'],
      'العلوم': ['علوم الحياة', 'العلوم الفيزيائية والكيميائية', 'علم الأرض والفلك']
    },
    g9: {
      'القراءة': ['استيعاب المقروء', 'دلالات الألفاظ'],
      'الرياضيات': ['الجبر', 'الأعداد والعمليات عليها', 'البيانات والاحتمالات', 'الهندسة والقياس'],
      'العلوم': ['علوم الحياة', 'العلوم الفيزيائية والكيميائية', 'علم الأرض والفلك']
    }
  };
  return templates[grade]?.[subject] || [];
}

function parseDomains(page, grade, subject) {
  const fallback = defaultDomainsFor(grade, subject);
  const expected = fallback.length;
  if (!expected) return [];

  const candidates = (page.items || [])
    .map(item => ({ ...item, value: parseNumber(item.str) }))
    .filter(item => item.value !== null && item.value >= 0 && item.value <= 100
      && item.y >= page.height * 0.08 && item.y <= page.height * 0.33)
    .sort((a, b) => a.x - b.x);

  const segments = page.segments || buildSegments(page);
  const labelSegments = segments
    .filter(segment => segment.y >= page.height * 0.32 && segment.y <= page.height * 0.40)
    .filter(segment => !aliasMatch(segment.text, ['المدرسة', 'املدرسة', 'ادارة التعليم', 'المملكة', 'بطاقة نافس']))
    .sort((a, b) => a.centerX - b.centerX);

  // نعتمد مراكز أسماء المجالات عندما تكون واضحة، وإلا نقسم الرسم بعدد المجالات المتوقع.
  const centers = labelSegments.length === expected
    ? labelSegments.map(segment => segment.centerX)
    : Array.from({ length: expected }, (_, index) => page.width * (index + 0.5) / expected);
  const groups = centers.map(() => []);
  for (const item of candidates) {
    const center = item.x + (item.width || 0) / 2;
    let bestIndex = 0;
    let bestDistance = Infinity;
    centers.forEach((target, index) => {
      const distance = Math.abs(center - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestDistance <= page.width / expected * 0.48) groups[bestIndex].push(item);
  }

  return groups.map((group, index) => {
    const label = labelSegments.length === expected ? labelSegments[index] : null;
    const values = [...group].sort((a, b) => a.x - b.x);
    const uniqueValues = [];
    for (const item of values) {
      if (!uniqueValues.some(existing => Math.abs(existing.value - item.value) < 0.001 && Math.abs(existing.x - item.x) < 3)) uniqueValues.push(item);
    }
    return {
      name: canonicalDomainName(label?.text || fallback[index] || `مجال ${index + 1}`),
      value: uniqueValues[0] ? round1(uniqueValues[0].value) : '',
      admin: uniqueValues[1] ? round1(uniqueValues[1].value) : '',
      kingdom: uniqueValues[2] ? round1(uniqueValues[2].value) : '',
      benchmark: ''
    };
  });
}

function parseSubjectSummary(page, domainPage, grade) {
  const name = detectSubject(page);
  const levels = parseLevels(page);
  const changes = parseSubjectChanges(page);
  const averageClusters = chartYearClusters(page, { xMin: 0, xMax: page.width * 0.49, radius: 36 });
  const masteryClusters = chartYearClusters(page, { xMin: page.width * 0.50, xMax: page.width, radius: 36 });
  const averageChoice = chooseCurrentByChange(averageClusters, changes.average);
  const masteryChoice = chooseCurrentByChange(masteryClusters, changes.mastery);
  const domains = domainPage ? parseDomains(domainPage, grade, name) : defaultDomainsFor(grade, name).map(domain => ({ name: domain, value: '', admin: '', kingdom: '', benchmark: '' }));

  return {
    name,
    veryLow: levels.veryLow,
    low: levels.low,
    medium: levels.medium,
    high: levels.high,
    schoolAvg: averageChoice.value ?? '',
    adminAvg: '',
    kingdomAvg: '',
    averageChange: changes.average ?? '',
    mastery: masteryChoice.value ?? '',
    masteryChange: changes.mastery ?? '',
    target: '',
    target2030: '',
    domains,
    extractionConfidence: {
      levels: levels.confidence || 'none',
      average: averageChoice.confidence,
      mastery: masteryChoice.confidence,
      domains: domains.length && domains.every(domain => parseNumber(domain.value) !== null) ? 'high' : domains.length ? 'partial' : 'none'
    }
  };
}

function pageLooksLikeDomains(page) {
  const values = (page.items || []).filter(item => {
    const value = parseNumber(item.str);
    return value !== null && value >= 0 && value <= 100 && item.y >= page.height * 0.1 && item.y <= page.height * 0.35;
  });
  return !detectSubject(page) && values.length >= 6;
}

function fallbackMetadataFromText(text) {
  const normalized = normalizeArabic(text);
  const numberAfter = label => {
    const regex = new RegExp(`${label}[^0-9+\\-]{0,35}([+\\-]?\\d+(?:\\.\\d+)?)`);
    return parseNumber(normalized.match(regex)?.[1]);
  };
  return {
    total: numberAfter('عدد الطلبه الاجمالي'),
    tested: numberAfter('المختبرين'),
    year: numberAfter('العام الدراسي')
  };
}

function cleanMetadataValue(value = '') {
  return cleanDisplayText(value)
    .replace(/اإلدارة/g, 'الإدارة')
    .replace(/اال/g, 'الا')
    .replace(/امل/g, 'الم')
    .replace(/عسري/g, 'عسير')
    .replace(/ابتدايئ/g, 'ابتدائي')
    .replace(/الدرايس/g, 'الدراسي')
    .replace(/اإلجمايل/g, 'الإجمالي')
    .replace(/الفزي\s*يائية/g, 'الفيزيائية')
    .replace(/دالالت/g, 'دلالات')
    .replace(/الجرب/g, 'الجبر')
    .replace(/االحتماالت/g, 'الاحتمالات')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalGradeName(grade) {
  return GRADE_PROFILES[grade]?.name || '';
}

export function parseNafisDocument(inputPages, options = {}) {
  const pages = (inputPages || []).map((page, index) => ({
    pageNumber: page.pageNumber || index + 1,
    width: Number(page.width) || 595,
    height: Number(page.height) || 842,
    items: page.items || [],
    text: cleanDisplayText(page.text || (page.items || []).map(item => item.str).join(' '))
  }));
  pages.forEach(page => { page.segments = buildSegments(page); });
  const first = pages[0] || { width: 595, height: 842, items: [], segments: [], text: '' };

  const school = cleanMetadataValue(valueBelowLabel(first, ['اسم المدرسة', 'اسم املدرسة']));
  const gradeRaw = cleanMetadataValue(valueBelowLabel(first, ['الصف'], { maxLabelY: first.height * 0.42 }));
  const fallback = fallbackMetadataFromText(first.text);
  const overall = extractOverallTrend(first);
  const allText = pages.map(page => page.text || '').join(' ');
  const grade = detectGrade(gradeRaw) || detectGrade(first.text) || detectGrade(allText) || options.gradeHint || '';

  const data = {
    school,
    ministerialId: valueBelowLabel(first, ['الرقم الوزاري']),
    gender: cleanMetadataValue(valueBelowLabel(first, ['جنس المدرسة', 'جنس املدرسة'])) || 'غير محدد',
    region: cleanMetadataValue(valueBelowLabel(first, ['ادارة التعليم', 'إدارة التعليم'])),
    area: cleanMetadataValue(valueBelowLabel(first, ['المنطقة', 'املنطقة'])),
    stage: GRADE_PROFILES[grade]?.stage || cleanMetadataValue(valueBelowLabel(first, ['المرحلة الدراسية', 'املرحلة الدراسية'])) || '',
    grade,
    gradeName: canonicalGradeName(grade),
    year: parseNumber(valueBelowLabel(first, ['العام الدراسي', 'العام الدرايس'])) ?? fallback.year ?? '',
    total: parseNumber(valueBelowLabel(first, ['عدد الطلبة الاجمالي', 'عدد الطلبة اإلجمالي', 'عدد الطلبة اإلجمايل'])) ?? fallback.total ?? '',
    tested: parseNumber(valueBelowLabel(first, ['المختبرين', 'املختربين', 'املختبر ين'])) ?? fallback.tested ?? '',
    change: signedNumberNearLabel(first, ['مقدار التغير', 'مقدار التغري']) ?? '',
    overallMastery: overall.current ?? '',
    overallHistory: overall.history,
    schoolType: 'حكومي',
    subjects: [],
    source: options.source || 'pdf-text',
    pageCount: pages.length,
    parsedAt: new Date().toISOString()
  };

  const seenSubjects = new Set();
  for (let index = 0; index < pages.length; index += 1) {
    const subject = detectSubject(pages[index]);
    if (!subject || seenSubjects.has(subject)) continue;
    const domainPage = pages[index + 1] && pageLooksLikeDomains(pages[index + 1]) ? pages[index + 1] : null;
    const summary = parseSubjectSummary(pages[index], domainPage, grade);
    summary.extractionConfidence.levels = summary.extractionConfidence.levels || parseLevels(pages[index]).confidence || 'none';
    data.subjects.push(summary);
    seenSubjects.add(subject);
    if (domainPage) index += 1;
  }

  return data;
}

export function makeBlankSubject(name = 'الرياضيات') {
  return {
    name,
    veryLow: '', low: '', medium: '', high: '',
    schoolAvg: '', adminAvg: '', kingdomAvg: '', averageChange: '',
    mastery: '', masteryChange: '', target: '', target2030: '',
    domains: [], extractionConfidence: { levels: 'none', average: 'none', mastery: 'none', domains: 'none' }
  };
}

export function makeBlankData() {
  return {
    school: '', ministerialId: '', gender: 'غير محدد', region: '', area: '', stage: GRADE_PROFILES.g3.stage,
    grade: 'g3', gradeName: GRADE_PROFILES.g3.name, year: '', total: '', tested: '', change: '', overallMastery: '',
    overallHistory: [], schoolType: 'حكومي', subjects: [makeBlankSubject('الرياضيات')], source: 'manual', pageCount: 0,
    parsedAt: new Date().toISOString()
  };
}

export function makeDemoData(grade = 'g6') {
  const resolvedGrade = GRADE_PROFILES[grade] ? grade : 'g6';
  const confidence = { levels: 'demo', average: 'demo', mastery: 'demo', domains: 'demo' };
  const subjectTemplates = {
    'الرياضيات': {
      name: 'الرياضيات', veryLow: 18, low: 31, medium: 35, high: 16,
      schoolAvg: 62.4, adminAvg: 65.9, kingdomAvg: 67.6, averageChange: 2.1,
      mastery: 51, masteryChange: 4, target: 65, target2030: 80,
      domains: (resolvedGrade === 'g3'
        ? [
            { name: 'الأعداد والعمليات عليها', value: 64, admin: 62, kingdom: 65, benchmark: 68 },
            { name: 'الهندسة والقياس', value: 58, admin: 61, kingdom: 63, benchmark: 65 },
            { name: 'الجبر والدوال الحقيقية والتحليل الرياضي', value: 49, admin: 57, kingdom: 60, benchmark: 62 }
          ]
        : [
            { name: 'الجبر', value: 61, admin: 66, kingdom: 68, benchmark: 68 },
            { name: 'الأعداد والعمليات عليها', value: 56, admin: 61, kingdom: 64, benchmark: 65 },
            { name: 'البيانات والاحتمالات', value: 43, admin: 58, kingdom: 60, benchmark: 62 },
            { name: 'الهندسة والقياس', value: 52, admin: 57, kingdom: 59, benchmark: 62 }
          ]),
      extractionConfidence: confidence
    },
    'القراءة': {
      name: 'القراءة', veryLow: 14, low: 28, medium: 40, high: 18,
      schoolAvg: 66.2, adminAvg: 68.7, kingdomAvg: 69.1, averageChange: 1.2,
      mastery: 58, masteryChange: 3, target: 68, target2030: 82,
      domains: [
        { name: 'استيعاب المقروء', value: 61, admin: 67, kingdom: 69, benchmark: 70 },
        { name: 'دلالات الألفاظ', value: 55, admin: 64, kingdom: 66, benchmark: 68 }
      ], extractionConfidence: confidence
    },
    'العلوم': {
      name: 'العلوم', veryLow: 11, low: 24, medium: 44, high: 21,
      schoolAvg: 69.1, adminAvg: 67.8, kingdomAvg: 68.6, averageChange: 2.8,
      mastery: 65, masteryChange: 5, target: 72, target2030: 84,
      domains: [
        { name: 'علوم الحياة', value: 72, admin: 69, kingdom: 70, benchmark: 72 },
        { name: 'العلوم الفيزيائية والكيميائية', value: 63, admin: 66, kingdom: 68, benchmark: 70 },
        { name: 'علم الأرض والفلك', value: 58, admin: 65, kingdom: 67, benchmark: 69 }
      ], extractionConfidence: confidence
    }
  };
  const subjects = GRADE_PROFILES[resolvedGrade].subjects.map(name => structuredClone(subjectTemplates[name]));
  return {
    school: 'مدرسة نموذجية', ministerialId: '', gender: 'غير محدد', region: 'إدارة تعليم نموذجية', area: '',
    stage: GRADE_PROFILES[resolvedGrade].stage, grade: resolvedGrade, gradeName: GRADE_PROFILES[resolvedGrade].name, year: 1448,
    total: 60, tested: 58, change: 3.5, overallMastery: 42,
    overallHistory: [{ year: 2026, value: 42 }, { year: 2025, value: 38.5 }],
    schoolType: 'حكومي', source: 'demo', pageCount: 0, parsedAt: new Date().toISOString(), subjects
  };
}
