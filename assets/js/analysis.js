import { APP_CONFIG, SUBJECT_ORDER } from './config.js';
import { parseNumber, round1, round2 } from './parser.js';

export function hasNumber(value) {
  return parseNumber(value) !== null;
}

export function numeric(value) {
  return parseNumber(value);
}

export function clampPercent(value) {
  const number = numeric(value);
  return number === null ? null : Math.max(0, Math.min(100, number));
}

function issue(level, code, message, path = '') {
  return { level, code, message, path };
}

export function validateData(data) {
  const issues = [];
  if (!String(data?.school || '').trim()) issues.push(issue('warning', 'school-missing', 'اسم المدرسة غير مقروء؛ أدخليه يدويًا قبل اعتماد التقرير.', 'school'));
  if (!String(data?.grade || '').trim()) issues.push(issue('error', 'grade-missing', 'الصف غير محدد.', 'grade'));

  const total = numeric(data?.total);
  const tested = numeric(data?.tested);
  if (total === null) issues.push(issue('warning', 'total-missing', 'عدد الطلبة الإجمالي غير مكتمل.', 'total'));
  if (tested === null) issues.push(issue('warning', 'tested-missing', 'عدد المختبرين غير مكتمل.', 'tested'));
  if (total !== null && tested !== null) {
    if (total <= 0 || tested < 0) issues.push(issue('error', 'student-count-invalid', 'أعداد الطلبة يجب أن تكون قيمًا موجبة ومتسقة.', 'total'));
    if (tested > total) issues.push(issue('error', 'tested-over-total', 'عدد المختبرين أكبر من العدد الإجمالي؛ راجعي القيمتين.', 'tested'));
    const participation = total > 0 ? tested / total * 100 : null;
    if (participation !== null && participation < 65) issues.push(issue('warning', 'low-participation', `نسبة المشاركة منخفضة (${round1(participation)}٪)، وقد تحد من تمثيل النتيجة لجميع الطلبة.`, 'tested'));
  }

  const overall = numeric(data?.overallMastery);
  if (overall !== null && (overall < 0 || overall > 100)) issues.push(issue('error', 'overall-range', 'المؤشر العام يجب أن يكون بين ٠ و١٠٠.', 'overallMastery'));

  const subjects = Array.isArray(data?.subjects) ? data.subjects : [];
  if (!subjects.length) issues.push(issue('error', 'subjects-missing', 'لم تُحدّد أي مادة للتحليل.', 'subjects'));

  subjects.forEach((subject, index) => {
    const prefix = `subjects.${index}`;
    const name = String(subject?.name || `المادة ${index + 1}`);
    const levels = ['veryLow', 'low', 'medium', 'high'].map(key => numeric(subject?.[key]));
    if (levels.some(value => value === null)) {
      issues.push(issue('warning', 'levels-incomplete', `مستويات الأداء في ${name} غير مكتملة.`, `${prefix}.levels`));
    } else {
      if (levels.some(value => value < 0 || value > 100)) issues.push(issue('error', 'levels-range', `إحدى نسب مستويات الأداء في ${name} خارج النطاق ٠–١٠٠.`, `${prefix}.levels`));
      const sum = levels.reduce((acc, value) => acc + value, 0);
      if (Math.abs(sum - 100) > APP_CONFIG.levelSumTolerance) issues.push(issue('warning', 'levels-sum', `مجموع مستويات الأداء في ${name} يساوي ${round2(sum)}٪ بدلًا من ١٠٠٪؛ راجعي القيم.`, `${prefix}.levels`));
    }

    for (const [key, label] of [['schoolAvg', 'متوسط الدرجة'], ['mastery', 'الإتقان']]) {
      const value = numeric(subject?.[key]);
      if (value === null) issues.push(issue('warning', `${key}-missing`, `${label} في ${name} غير مقروء.`, `${prefix}.${key}`));
      else if (value < 0 || value > 100) issues.push(issue('error', `${key}-range`, `${label} في ${name} خارج النطاق ٠–١٠٠.`, `${prefix}.${key}`));
    }

    const domains = Array.isArray(subject?.domains) ? subject.domains : [];
    if (!domains.length) issues.push(issue('warning', 'domains-missing', `لا توجد مجالات مسجلة لمادة ${name}.`, `${prefix}.domains`));
    domains.forEach((domain, domainIndex) => {
      const value = numeric(domain?.value);
      if (!String(domain?.name || '').trim()) issues.push(issue('warning', 'domain-name-missing', `اسم المجال ${domainIndex + 1} في ${name} غير مكتمل.`, `${prefix}.domains.${domainIndex}.name`));
      if (value === null) issues.push(issue('warning', 'domain-value-missing', `قيمة مجال «${domain?.name || domainIndex + 1}» في ${name} غير مقروءة؛ لا يعتمد التطبيق رقمًا تقديريًا بدلًا منها.`, `${prefix}.domains.${domainIndex}.value`));
      else if (value < 0 || value > 100) issues.push(issue('error', 'domain-value-range', `قيمة مجال «${domain?.name || domainIndex + 1}» في ${name} خارج النطاق ٠–١٠٠.`, `${prefix}.domains.${domainIndex}.value`));
      for (const key of ['admin', 'kingdom', 'benchmark']) {
        const reference = numeric(domain?.[key]);
        if (reference !== null && (reference < 0 || reference > 100)) issues.push(issue('error', 'domain-reference-range', `القيمة المرجعية لمجال «${domain?.name || domainIndex + 1}» خارج النطاق ٠–١٠٠.`, `${prefix}.domains.${domainIndex}.${key}`));
      }
    });
  });

  return issues;
}

