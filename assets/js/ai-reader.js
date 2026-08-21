import { RUNTIME_CONFIG } from './runtime-config.js';
import { APP_CONFIG } from './config.js';

export class AiReaderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AiReaderError';
    this.code = code;
    this.details = details;
  }
}

function normalizedEndpoint() {
  const raw = String(RUNTIME_CONFIG.aiEndpoint || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, location.href);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) return '';
    return url.href.replace(/\/$/, '');
  } catch { return ''; }
}

export function aiEndpoint() { return normalizedEndpoint(); }
export function isAiConfigured() { return Boolean(normalizedEndpoint()); }

function genericFilename(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type === 'application/pdf') return 'nafis-card.pdf';
  if (type === 'image/png') return 'nafis-card.png';
  return 'nafis-card.jpg';
}

export async function testAiConnection({ signal } = {}) {
  const endpoint = normalizedEndpoint();
  if (!endpoint) return { ok: false, configured: false, message: 'لم يُضبط رابط قارئ الذكاء الاصطناعي بعد.' };
  const health = endpoint.replace(/\/analyze(?:\?.*)?$/, '/health');
  try {
    const response = await fetch(health, { method: 'GET', mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok && payload?.ok === true, configured: true, message: payload?.message || (response.ok ? 'الاتصال جاهز.' : 'تعذر التحقق من الخدمة.') };
  } catch (error) {
    return { ok: false, configured: true, message: 'تعذر الاتصال بخدمة القراءة الآمنة.', error };
  }
}

export async function readNafisWithAI(file, { gradeHint = '', signal, onProgress } = {}) {
  const endpoint = normalizedEndpoint();
  if (!endpoint) throw new AiReaderError('not-configured', 'قارئ الذكاء الاصطناعي غير مربوط بعد.');
  if (!file?.size) throw new AiReaderError('file-missing', 'لم يتم اختيار ملف صالح.');
  if (file.size > APP_CONFIG.aiMaxFileBytes) throw new AiReaderError('file-too-large', 'الملف يتجاوز الحد المسموح للقراءة بالذكاء الاصطناعي.');

  onProgress?.({ value: 12, message: 'تجهيز نسخة مؤقتة بلا اسم الملف الأصلي', detail: 'لا يُرسل اسم ملف المدرسة إلى الخدمة.' });
  const safeFile = new File([file], genericFilename(file), { type: file.type || 'application/octet-stream', lastModified: 0 });
  const form = new FormData();
  form.append('file', safeFile);
  form.append('gradeHint', gradeHint || '');

  onProgress?.({ value: 28, message: 'إرسال مشفّر إلى قارئ الذكاء الاصطناعي', detail: 'المفتاح السري موجود في الخادم الوسيط فقط، وليس في المتصفح.' });
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST', body: form, mode: 'cors', cache: 'no-store', credentials: 'omit',
      referrerPolicy: 'no-referrer', signal,
      headers: { 'X-Nafis-Client': APP_CONFIG.versionCode }
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new AiReaderError('network', 'تعذر الوصول إلى قارئ الذكاء الاصطناعي الآمن. تحققي من الاتصال وإعداد الخادم.', { cause: error });
  }

  onProgress?.({ value: 75, message: 'مراجعة الاستجابة المنظمة', detail: 'لا تُقبل الاستجابة إلا إذا كانت JSON منظمة من الخادم.' });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const message = payload?.message || `تعذر التحليل الآلي (HTTP ${response.status}).`;
    throw new AiReaderError(payload?.code || 'server', message, { status: response.status });
  }
  if (!payload.data || typeof payload.data !== 'object' || !Array.isArray(payload.data.subjects)) {
    throw new AiReaderError('invalid-response', 'أعاد القارئ استجابة غير صالحة؛ لم تُعتمد أي قيمة.');
  }
  onProgress?.({ value: 100, message: 'اكتملت القراءة بالذكاء الاصطناعي', detail: 'راجعي القيم مقابل البطاقة الأصلية قبل الاعتماد.' });
  return payload;
}
