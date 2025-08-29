# PDF 轉文字（HTML/JS/PHP）

**一句話**：完全前端運作，先用 pdf.js 抽文字層，不足時以 Tesseract.js（WASM）做 OCR；免安裝、可整包帶走。

## 快速使用
1. 把整個資料夾放到 XAMPP `htdocs/pdf2text_site/`。
2. 用瀏覽器開 `http://localhost/pdf2text_site/`。
3. 拖放或選擇 PDF → 會顯示卡片、進度、純文字，支援複製與 `.txt` 下載。
4. 模式可選：
   - **自動**：先抽文字層，不足時自動跑 OCR。
   - **只取文字層**：最快，但遇掃描 PDF 會沒字。
   - **只 OCR**：對掃描 PDF 最有效，但較耗時。

## 完全離線（可攜）
已內建**本地 vendor 路徑**的預留位：
- `assets/vendor/pdfjs/`：放 `pdf.min.js`、`pdf.worker.min.js`
- `assets/vendor/tesseract/`：放 `tesseract.min.js`、`tesseract.worker.min.js`、`tesseract-core-simd.wasm`（或 `tesseract-core.wasm`）
- `assets/tessdata/`：放 `chi_tra.traineddata.gz`、`eng.traineddata.gz`

> 預設頁面會先嘗試載入本地 vendor，若找不到再回退到 CDN；
> 要完全離線，只需把上述檔案放好即可（不需修改程式）。

**注意**：請用 `http://localhost/...` 開啟；`file://` 可能因 CORS 導致 WASM/語言檔無法載入。

## 檔案結構
```
pdf2text_site/
├─ index.html
├─ assets/
│  ├─ css/style.css
│  ├─ js/app.js
│  ├─ vendor/
│  │  ├─ pdfjs/                 # (可選) 本地 pdf.js 放這裡
│  │  └─ tesseract/             # (可選) 本地 tesseract.js/wasm 放這裡
│  └─ tessdata/                 # (可選) 語言資料（chi_tra/eng）放這裡
└─ api/
   └─ convert.php               # 目前僅健康檢查
```

## 版本
- pdf.js：預設 CDN `3.11.174`；可改為本地。
- tesseract.js：預設 CDN `v5`；可改為本地。

## 常見問題
- **拖放後瀏覽器直接打開 PDF？** 已攔截全域拖放；請確認拖放目標在灰框內。
- **空白輸出？** 可能是掃描 PDF，切「只 OCR」或維持「自動」並等候 OCR 完成。
- **很慢/很吃資源？** 可在 `app.js` 將 `scale` 從 `2.0` 降為 `1.5`；或先用「只取文字層」。

