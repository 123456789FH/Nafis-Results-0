export const APP_CONFIG = Object.freeze({
  name: 'محلل نتائج نافس وخطة التحسين',
  version: '٧٫٠٫٢ AI الآمن',
  versionCode: '7.0.2-ai-secure',
  ownerName: 'أ/ فاطمة هزازي',
  communities: Object.freeze([
    'ملتقى معلمي ومعلمات الرياضيات',
    'ملتقى التعليم التفاعلي'
  ]),

  // حدود تمنع استهلاك الذاكرة بصورة مفرطة على الجوال والآيباد.
  maxFileBytes: 20 * 1024 * 1024,
  aiMaxFileBytes: 20 * 1024 * 1024,
  maxPdfPages: 12,
  maxImagePixels: 40_000_000,
  maxRenderPixels: 16_000_000,
  maxPreviewPixels: 1_100_000,
  previewMaxPages: 12,
  maxOcrPages: 8,
  minPdfTextItems: 12,
  minPdfTextCharacters: 45,

  // إصدارات مثبتة؛ لا تستخدم روابط latest المتغيرة.
  pdfJsUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/pdf.min.mjs',
  pdfWorkerUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/pdf.worker.min.mjs',
  tesseractUrl: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js',
  tesseractWorkerUrl: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
  tesseractCoreUrl: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/',
  tesseractLangPath: 'https://tessdata.projectnaptha.com/4.0.0_best_int',

  levelSumTolerance: 1.5,
  priorityThresholds: Object.freeze({
    high: 50,
    medium: 65,
    referenceHighGap: -5,
    referenceMediumGap: -2
  }),

  grades: Object.freeze({
    g3: Object.freeze({
      name: 'الثالث الابتدائي',
      stage: 'المرحلة الابتدائية',
      subjects: Object.freeze(['القراءة', 'الرياضيات'])
    }),
    g6: Object.freeze({
      name: 'السادس الابتدائي',
      stage: 'المرحلة الابتدائية',
      subjects: Object.freeze(['الرياضيات', 'العلوم', 'القراءة'])
    }),
    g9: Object.freeze({
      name: 'الثالث المتوسط',
      stage: 'المرحلة المتوسطة',
      subjects: Object.freeze(['الرياضيات', 'العلوم', 'القراءة'])
    })
  })
});

export const GRADE_META = APP_CONFIG.grades;
export const GRADE_PROFILES = APP_CONFIG.grades;
export const SUBJECT_ORDER = Object.freeze(['القراءة', 'الرياضيات', 'العلوم']);
