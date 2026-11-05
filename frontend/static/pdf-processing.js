/* Browser-side PDF extraction, Arabic OCR and source-page rendering.
 * PDF.js and Tesseract.js are loaded as UMD globals before this file.
 */
(function () {
  'use strict';
  const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;

  function normalizeArabic(value) {
    return String(value || '').toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  }
  function cleanText(value) {
    return String(value || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  function makeChunks(text, limit = 9000) {
    const chunks = [];
    let remaining = cleanText(text);
    while (remaining.length > limit) {
      const window = remaining.slice(0, limit + 1);
      const candidates = [...window.matchAll(/[.!?؟。](?:\s|$)|\n/g)].map(m => m.index + m[0].length).filter(n => n > limit * 0.55);
      let cut = candidates.length ? candidates[candidates.length - 1] : window.lastIndexOf(' ');
      if (cut < 1) cut = limit;
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }
  function normalizedRect(rect, viewport) {
    const points = viewport.convertToViewportRectangle(rect);
    const xs = [points[0], points[2]], ys = [points[1], points[3]];
    return {
      x0: Math.max(0, Math.min(...xs) / viewport.width),
      y0: Math.max(0, Math.min(...ys) / viewport.height),
      x1: Math.min(1, Math.max(...xs) / viewport.width),
      y1: Math.min(1, Math.max(...ys) / viewport.height),
    };
  }
  async function extractNative(page, viewport) {
    const content = await page.getTextContent();
    const regions = [];
    const lines = [];
    for (const item of content.items || []) {
      if (!item.str || !item.str.trim()) continue;
      lines.push(item.str);
      const tr = item.transform || [];
      const x = Number(tr[4]) || 0;
      const y = Number(tr[5]) || 0;
      const height = Math.max(1, Math.hypot(Number(tr[2]) || 0, Number(tr[3]) || 0));
      const rect = normalizedRect([x, y - height, x + (Number(item.width) || 1), y], viewport);
      regions.push({ text: item.str.trim(), ...rect });
    }
    return { text: cleanText(lines.join(' ')), regions };
  }
  async function extractOcr(page, viewport, worker) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const renderViewport = page.getViewport({ scale: 1.45 });
    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    await page.render({ canvasContext: context, viewport: renderViewport }).promise;
    const result = await worker.recognize(canvas);
    const data = result.data || {};
    const lines = (data.lines || []).filter(line => line.text && line.text.trim());
    const regions = lines.map(line => {
      const box = line.bbox || {};
      return {
        text: line.text.trim(),
        x0: Math.max(0, (box.x0 || 0) / canvas.width),
        y0: Math.max(0, (box.y0 || 0) / canvas.height),
        x1: Math.min(1, (box.x1 || canvas.width) / canvas.width),
        y1: Math.min(1, (box.y1 || canvas.height) / canvas.height),
      };
    });
    const text = cleanText(data.text || lines.map(line => line.text).join('\n'));
    canvas.width = 0; canvas.height = 0;
    return { text, regions };
  }
  async function processPdf(file, onProgress = () => {}) {
    if (!window.pdfjsLib) throw new Error('PDF.js failed to load. Refresh the page and try again.');
    if (!window.Tesseract) throw new Error('Arabic OCR engine failed to load. Refresh the page and try again.');
    const bytes = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    let worker = null;
    const pages = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        onProgress({ page: pageNumber, total: pdf.numPages, phase: 'extracting' });
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        let extracted = await extractNative(page, viewport);
        if (extracted.text.length < 80) {
          if (!worker) {
            onProgress({ page: pageNumber, total: pdf.numPages, phase: 'loading-arabic-ocr' });
            worker = await window.Tesseract.createWorker('ara+eng', 1, {
              logger: message => {
                if (message.status === 'recognizing text') {
                  onProgress({ page: pageNumber, total: pdf.numPages, phase: 'ocr', progress: message.progress || 0 });
                }
              },
            });
          }
          const scanned = await extractOcr(page, viewport, worker);
          if (scanned.text.length > extracted.text.length) extracted = scanned;
        }
        const chunks = makeChunks(extracted.text);
        chunks.forEach((text, partIndex) => {
          const regions = extracted.regions.length ? extracted.regions : [{
            text, x0: 0, y0: 0, x1: 1, y1: 1,
          }];
          pages.push({
            page: pageNumber,
            part: partIndex + 1,
            number: `PDF page ${pageNumber}`,
            title: '',
            text,
            search_text: normalizeArabic(text),
            region_json: regions,
          });
        });
        onProgress({ page: pageNumber, total: pdf.numPages, phase: 'complete' });
        page.cleanup();
      }
    } finally {
      if (worker) await worker.terminate();
      await pdf.destroy();
    }
    return { pages, pageCount: pdf.numPages };
  }

  async function renderStoredPage(fileId, pageNumber, crop) {
    const db = window.darsyncSupabase;
    const { data: file, error: fileError } = await db.from('study_files')
      .select('storage_path').eq('id', fileId).single();
    if (fileError) throw fileError;
    const { data: blob, error } = await db.storage.from('study-pdfs').download(file.storage_path);
    if (error) throw error;
    const bytes = await blob.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    try {
      const page = await pdf.getPage(Number(pageNumber));
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      let output = canvas;
      if (crop && crop.x1 > crop.x0 && crop.y1 > crop.y0) {
        const cropped = document.createElement('canvas');
        const x = Math.max(0, Math.floor(crop.x0 * canvas.width));
        const y = Math.max(0, Math.floor(crop.y0 * canvas.height));
        const w = Math.max(1, Math.min(canvas.width - x, Math.ceil((crop.x1 - crop.x0) * canvas.width)));
        const h = Math.max(1, Math.min(canvas.height - y, Math.ceil((crop.y1 - crop.y0) * canvas.height)));
        cropped.width = w; cropped.height = h;
        cropped.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
        output = cropped;
      }
      const result = await new Promise((resolve, reject) => output.toBlob(b => b ? resolve(b) : reject(new Error('Could not render PDF preview.')), 'image/png'));
      canvas.width = 0; canvas.height = 0;
      if (output !== canvas) { output.width = 0; output.height = 0; }
      return result;
    } finally {
      await pdf.destroy();
    }
  }

  window.darsyncPdf = { processPdf, renderStoredPage, normalizeArabic };
})();
