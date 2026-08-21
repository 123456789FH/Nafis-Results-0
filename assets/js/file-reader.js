import { APP_CONFIG } from './config.js';
import { cleanDisplayText } from './parser.js';

export class ReaderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ReaderError';
    this.code = code;
    this.details = details;
  }
}

let pdfJsPromise = null;
let tesseractPromise = null;

function abortIfNeeded(signal) {
  if (signal?.aborted) throw new DOMException('تم إلغاء العملية.', 'AbortError');
}

function emit(callback, value, message, detail = '') {
  if (typeof callback !== 'function') return;
  callback({
    value: Math.max(0, Math.min(100, Number(value) || 0)),
    message: String(message || ''),
    detail: String(detail || '')
  });
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} ميجابايت`;
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(APP_CONFIG.pdfJsUrl)
      .then(module => {
        module.GlobalWorkerOptions.workerSrc = APP_CONFIG.pdfWorkerUrl;
        return module;
      })
      .catch(error => {
        pdfJsPromise = null;
        throw new ReaderError(
          'pdf-library',
          'تعذر تحميل قارئ PDF الآمن. تحققي من الاتصال بالإنترنت ثم أعيدي المحاولة، أو استخدمي الإدخال اليدوي.',
          { cause: error }
        );
      });
  }
  return pdfJsPromise;
}

async function loadTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = import(APP_CONFIG.tesseractUrl).catch(error => {
      tesseractPromise = null;
      throw new ReaderError(
        'ocr-library',
        'تعذر تحميل محرك القراءة الضوئية. يمكنك متابعة الإدخال يدويًا أو المحاولة عند توفر اتصال مستقر.',
        { cause: error }
      );
    });
  }
  return tesseractPromise;
}

async function sniffFile(file) {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const isPdf = bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  const isPng = bytes.length >= 8
    && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isPdf) return 'pdf';
  if (isPng) return 'png';
  if (isJpeg) return 'jpeg';
  return '';
}

function pngDimensions(bytes) {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function jpegDimensions(bytes) {
  let offset = 2;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 1 >= bytes.length) break;
    const length = (bytes[offset] << 8) + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if (startOfFrame.has(marker) && length >= 7) {
      return {
        height: (bytes[offset + 3] << 8) + bytes[offset + 4],
        width: (bytes[offset + 5] << 8) + bytes[offset + 6]
      };
    }
    offset += length;
  }
  return null;
}

async function imageDimensions(file, type) {
  const header = new Uint8Array(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
  return type === 'png' ? pngDimensions(header) : jpegDimensions(header);
}

export async function validateUpload(file) {
  const isFile = typeof File !== 'undefined' && file instanceof File;
  if (!isFile) throw new ReaderError('file-missing', 'لم يتم اختيار ملف صالح.');
  if (!file.size) throw new ReaderError('file-empty', 'الملف فارغ.');
  if (file.size > APP_CONFIG.maxFileBytes) {
    throw new ReaderError(
      'file-too-large',
      `حجم الملف ${mb(file.size)} ويتجاوز الحد الآمن ${mb(APP_CONFIG.maxFileBytes)}.`
    );
  }

  const type = await sniffFile(file);
  if (!type) {
    throw new ReaderError(
      'file-type',
      'نوع الملف غير مدعوم أو لا يطابق محتواه. اختاري ملف PDF أو PNG أو JPG أصليًا.'
    );
  }

  let dimensions = null;
  if (type !== 'pdf') {
    dimensions = await imageDimensions(file, type);
    if (!dimensions?.width || !dimensions?.height) {
      throw new ReaderError('image-dimensions', 'تعذر التحقق من أبعاد الصورة.');
    }
    if (dimensions.width * dimensions.height > APP_CONFIG.maxImagePixels) {
      throw new ReaderError(
        'image-too-large',
        `أبعاد الصورة كبيرة جدًا (${dimensions.width}×${dimensions.height}) وقد تسبب توقف الجهاز.`
      );
    }
  }

  return {
    type,
    size: file.size,
    dimensions
  };
}

function pdfTextItem(pdfjs, viewport, item) {
  const tx = pdfjs.Util.transform(viewport.transform, item.transform);
  const fontHeight = Math.max(1, Math.hypot(tx[2], tx[3]) || Number(item.height) || 10);
  return {
    str: cleanDisplayText(item.str || ''),
    x: Number(tx[4]) || 0,
    y: Math.max(0, (Number(tx[5]) || 0) - fontHeight),
    width: Math.max(0, Number(item.width || 0) * viewport.scale),
    height: fontHeight,
    confidence: null
  };
}

function scaleWithinPixels(width, height, preferredScale, maxPixels) {
  const boundedPreferred = Math.max(0.35, Number(preferredScale) || 1);
  const maxScale = Math.sqrt(maxPixels / Math.max(1, width * height));
  return Math.max(0.35, Math.min(boundedPreferred, maxScale));
}

async function renderPdfPage(page, { preferredScale = 1.5, maxPixels = APP_CONFIG.maxRenderPixels, signal } = {}) {
  abortIfNeeded(signal);
  const base = page.getViewport({ scale: 1 });
  const scale = scaleWithinPixels(base.width, base.height, preferredScale, maxPixels);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
  if (!context) throw new ReaderError('canvas', 'تعذر تهيئة مساحة رسم الصفحة.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const task = page.render({ canvasContext: context, viewport, intent: 'display', annotationMode: 0 });
  await task.promise;
  abortIfNeeded(signal);
  return canvas;
}

function canvasDataUrl(canvas, quality = 0.82) {
  try { return canvas.toDataURL('image/jpeg', quality); }
  catch { return ''; }
}

function meaningfulText(value = '') {
  return cleanDisplayText(value).replace(/[^\p{L}\p{N}]/gu, '');
}

function pageNeedsOcr(page) {
  const textLength = meaningfulText(page?.text || '').length;
  const itemCount = Array.isArray(page?.items) ? page.items.length : 0;
  return itemCount < APP_CONFIG.minPdfTextItems || textLength < APP_CONFIG.minPdfTextCharacters;
}

function nestedChildren(node) {
  for (const key of ['words', 'lines', 'paragraphs', 'blocks']) {
    if (Array.isArray(node?.[key]) && node[key].length) return node[key];
  }
  return null;
}

function collectOcrWords(data) {
  const output = [];
  const visit = node => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const children = nestedChildren(node);
    if (children) { children.forEach(visit); return; }

    const text = cleanDisplayText(node.text || node.symbol || '');
    const box = node.bbox || node.boundingBox;
    if (!text || !box) return;
    const x0 = Number(box.x0 ?? box.left ?? 0);
    const y0 = Number(box.y0 ?? box.top ?? 0);
    const x1 = Number(box.x1 ?? box.right ?? x0);
    const y1 = Number(box.y1 ?? box.bottom ?? y0);
    const confidence = Number(node.confidence);
    if (Number.isFinite(confidence) && confidence < 8) return;
    output.push({
      str: text,
      x: x0,
      y: y0,
      width: Math.max(0, x1 - x0),
      height: Math.max(1, y1 - y0),
      confidence: Number.isFinite(confidence) ? confidence : null
    });
  };

  if (Array.isArray(data?.words) && data.words.length) visit(data.words);
  else visit(data?.blocks || data);
  return output;
}

function collectOcrTsv(tsv = '') {
  const output = [];
  const lines = String(tsv).split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line) continue;
    const columns = line.split('\t');
    if (columns.length < 12 || Number(columns[0]) !== 5) continue;
    const text = cleanDisplayText(columns.slice(11).join('\t'));
    const confidence = Number(columns[10]);
    if (!text || (Number.isFinite(confidence) && confidence < 8)) continue;
    output.push({
      str: text,
      x: Number(columns[6]) || 0,
      y: Number(columns[7]) || 0,
      width: Math.max(0, Number(columns[8]) || 0),
      height: Math.max(1, Number(columns[9]) || 10),
      confidence: Number.isFinite(confidence) ? confidence : null
    });
  }
  return output;
}

async function createOcrWorker(onProgress) {
  const module = await loadTesseract();
  const logger = event => {
    if (!event?.status) return;
    onProgress?.({
      status: event.status,
      progress: Number.isFinite(event.progress) ? event.progress : null
    });
  };
  const worker = await module.createWorker(
    'ara+eng',
    module.OEM?.LSTM_ONLY ?? 1,
    {
      logger,
      workerPath: APP_CONFIG.tesseractWorkerUrl,
      corePath: APP_CONFIG.tesseractCoreUrl,
      langPath: APP_CONFIG.tesseractLangPath,
      cacheMethod: 'write'
    }
  );

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: module.PSM?.AUTO ?? 3,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300'
    });
  } catch {
    // بعض المحركات تتجاهل معاملات غير مدعومة؛ لا يغيّر ذلك قواعد اعتماد القيم.
  }
  return worker;
}

async function recognizeCanvas(worker, canvas, pageNumber) {
  const result = await worker.recognize(
    canvas,
    { rotateAuto: true },
    { text: true, tsv: true, blocks: true }
  );
  const tsvItems = collectOcrTsv(result?.data?.tsv);
  const blockItems = tsvItems.length ? tsvItems : collectOcrWords(result?.data || {});
  const text = cleanDisplayText(result?.data?.text || blockItems.map(item => item.str).join(' '));
  return {
    pageNumber,
    width: canvas.width,
    height: canvas.height,
    items: blockItems,
    text,
    source: 'ocr'
  };
}

async function extractPdfTextPage(page, pdfjs, pageNumber) {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({
    includeMarkedContent: false,
    disableNormalization: false
  });
  const items = (content.items || [])
    .filter(item => typeof item.str === 'string' && cleanDisplayText(item.str))
    .map(item => pdfTextItem(pdfjs, viewport, item));
  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    items,
    text: items.map(item => item.str).join(' '),
    source: 'pdf-text'
  };
}

async function readPdf(file, options = {}) {
  const {
    onProgress,
    signal,
    allowOcr = true,
    forceOcr = false
  } = options;

  emit(onProgress, 3, 'فحص ملف PDF', 'القراءة تتم محليًا داخل المتصفح.');
  const pdfjs = await loadPdfJs();
  abortIfNeeded(signal);
  const bytes = new Uint8Array(await file.arrayBuffer());
  abortIfNeeded(signal);

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    enableXfa: false,
    disableAutoFetch: true,
    disableRange: true,
    disableStream: true,
    useWorkerFetch: false,
    useSystemFonts: true,
    maxImageSize: APP_CONFIG.maxRenderPixels,
    stopAtErrors: false,
    verbosity: 0
  });

  let pdf = null;
  try {
    pdf = await loadingTask.promise;
    if (pdf.numPages > APP_CONFIG.maxPdfPages) {
      throw new ReaderError(
        'pdf-pages',
        `عدد صفحات الملف ${pdf.numPages} ويتجاوز الحد الآمن ${APP_CONFIG.maxPdfPages} صفحة.`
      );
    }

    const pages = [];
    const previews = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      abortIfNeeded(signal);
      emit(
        onProgress,
        6 + pageNumber / pdf.numPages * 34,
        `استخراج النص من الصفحة ${pageNumber} من ${pdf.numPages}`,
        'تُقرأ جميع صفحات البطاقة، لا الصفحة الأولى فقط.'
      );
      const page = await pdf.getPage(pageNumber);
      pages.push(await extractPdfTextPage(page, pdfjs, pageNumber));

      if (pageNumber <= APP_CONFIG.previewMaxPages) {
        try {
          const base = page.getViewport({ scale: 1 });
          const preferred = Math.min(1.25, 650 / Math.max(1, base.width));
          const previewCanvas = await renderPdfPage(page, {
            preferredScale: preferred,
            maxPixels: APP_CONFIG.maxPreviewPixels,
            signal
          });
          const url = canvasDataUrl(previewCanvas, 0.78);
          if (url) previews.push({ pageNumber, url });
          previewCanvas.width = 1;
          previewCanvas.height = 1;
        } catch {
          // المعاينة مساعدة فقط ولا تدخل في اعتماد الأرقام.
        }
      }
      page.cleanup();
    }

    const sparseIndexes = pages
      .map((page, index) => (forceOcr || pageNeedsOcr(page) ? index : -1))
      .filter(index => index >= 0);
    const warnings = [];
    let usedOcrPages = 0;
    let ocrFailure = '';

    if (sparseIndexes.length && !allowOcr) {
      warnings.push('توجد صفحات بلا طبقة نص كافية، وOCR معطل. ستبقى القيم غير المقروءة فارغة للمراجعة اليدوية.');
    } else if (sparseIndexes.length > APP_CONFIG.maxOcrPages) {
      warnings.push(`يحتاج الملف OCR في ${sparseIndexes.length} صفحات، وهو أكثر من الحد الآمن ${APP_CONFIG.maxOcrPages}. لم تُخمن القيم، ويمكن إدخالها يدويًا.`);
    } else if (sparseIndexes.length) {
      let worker = null;
      try {
        emit(onProgress, 42, 'تهيئة القراءة الضوئية المحلية', 'قد يستغرق تنزيل نماذج اللغة وقتًا في أول استخدام فقط.');
        worker = await createOcrWorker(event => {
          if (event.progress === null) return;
          emit(onProgress, 42 + event.progress * 5, 'تهيئة القراءة الضوئية المحلية', event.status);
        });

        for (let i = 0; i < sparseIndexes.length; i += 1) {
          abortIfNeeded(signal);
          const pageIndex = sparseIndexes[i];
          const pageNumber = pageIndex + 1;
          emit(
            onProgress,
            48 + (i / Math.max(1, sparseIndexes.length)) * 40,
            `قراءة الصفحة ${pageNumber} ضوئيًا`,
            `الصفحة ${i + 1} من ${sparseIndexes.length} المحتاجة OCR.`
          );
          const page = await pdf.getPage(pageNumber);
          const canvas = await renderPdfPage(page, {
            preferredScale: 2.2,
            maxPixels: APP_CONFIG.maxRenderPixels,
            signal
          });
          const recognized = await recognizeCanvas(worker, canvas, pageNumber);
          canvas.width = 1;
          canvas.height = 1;
          page.cleanup();

          if (recognized.items.length || meaningfulText(recognized.text).length > meaningfulText(pages[pageIndex].text).length) {
            pages[pageIndex] = recognized;
            usedOcrPages += 1;
          }
        }
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        ocrFailure = error?.message || 'تعذر تشغيل OCR.';
        warnings.push(`${ocrFailure} لم تُنشأ قيم بديلة؛ راجعي الخانات الفارغة يدويًا.`);
      } finally {
        if (worker) await worker.terminate().catch(() => {});
      }
    }

    const mode = usedOcrPages === pages.length && pages.length
      ? 'ocr'
      : usedOcrPages
        ? 'pdf-hybrid'
        : 'pdf-text';

    if (usedOcrPages) {
      warnings.push(`استُخدمت القراءة الضوئية في ${usedOcrPages} صفحة. يجب مقارنة الأرقام الصغيرة بالبطاقة الأصلية.`);
    }

    emit(onProgress, 94, 'اكتملت القراءة الأولية', `تمت معالجة ${pages.length} صفحة دون تقدير هندسي للقيم.`);
    return {
      type: 'pdf',
      pages,
      previews,
      previewDataUrl: previews[0]?.url || '',
      extractionMode: mode,
      warnings,
      rawText: pages.map(page => `الصفحة ${page.pageNumber}\n${page.text || ''}`).join('\n\n'),
      diagnostics: {
        pageCount: pages.length,
        sparsePages: sparseIndexes.map(index => index + 1),
        usedOcrPages,
        ocrFailure,
        mode
      }
    };
  } catch (error) {
    if (error?.name === 'PasswordException') {
      throw new ReaderError('pdf-password', 'الملف محمي بكلمة مرور ولا يمكن تحليله بأمان.');
    }
    if (error instanceof ReaderError || error?.name === 'AbortError') throw error;
    throw new ReaderError('pdf-open', 'تعذر فتح ملف PDF. تأكدي من أنه غير تالف ومن مصدر موثوق.', { cause: error });
  } finally {
    try { await pdf?.destroy?.(); } catch { /* no-op */ }
    try { await loadingTask?.destroy?.(); } catch { /* no-op */ }
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ReaderError('image-open', 'تعذر فتح الصورة. تأكدي من أنها PNG أو JPG سليمة.'));
    };
    image.src = url;
  });
}

async function imageToCanvas(file, signal) {
  abortIfNeeded(signal);
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const scale = scaleWithinPixels(bitmap.width, bitmap.height, 1, APP_CONFIG.maxRenderPixels);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new ReaderError('canvas', 'تعذر تهيئة مساحة رسم الصورة.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      bitmap.close();
    }
  }

  const { image, url } = await loadImageElement(file);
  try {
    const scale = scaleWithinPixels(image.naturalWidth, image.naturalHeight, 1, APP_CONFIG.maxRenderPixels);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new ReaderError('canvas', 'تعذر تهيئة مساحة رسم الصورة.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readImage(file, options = {}) {
  const { onProgress, signal, allowOcr = true } = options;
  emit(onProgress, 8, 'فحص الصورة وتجهيزها', 'لا تُرسل الصورة إلى خادم التطبيق.');
  const canvas = await imageToCanvas(file, signal);
  const previewDataUrl = canvasDataUrl(canvas, 0.82);
  const warnings = [];
  let page = {
    pageNumber: 1,
    width: canvas.width,
    height: canvas.height,
    items: [],
    text: '',
    source: 'manual'
  };
  let ocrFailure = '';

  if (!allowOcr) {
    warnings.push('OCR معطل للصورة؛ ستحتاج القيم إلى الإدخال اليدوي.');
  } else {
    let worker = null;
    try {
      emit(onProgress, 25, 'تهيئة القراءة الضوئية المحلية', 'يتم تنزيل نموذج اللغة أول مرة فقط.');
      worker = await createOcrWorker(event => {
        if (event.progress === null) return;
        emit(onProgress, 25 + event.progress * 20, 'تهيئة القراءة الضوئية المحلية', event.status);
      });
      emit(onProgress, 48, 'قراءة الصورة ضوئيًا', 'راجعي كل رقم بعد الاستخراج.');
      page = await recognizeCanvas(worker, canvas, 1);
      warnings.push('قُرئت الصورة ضوئيًا داخل المتصفح. يجب مقارنة جميع الأرقام بالبطاقة الأصلية.');
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      ocrFailure = error?.message || 'تعذر تشغيل OCR.';
      warnings.push(`${ocrFailure} استخدمي الإدخال اليدوي دون اعتماد قيم تقديرية.`);
    } finally {
      if (worker) await worker.terminate().catch(() => {});
    }
  }

  canvas.width = 1;
  canvas.height = 1;
  return {
    type: 'image',
    pages: [page],
    previews: previewDataUrl ? [{ pageNumber: 1, url: previewDataUrl }] : [],
    previewDataUrl,
    extractionMode: page.items.length ? 'ocr' : 'manual',
    warnings,
    rawText: page.text || '',
    diagnostics: {
      pageCount: 1,
      sparsePages: page.items.length ? [] : [1],
      usedOcrPages: page.items.length ? 1 : 0,
      ocrFailure,
      mode: page.items.length ? 'ocr' : 'manual'
    }
  };
}

export async function readNafisFile(file, options = {}) {
  const meta = await validateUpload(file);
  const settings = {
    onProgress: options.onProgress,
    signal: options.signal,
    allowOcr: options.allowOcr !== false,
    forceOcr: options.forceOcr === true
  };
  const result = meta.type === 'pdf'
    ? await readPdf(file, settings)
    : await readImage(file, settings);
  emit(options.onProgress, 100, 'اكتملت قراءة الملف', 'راجعي القيم المستخرجة قبل الاعتماد.');
  return { ...result, meta, validatedType: meta.type };
}
