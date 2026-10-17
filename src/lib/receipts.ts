import { uid } from './model';
import { foodDay } from './food-calc';
import { foodDate, type Purchase } from './food-model';
export async function receiptFingerprint(data: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
export function parseReceiptText(
  raw: string,
): Pick<Purchase, 'retailer' | 'date' | 'lines' | 'total'> {
  const lines = raw
    .slice(0, 100000)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const products: Purchase['lines'] = [];
  let date = foodDay(),
    total: number | undefined;
  const dateMatch = raw.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/);
  if (dateMatch) {
    const year = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
    const candidate = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
    if (foodDate.safeParse(candidate).success) date = candidate;
  }
  for (const line of lines) {
    if (/calori|kcal/i.test(line)) continue;
    const amount = line.match(/(-?\d+[.,]\d{2})\s*(?:[A-Z])?$/);
    if (!amount) continue;
    const paid = Number(amount[1].replace(',', '.'));
    const description = line.slice(0, amount.index).replace(/[£€$]/g, '').trim();
    if (/^(?:grand\s+)?total\b|amount\s+(?:paid|due)/i.test(description)) {
      total = paid;
      continue;
    }
    if (
      /subtotal|sub total|cash|change|card|visa|mastercard|vat|tax|balance|tender|saving\s+total/i.test(
        description,
      )
    )
      continue;
    if (paid < 0 && products.length && /discount|saving|offer|reduction/i.test(description)) {
      const previous = products.at(-1)!;
      previous.discount += -paid;
      previous.paid = Math.max(0, previous.paid + paid);
      continue;
    }
    if (paid < 0 || !description || /^\d+[/.\-]/.test(description)) continue;
    const pack = description.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|ml|g|l)\b/i);
    products.push({
      id: uid(),
      description,
      quantity: pack ? Number(pack[1].replace(',', '.')) : undefined,
      unit: pack ? (pack[2].toLowerCase() as 'kg' | 'ml' | 'g' | 'l') : 'g',
      packages: 1,
      paid,
      discount: 0,
      received: false,
      location: 'Cupboard',
    });
  }
  return {
    retailer: lines.find((l) => /[a-z]/i.test(l) && !calorieLine(l))?.slice(0, 200) ?? '',
    date,
    lines: products,
    total: total ?? products.reduce((sum, l) => sum + l.paid, 0),
  };
}
const calorieLine = (s: string) => /calori|kcal/i.test(s);
export function reviewableReceiptText(s: string) {
  return s
    .split(/\r?\n/)
    .filter((line) => !calorieLine(line))
    .join('\n');
}
type OCRWorker = {
  recognize: (image: string) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};
/** All engine, model and image URLs stay on the app origin. The worker never uploads an image. */
export async function recogniseReceipt(
  data: string,
  onProgress: (s: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const base = import.meta.env.BASE_URL + 'ocr/';
  let worker: OCRWorker | undefined;
  let stopped = false;
  let rejectStop: (reason: Error) => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectStop = reject;
  });
  const stop = (message: string) => {
    stopped = true;
    rejectStop(Error(message));
    void worker?.terminate().catch(() => {});
  };
  const abort = () => stop('Recognition cancelled. Manual purchase entry is still available.');
  signal?.addEventListener('abort', abort);
  const timer = setTimeout(
    () => stop('Recognition timed out. Enter the purchase manually or try a clearer image.'),
    120000,
  );
  try {
    if (signal?.aborted) throw Error('Recognition cancelled.');
    const module = await Promise.race([
      import(/* @vite-ignore */ base + 'tesseract.esm.min.js') as Promise<{
        default: {
          createWorker: (language: string, oem: number, options: object) => Promise<OCRWorker>;
        };
      }>,
      cancelled,
    ]);
    const loading = module.default.createWorker('eng', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base + 'tesseract-core-lstm.wasm.js',
      langPath: base,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) =>
        onProgress(`${m.status} ${Math.round((m.progress ?? 0) * 100)}%`),
    });
    void loading
      .then((late) => {
        if (stopped) void late.terminate().catch(() => {});
      })
      .catch(() => {});
    worker = await Promise.race([loading, cancelled]);
    if (signal?.aborted) throw Error('Recognition cancelled.');
    const result = await Promise.race([worker.recognize(data), cancelled]);
    return reviewableReceiptText(result.data.text);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    await worker?.terminate().catch(() => {});
  }
}
