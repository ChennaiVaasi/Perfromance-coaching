const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { createWorker } = require("tesseract.js");

const execFileAsync = promisify(execFile);
const PDFTOPPM_PATH = "pdftoppm";

async function extractOcrTextFromPdfBuffer(buffer, options = {}) {
  const maxPages = options.maxPages || 3;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-ocr-"));
  const pdfPath = path.join(tempDir, "report.pdf");
  const outputPrefix = path.join(tempDir, "page");
  fs.writeFileSync(pdfPath, buffer);

  try {
    await execFileAsync(PDFTOPPM_PATH, ["-f", "1", "-l", String(maxPages), "-png", pdfPath, outputPrefix], {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    });

    const imageFiles = fs
      .readdirSync(tempDir)
      .filter((file) => /^page-\d+\.png$/i.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (!imageFiles.length) {
      return "";
    }

    const worker = await createWorker("eng");
    const texts = [];
    for (const file of imageFiles) {
      const imagePath = path.join(tempDir, file);
      const { data } = await worker.recognize(imagePath);
      if (data?.text) {
        texts.push(data.text.replace(/\r/g, "").trim());
      }
    }
    await worker.terminate();

    return texts.filter(Boolean).join("\n");
  } catch (_error) {
    return "";
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { extractOcrTextFromPdfBuffer };
