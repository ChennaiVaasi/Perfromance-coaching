const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const fs = require("fs");
const path = require("path");

const { evaluatePersonaFromReport } = require("./src/persona-engine");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 4783;
const DATA_DIR = path.join(__dirname, "data");
const REPORTS_PATH = path.join(DATA_DIR, "reports.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(REPORTS_PATH)) {
    fs.writeFileSync(REPORTS_PATH, "[]", "utf8");
  }
}

function readReports() {
  ensureDataStore();
  return JSON.parse(fs.readFileSync(REPORTS_PATH, "utf8"));
}

function writeReports(reports) {
  ensureDataStore();
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(reports, null, 2), "utf8");
}

app.get("/api/reports", (_req, res) => {
  const reports = readReports().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ reports });
});

app.post("/api/reports/upload", upload.single("report"), async (req, res) => {
  try {
    const userName = (req.body.userName || "").trim();

    if (!userName) {
      res.status(400).json({ error: "User name is required." });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "A PDF report is required." });
      return;
    }

    const parsed = await pdf(req.file.buffer);
    const reportText = (parsed.text || "").replace(/\s+/g, " ").trim();

    if (!reportText) {
      res.status(400).json({ error: "Could not extract usable text from this PDF." });
      return;
    }

    const evaluation = evaluatePersonaFromReport({
      userName,
      reportText,
      originalFileName: req.file.originalname
    });

    const reports = readReports();
    const record = {
      id: `report-${Date.now()}`,
      userName,
      originalFileName: req.file.originalname,
      createdAt: new Date().toISOString(),
      reportText,
      evaluation
    };

    reports.push(record);
    writeReports(reports);

    res.status(201).json({ report: record });
  } catch (error) {
    res.status(500).json({ error: `Failed to process report: ${error.message}` });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

ensureDataStore();
app.listen(PORT, () => {
  console.log(`Performance coaching app running at http://127.0.0.1:${PORT}`);
});