function referenceFor(domain) {
  const explicit = numeric(domain?.benchmark);
  if (explicit !== null) return { value: explicit, label: 'المستهدف المدخل' };
  const kingdom = numeric(domain?.kingdom);
  if (kingdom !== null) return { value: kingdom, label: 'مرجع المملكة' };
  const admin = numeric(domain?.admin);
  if (admin !== null) return { value: admin, label: 'مرجع إدارة التعليم' };
  return { value: null, label: 'لا يوجد مرجع رقمي' };
}

function priorityFor(subject, domain, subjectIndex, domainIndex) {
  const value = numeric(domain?.value);
  const reference = referenceFor(domain);
  const gap = value !== null && reference.value !== null ? round1(value - reference.value) : null;
  let severity = 'diagnostic';
  let score = 0;
  let reason = 'القيمة غير مكتملة؛ لا يصنف المجال حتى التحقق اليدوي.';

  if (value !== null) {
    if (gap !== null) {
      if (gap <= APP_CONFIG.priorityThresholds.remedialGap) severity = 'remedial';
      else if (gap < APP_CONFIG.priorityThresholds.improvementGap) severity = 'improvement';
      else severity = 'sustain';
      score = round1(Math.min(100, Math.max(0, -gap) * 2 + Math.max(0, 65 - value) * 0.35));
      if (severity === 'remedial') reason = `الأداء ${value}٪، بفجوة ${Math.abs(gap)} نقطة عن ${reference.label}؛ أولوية علاجية.`;
      else if (severity === 'improvement') reason = `الأداء ${value}٪، بفجوة ${Math.abs(gap)} نقطة عن ${reference.label}؛ مجال تحسين.`;
      else reason = gap >= 0
        ? `الأداء ${value}٪، ويتجاوز ${reference.label} بمقدار ${gap} نقطة؛ مجال قوة يُحافظ عليه.`
        : `الأداء ${value}٪، قريب من ${reference.label} بفارق ${Math.abs(gap)} نقطة؛ محافظة ومتابعة.`;
    } else {
      if (value < APP_CONFIG.priorityThresholds.remedialAbsolute) severity = 'remedial';
      else if (value < APP_CONFIG.priorityThresholds.improvementAbsolute) severity = 'improvement';
      else severity = 'sustain';
      score = round1(Math.max(0, 70 - value));
      reason = severity === 'remedial'
        ? `الأداء ${value}٪ دون ٥٠٪ ولا تتوفر قيمة مرجعية مكتملة؛ أولوية علاجية.`
        : severity === 'improvement'
          ? `الأداء ${value}٪ ويحتاج رفعًا تدريجيًا؛ لا تتوفر قيمة مرجعية مكتملة.`
          : `الأداء ${value}٪؛ يُحافظ على الممارسة الناجحة مع متابعة دورية.`;
    }
  }

  return {
    id: `${subjectIndex}-${domainIndex}`,
    subject: subject?.name || 'مادة غير محددة',
    domain: domain?.name || `مجال ${domainIndex + 1}`,
    value,
    reference: reference.value,
    referenceLabel: reference.label,
    gap,
    severity,
    score,
    reason,
    sourcePath: `subjects.${subjectIndex}.domains.${domainIndex}`
  };
}

