// 前端 PDF 轉文字：文字層 + Tesseract.js OCR（免安裝，可攜帶）

const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));

const ocrModeSel  = qs('#ocrMode');
const dropzone     = qs('#dropzone');
const fileInput    = qs('#fileInput');
const resultsWrap  = qs('#results');
const clearBtn     = qs('#clearBtn');
const searchInput  = qs('#searchInput');

// 🔒 全域攔截：避免 PDF 被瀏覽器直接開走
['dragover','drop'].forEach(type => {
  window.addEventListener(type, (e) => {
    if (!dropzone || !dropzone.contains(e.target)) { e.preventDefault(); }
  }, false);
});

function humanSize(bytes){
  if (!bytes && bytes !== 0) return '';
  const units = ['B','KB','MB','GB'];
  const i = Math.min(Math.floor(Math.log(bytes)/Math.log(1024)), units.length-1);
  return (bytes/Math.pow(1024,i)).toFixed(1) + ' ' + units[i];
}

function acceptFiles(files){
  const list = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (!list.length) { toast(resultsWrap, '未選取 PDF 或格式不符', true); return; }
  toast(resultsWrap, `已選取 ${list.length} 個 PDF，開始解析…`);
  list.forEach(processFile);
}

// Drop 區事件
['dragenter','dragover'].forEach(evt => dropzone.addEventListener(evt, e => {
  e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover');
}));
['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, e => {
  e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover');
}));

dropzone.addEventListener('drop', e => acceptFiles(e.dataTransfer.files));
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => acceptFiles(fileInput.files));

clearBtn.addEventListener('click', () => { resultsWrap.innerHTML = ''; fileInput.value = ''; searchInput.value=''; });

// 搜尋（檔名或內容）
searchInput.addEventListener('input', () => {
  const kw = searchInput.value.trim().toLowerCase();
  qsa('.card', resultsWrap).forEach(card => {
    const name = card.dataset.name || '';
    const body = card.querySelector('textarea')?.value || '';
    const hit = !kw || name.includes(kw) || body.toLowerCase().includes(kw);
    card.style.display = hit ? '' : 'none';
  });
});

// 確保 pdf.js 與 tesseract.js 皆已就緒
async function ensureLibraries() {
  await (window.__libsLoaded || Promise.resolve(true));
  // 設定 pdf.js worker（若已載入）
  if (window['pdfjsLib']) {
    // 優先用本地 worker，失敗再 CDN
    const localWorker = 'assets/vendor/pdfjs/pdf.worker.min.js';
    const cdnWorker = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    // 先假設本地存在，真正缺檔會在載入時由 pdf.js 自行抓取失敗；此處直接用 CDN 以提升成功率
    pdfjsLib.GlobalWorkerOptions.workerSrc = cdnWorker;
  }
}

async function processFile(file){
  await ensureLibraries();

  const card = createCard(file.name, humanSize(file.size));
  resultsWrap.prepend(card.root);

  try{
    if (!window['pdfjsLib']) throw new Error('pdf.js 未載入成功');
    if (!window['Tesseract']) throw new Error('Tesseract.js 未載入成功');

    let text = '';
    const mode = (ocrModeSel?.value || 'auto');

    if (mode === 'text') {
      text = await extractTextLayer(file, p => card.setProgress(p));
    } else if (mode === 'ocr') {
      text = await ocrWithTesseract(file, p => card.setProgress(p));
    } else { // auto
      text = await extractTextLayer(file, p => card.setProgress(p * 0.6));
      if (!text || text.trim().length < 20) {
        card.addBadge('自動模式：偵測為掃描型，改用 OCR 中…');
        const ocrText = await ocrWithTesseract(file, p => card.setProgress(60 + p*0.4));
        if (ocrText && ocrText.trim()) text = ocrText;
      } else {
        card.setProgress(100);
      }
    }

    card.setText(text || '');
    card.setStatus('完成');
  } catch (err){
    console.error(err);
    card.setStatus('失敗');
    card.addBadge(String(err?.message || err), 'err');
  } finally {
    card.setProgress(100);
  }
}