function severityOrder(severity) {
  return ({ remedial: 0, improvement: 1, diagnostic: 2, sustain: 3 })[severity] ?? 4;
}

function subjectInterpretation(subject) {
  const name = subject?.name || 'المادة';
  const average = numeric(subject?.schoolAvg);
  const mastery = numeric(subject?.mastery);
  const change = numeric(subject?.averageChange);
  const masteryChange = numeric(subject?.masteryChange);
  const levels = {
    veryLow: numeric(subject?.veryLow), low: numeric(subject?.low),
    medium: numeric(subject?.medium), high: numeric(subject?.high)
  };
  const lowCombined = levels.veryLow !== null && levels.low !== null ? round1(levels.veryLow + levels.low) : null;
  const highCombined = levels.medium !== null && levels.high !== null ? round1(levels.medium + levels.high) : null;
  const domains = (subject?.domains || []).filter(domain => numeric(domain?.value) !== null);
  const sorted = [...domains].sort((a, b) => numeric(a.value) - numeric(b.value));
  const weakest = sorted[0] || null;
  const strongest = sorted[sorted.length - 1] || null;

  const observations = [];
  if (average !== null) observations.push(`متوسط الدرجة ${average} درجة${change !== null ? ` (${change > 0 ? 'ارتفاع' : change < 0 ? 'انخفاض' : 'ثبات'} ${Math.abs(change)} نقطة عن القياس السابق)` : ''}.`);
  if (mastery !== null) observations.push(`نسبة الإتقان ${mastery}٪${masteryChange !== null ? ` (${masteryChange > 0 ? 'ارتفاع' : masteryChange < 0 ? 'انخفاض' : 'ثبات'} ${Math.abs(masteryChange)} نقطة)` : ''}.`);
  if (lowCombined !== null) observations.push(`تتركز ${lowCombined}٪ من النتائج في المستويين المنخفض والمنخفض جدًا.`);
  if (highCombined !== null) observations.push(`تقع ${highCombined}٪ من النتائج في المستويين المتوسط والمرتفع.`);
  if (weakest) observations.push(`أدنى مجال مقروء هو «${weakest.name}» بنسبة ${numeric(weakest.value)}٪.`);
  if (strongest && strongest !== weakest) observations.push(`أعلى مجال مقروء هو «${strongest.name}» بنسبة ${numeric(strongest.value)}٪.`);

  return { name, average, mastery, lowCombined, highCombined, weakest, strongest, observations };
}

function buildActionUnit(priority, index) {
  const baseline = priority.value;
  const desiredGain = priority.severity === 'remedial' ? 12 : priority.severity === 'improvement' ? 8 : 0;
  const target = baseline === null ? null : round1(Math.min(100, baseline + desiredGain));
  return {
    ...priority,
    order: index + 1,
    target,
    studentActions: [
      'اختبار تشخيصي قصير يحدد نوع الخطأ لا الدرجة فقط.',
      'تدريب متدرج يبدأ بالنمذجة ثم الممارسة الموجهة فالمستقلة.',
      'تغذية راجعة فورية وسجل فردي لمتابعة التقدم.'
    ],
    teacherActions: [
      'تحليل البنود والاستجابات وتصنيف الأخطاء الشائعة.',
      'تدريس مركز للمفهوم باستخدام أمثلة وتمثيلات متعددة.',
      'تقويم تكويني مرتين أسبوعيًا وتعديل التدخل وفق الدليل.'
    ],
    familyActions: [
      'نشاط منزلي قصير لا يتجاوز ١٥ دقيقة مع تعليمات واضحة.',
      'متابعة الانتظام والتشجيع دون تقديم الإجابة مباشرة.',
      'إعادة ورقة المتابعة أسبوعيًا للمعلم/ة.'
    ],
    leadershipActions: [
      'توفير وقت للتخطيط المشترك ومراجعة بيانات القياس.',
      'متابعة التنفيذ بالشواهد لا بعدد الأنشطة فقط.',
      'دعم الموارد والزيارات الصفية المرتبطة بالأولوية.'
    ],
    evidence: ['نتيجة التشخيص القبلي', 'عينات أعمال الطلبة', 'سجل التغذية الراجعة', 'نتيجة القياس البعدي'],
    successCriterion: target === null ? 'إكمال القياس القبلي والبعدي وتحديد تحسن موثق.' : `الوصول إلى ${target}٪ على الأقل أو تحقيق تحسن لا يقل عن ${desiredGain} نقاط.`
  };
}

export function analyzeData(data) {
  const validation = validateData(data);
  const subjects = [...(data?.subjects || [])].sort((a, b) => SUBJECT_ORDER.indexOf(a.name) - SUBJECT_ORDER.indexOf(b.name));
  const interpretations = subjects.map(subjectInterpretation);
  const priorities = [];
  subjects.forEach((subject, subjectIndex) => {
    (subject?.domains || []).forEach((domain, domainIndex) => priorities.push(priorityFor(subject, domain, subjectIndex, domainIndex)));
  });
  priorities.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity) || b.score - a.score || (a.value ?? 999) - (b.value ?? 999));

  const actionPriorities = priorities.filter(priority => ['remedial', 'improvement'].includes(priority.severity));
  const selected = actionPriorities.slice(0, 6);
  const actionUnits = selected.map(buildActionUnit);
  const strengths = priorities.filter(priority => priority.severity === 'sustain' && priority.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const masteryValues = subjects.map(subject => numeric(subject?.mastery)).filter(value => value !== null);
  const averageValues = subjects.map(subject => numeric(subject?.schoolAvg)).filter(value => value !== null);
  const total = numeric(data?.total);
  const tested = numeric(data?.tested);
  const participation = total !== null && tested !== null && total > 0 ? round1(tested / total * 100) : null;
  const averageMastery = masteryValues.length ? round1(masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length) : null;
  const averageScore = averageValues.length ? round2(averageValues.reduce((sum, value) => sum + value, 0) / averageValues.length) : null;
  const weakest = priorities.find(priority => priority.value !== null) || null;
  const strongest = strengths[0] || [...priorities].filter(priority => priority.value !== null).sort((a, b) => b.value - a.value)[0] || null;

  return {
    validation,
    hasBlockingErrors: validation.some(item => item.level === 'error'),
    subjects,
    interpretations,
    priorities,
    actionUnits,
    strengths,
    executive: {
      participation,
      averageMastery,
      averageScore,
      weakest,
      strongest,
      overallMastery: numeric(data?.overallMastery),
      overallChange: numeric(data?.change)
    },
    impact: {
      baseline: 'قياس قبلي قصير موحد لكل أولوية مع تحليل بنود.',
      formative: 'مؤشر أسبوعي: نسبة الإتقان، ونوع الخطأ، ونسبة إكمال التدريبات.',
      post: 'قياس بعدي مكافئ في البناء ومستقل في الأسئلة.',
      calculation: 'مقدار التحسن = نتيجة القياس البعدي − نتيجة القياس القبلي.',
      decision: 'يستمر التدخل أو يعدل بناءً على التحسن الفعلي، لا على تنفيذ النشاط وحده.'
    },
    timeline: [
      { week: 'الأسبوع الأول', title: 'التشخيص وخط الأساس', tasks: 'اختبار تشخيصي، تحليل بنود واستجابات، تحديد المجموعات، واعتماد خط الأساس.' },
      { week: 'الأسبوع الثاني', title: 'التدخل المركز', tasks: 'تعليم مركز للمهارة، نمذجة الحل، ممارسة موجهة، وتغذية راجعة مباشرة.' },
      { week: 'الأسبوع الثالث', title: 'التدريب والتثبيت', tasks: 'أسئلة متدرجة ومحاكية، متابعة فردية، تعلم تعاوني، وإثراء للمتقنين.' },
      { week: 'الأسبوع الرابع', title: 'القياس واتخاذ القرار', tasks: 'قياس بعدي، حساب التحسن، مقارنة المرجع، وتحديد الاستمرار أو تعديل التدخل.' }
    ],
    generatedAt: new Date().toISOString()
  };
}