function createCard(filename, size){
  const root = document.createElement('article');
  root.className = 'card';
  root.dataset.name = (filename||'').toLowerCase();
  root.innerHTML = `
    <div class="header">
      <div class="name" title="${filename}">${filename}</div>
      <div class="status">準備中…</div>
    </div>
    <div class="body">
      <div class="progress" aria-label="解析進度"><span style="width:0%"></span></div>
      <p class="small" style="margin:8px 0 6px">大小：${size}</p>
      <textarea placeholder="轉出的純文字將顯示於此…" spellcheck="false"></textarea>
      <div class="row">
        <button class="btn minor copyBtn" type="button">複製文字</button>
        <button class="btn" type="button">下載 .txt</button>
      </div>
      <div class="row badges"></div>
    </div>`;

  const statusEl = root.querySelector('.status');
  const progBar  = root.querySelector('.progress > span');
  const ta       = root.querySelector('textarea');
  const badges   = root.querySelector('.badges');
  const copyBtn  = root.querySelector('.copyBtn');
  const dlBtn    = root.querySelector('.btn:not(.copyBtn)');

  copyBtn.addEventListener('click', async () => {
    try{ await navigator.clipboard.writeText(ta.value || '');
      toast(root, '已複製到剪貼簿');
    }catch{ toast(root, '複製失敗', true); }
  });

  dlBtn.addEventListener('click', () => {
    const blob = new Blob([ta.value || ''], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (root.dataset.name?.replace(/\.pdf$/i,'') || 'output') + '.txt';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  });

  return {
    root,
    setStatus(s){ statusEl.textContent = s; },
    setProgress(p){ progBar.style.width = Math.max(0, Math.min(100, p)) + '%'; },
    setText(t){ ta.value = t || ''; },
    addBadge(msg, type){
      const span = document.createElement('span');
      span.className = 'badge' + (type? (' '+type):'');
      span.textContent = msg;
      badges.appendChild(span);
    }
  };
}

function toast(container, message, isErr=false){
  const t = document.createElement('div');
  t.textContent = message;
  t.style.cssText = 'position:sticky; bottom:8px; margin-top:10px; padding:8px 10px; border-radius:8px; border:1px solid #2b4b41; background:#0a1512; font-size:13px;'+(isErr?'color:#ffb4b4; border-color:#5f1717; background:#1a0a0a;':'');
  container.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// —— 文字層抽取（最快，需 PDF 內本來就有文字層）
async function extractTextLayer(file, onProgress){
  if (!window['pdfjsLib']) throw new Error('pdf.js 尚未載入');
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buf });
  const pdf = await loadingTask.promise;

  let out = '';
  for (let p = 1; p <= pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map(i => (i && i.str) ? i.str : '').join('');
    out += strings + '\n\n';
    onProgress?.(Math.round(p/pdf.numPages*100));
  }
  return out;
}

// —— Tesseract.js OCR（免安裝，可離線：需把 tessdata 放到 assets/tessdata/）
let _tessWorker = null;
async function getTessWorker(){
  if (_tessWorker) return _tessWorker;

  // 嘗試使用本地路徑；若失敗將由 CDN 版本自動載入其內建 worker/core
  const options = {
    logger: m => { /* 可加上進度顯示 */ },
    // 若你有放本地 tesseract 檔案，可取消下方註解：
    // workerPath: 'assets/vendor/tesseract/tesseract.worker.min.js',
    // corePath:   'assets/vendor/tesseract/tesseract-core-simd.wasm',
    // langPath:   'assets/tessdata'
  };

  const worker = await Tesseract.createWorker(options);
  try {
    await worker.loadLanguage('chi_tra+eng');
  } catch(e) {
    // 若本地語言檔未就緒，可嘗試只用 eng 以確保可用
    await worker.loadLanguage('eng');
  }
  try { await worker.initialize('chi_tra+eng'); }
  catch { await worker.initialize('eng'); }

  _tessWorker = worker;
  return worker;
}

async function ocrWithTesseract(file, onProgress){
  if (!window['pdfjsLib']) throw new Error('pdf.js 未載入');
  if (!window['Tesseract']) throw new Error('Tesseract.js 未載入');

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const worker = await getTessWorker();
  let out = '';

  for (let p = 1; p <= pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const scale = 2.0; // 2~3 解析度較高但更吃資源
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const { data: { text } } = await worker.recognize(canvas);
    out += (text || '') + '\n';
    onProgress?.(Math.round(p/pdf.numPages*100));

    // 釋放記憶體
    canvas.width = canvas.height = 0;
  }

  return out.trim();
}
