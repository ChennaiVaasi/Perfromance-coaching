const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const fs = require("fs");
const path = require("path");

const { evaluatePersonaFromReport, computeWholeStudentProfile } = require("./src/persona-engine");
const { extractOcrTextFromPdfBuffer } = require("./src/report-ocr");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 200,
    fileSize: 25 * 1024 * 1024
  }
});
const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, "data");
const REPORTS_PATH = path.join(DATA_DIR, "reports.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const SUGGESTIONS_PATH = path.join(DATA_DIR, "suggestions.json");
const ADMIN_USER = "coach";
const ADMIN_PASSWORD = "6464";
const sessions = new Map();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  if (!fs.existsSync(REPORTS_PATH)) {
    fs.writeFileSync(REPORTS_PATH, "[]", "utf8");
  }

  if (!fs.existsSync(USERS_PATH)) {
    fs.writeFileSync(USERS_PATH, "[]", "utf8");
  }

  if (!fs.existsSync(SUGGESTIONS_PATH)) {
    fs.writeFileSync(SUGGESTIONS_PATH, "[]", "utf8");
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

function readUsers() {
  ensureDataStore();
  return JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
}

function writeUsers(users) {
  ensureDataStore();
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), "utf8");
}

function readSuggestions() {
  ensureDataStore();
  return JSON.parse(fs.readFileSync(SUGGESTIONS_PATH, "utf8"));
}

function writeSuggestions(suggestions) {
  ensureDataStore();
  fs.writeFileSync(SUGGESTIONS_PATH, JSON.stringify(suggestions, null, 2), "utf8");
}

function seedUsersFromReports() {
  const users = readUsers();
  if (users.length) return;

  const uniqueStudents = [...new Set(readReports().map((report) => report.userName.trim()).filter(Boolean))];
  const seeded = uniqueStudents.map((studentName) => ({
    studentName,
    username: studentName.toLowerCase(),
    password: `${studentName.toLowerCase()}1234`
  }));

  writeUsers(seeded);
}

function findReport(reportId) {
  return readReports().find((report) => report.id === reportId);
}

function issueToken(session) {
  const token = `token-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  sessions.set(token, session);
  return token;
}

function getSession(req) {
  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  const token = bearer || queryToken;
  return token ? sessions.get(token) : null;
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session || session.role !== "admin") {
    res.status(401).json({ error: "Admin access required." });
    return;
  }

  req.session = session;
  next();
}

function requireStudent(req, res, next) {
  const session = getSession(req);
  if (!session || session.role !== "student") {
    res.status(401).json({ error: "Student access required." });
    return;
  }

  req.session = session;
  next();
}

function requireStudentOrAdmin(req, res, next) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Login required." });
    return;
  }

  if (session.role === "admin") {
    req.session = session;
    next();
    return;
  }

  const requestedUser = (req.params.userName || "").trim().toLowerCase();
  if (session.role === "student" && session.studentName.toLowerCase() === requestedUser) {
    req.session = session;
    next();
    return;
  }

  res.status(403).json({ error: "You can only access your own reports." });
}

function requireReportAccess(req, res, next) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Login required." });
    return;
  }

  const report = findReport(req.params.reportId);
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return;
  }

  if (session.role === "admin" || (session.role === "student" && session.studentName.toLowerCase() === report.userName.toLowerCase())) {
    req.session = session;
    req.report = report;
    next();
    return;
  }

  res.status(403).json({ error: "You can only access your own reports." });
}

function parseDurationToSeconds(value) {
  if (!value) return 0;
  const match = String(value).match(/(?:(\d+)h\s*)?(\d+)m\s*(\d+)s/i);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function enrichReportWithHistory(report, reportsForUser) {
  const flowScores = reportsForUser
    .map((item) => ({
      id: item.id,
      seconds: parseDurationToSeconds(item.evaluation?.peakFlow?.peakValue || item.evaluation?.peakFlow?.duration)
    }))
    .filter((item) => item.seconds > 0)
    .sort((a, b) => a.seconds - b.seconds);

  const enduranceScores = reportsForUser
    .map((item) => ({
      id: item.id,
      score: Number(item.evaluation?.extractedSignals?.endurance || 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => a.score - b.score);

  const currentFlow = flowScores.find((item) => item.id === report.id);
  const currentEndurance = enduranceScores.find((item) => item.id === report.id);
  const flowRank = currentFlow ? flowScores.findIndex((item) => item.id === report.id) + 1 : 0;
  const enduranceRank = currentEndurance ? enduranceScores.findIndex((item) => item.id === report.id) + 1 : 0;
  const flowPercentile = flowScores.length > 1 && flowRank ? Math.round(((flowRank - 1) / (flowScores.length - 1)) * 100) : flowRank ? 100 : null;
  const endurancePercentile = enduranceScores.length > 1 && enduranceRank ? Math.round(((enduranceRank - 1) / (enduranceScores.length - 1)) * 100) : enduranceRank ? 100 : null;

  return {
    ...report,
    historyComparison: {
      reportCount: reportsForUser.length,
      flowPercentile,
      endurancePercentile,
      flowRank,
      enduranceRank
    }
  };
}

async function processUploadedReports({ userName, files }) {
  const reports = readReports();
  const createdReports = [];
  const skippedFiles = [];

  for (const file of files) {
    try {
      const parsed = await pdf(file.buffer);
      const baseReportText = (parsed.text || "").replace(/\s+/g, " ").trim();
      const ocrText = await extractOcrTextFromPdfBuffer(file.buffer, { maxPages: 3 });
      const reportText = [baseReportText, ocrText.replace(/\s+/g, " ").trim()].filter(Boolean).join(" ");

      if (!reportText) {
        skippedFiles.push({
          fileName: file.originalname,
          reason: "No usable text could be extracted."
        });
        continue;
      }

      const evaluation = evaluatePersonaFromReport({
        userName,
        reportText,
        ocrText,
        originalFileName: file.originalname
      });

      const uploadFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const uploadPath = path.join(UPLOADS_DIR, uploadFileName);
      fs.writeFileSync(uploadPath, file.buffer);

      const record = {
        id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userName,
        originalFileName: file.originalname,
        createdAt: new Date().toISOString(),
        pdfUrl: `/uploads/${uploadFileName}`,
        reportText,
        ocrText,
        evaluation
      };

      reports.push(record);
      createdReports.push(record);
    } catch (fileError) {
      skippedFiles.push({
        fileName: file.originalname,
        reason: fileError.message
      });
    }
  }

  if (createdReports.length) {
    writeReports(reports);
  }

  return { createdReports, skippedFiles };
}

app.post("/api/auth/admin/login", (req, res) => {
  const username = (req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid admin credentials." });
    return;
  }

  const token = issueToken({ role: "admin", username: ADMIN_USER });
  res.json({ token, role: "admin", username: ADMIN_USER });
});

app.post("/api/auth/student/login", (req, res) => {
  const username = (req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = readUsers().find((entry) => entry.username.toLowerCase() === username && entry.password === password);

  if (!user) {
    res.status(401).json({ error: "Invalid student credentials." });
    return;
  }

  const token = issueToken({ role: "student", username: user.username, studentName: user.studentName });
  res.json({ token, role: "student", username: user.username, studentName: user.studentName });
});

app.get("/api/admin/users", requireAdmin, (_req, res) => {
  try {
    res.json({ users: readUsers() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  const studentName = (req.body.studentName || "").trim();
  const username = (req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!studentName || !username || !password) {
    res.status(400).json({ error: "Student name, username, and password are required." });
    return;
  }

  const users = readUsers();
  const nextUsers = users.filter((entry) => entry.studentName.toLowerCase() !== studentName.toLowerCase() && entry.username.toLowerCase() !== username.toLowerCase());
  const record = { studentName, username, password };
  nextUsers.push(record);
  writeUsers(nextUsers);
  res.status(201).json({ user: record, users: nextUsers });
});

app.get("/api/reports", requireAdmin, (_req, res) => {
  try {
    const reports = readReports().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/students/:userName/reports", requireStudentOrAdmin, (req, res) => {
  try {
    const requestedUser = (req.params.userName || "").trim().toLowerCase();
    const reports = readReports()
      .filter((report) => report.userName.toLowerCase() === requestedUser)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const enrichedReports = reports.map((report) => enrichReportWithHistory(report, reports));

    res.json({
      userName: req.params.userName,
      reports: enrichedReports
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/students/:userName/resources", requireStudentOrAdmin, (req, res) => {
  try {
    const requestedUser = (req.params.userName || "").trim().toLowerCase();
    const resources = readSuggestions()
      .filter((item) => item.studentName.toLowerCase() === requestedUser)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    res.json({ userName: req.params.userName, resources });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/students/:userName/resources", requireAdmin, (req, res) => {
  const studentName = (req.params.userName || "").trim();
  const type = (req.body.type || "").trim() || "Activity";
  const title = (req.body.title || "").trim();
  const url = (req.body.url || "").trim();
  const notes = (req.body.notes || "").trim();

  if (!studentName || !title) {
    res.status(400).json({ error: "Student name and title are required." });
    return;
  }

  const suggestions = readSuggestions();
  const record = {
    id: `resource-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentName,
    type,
    title,
    url,
    notes,
    createdAt: new Date().toISOString()
  };
  suggestions.push(record);
  writeSuggestions(suggestions);
  res.status(201).json({ resource: record, resources: suggestions.filter((item) => item.studentName.toLowerCase() === studentName.toLowerCase()) });
});

app.get("/api/reports/:reportId", requireReportAccess, (req, res) => {
  try {
    res.json({ report: req.report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reports/:reportId/evidence/:metricKey", requireReportAccess, (req, res) => {
  try {
    const evidence = req.report.evaluation?.metricEvidence?.[req.params.metricKey];
    if (!evidence) {
      res.status(404).json({ error: "Metric evidence not found." });
      return;
    }

    res.json({ report: req.report, evidence });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reports/:reportId/activities/:activityKey", requireReportAccess, (req, res) => {
  try {
    const branch = (req.report.evaluation?.activityBranches || []).find((item) => item.key === req.params.activityKey);
    if (!branch) {
      res.status(404).json({ error: "Activity branch not found." });
      return;
    }

    res.json({ report: req.report, branch });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/students/:userName/profile", requireStudentOrAdmin, (req, res) => {
  try {
    const requestedUser = (req.params.userName || "").trim().toLowerCase();
    const reports = readReports()
      .filter((report) => report.userName.toLowerCase() === requestedUser)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const profile = computeWholeStudentProfile(reports);
    if (!profile) {
      res.status(404).json({ error: "No reports found for this student." });
      return;
    }

    res.json({ userName: req.params.userName, profile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reports/:reportId/pdf", requireReportAccess, (req, res) => {
  if (!req.report.pdfUrl) {
    res.status(404).json({ error: "PDF not available for this report." });
    return;
  }

  const fileName = req.report.pdfUrl.split("/").pop();
  const filePath = path.join(UPLOADS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "PDF file not found on disk." });
    return;
  }

  res.sendFile(filePath);
});

app.post("/api/reports/upload", requireAdmin, upload.array("reports"), async (req, res) => {
  try {
    const userName = (req.body.userName || "").trim();

    if (!userName) {
      res.status(400).json({ error: "User name is required." });
      return;
    }

    const files = (req.files || []).filter((file) => file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname));
    if (!files.length) {
      res.status(400).json({ error: "At least one PDF report is required." });
      return;
    }

    const { createdReports, skippedFiles } = await processUploadedReports({ userName, files });

    if (!createdReports.length) {
      res.status(400).json({ error: "The uploaded PDFs could not be read into usable reports." });
      return;
    }

    res.status(201).json({
      reports: createdReports,
      count: createdReports.length,
      skippedFiles
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to process report: ${error.message}` });
  }
});

app.post("/api/student/reports/upload", requireStudent, upload.array("reports"), async (req, res) => {
  try {
    const userName = req.session.studentName;
    const files = (req.files || []).filter((file) => file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname));
    if (!files.length) {
      res.status(400).json({ error: "At least one PDF report is required." });
      return;
    }

    const { createdReports, skippedFiles } = await processUploadedReports({ userName, files });
    if (!createdReports.length) {
      res.status(400).json({ error: "The uploaded PDFs could not be read into usable reports." });
      return;
    }

    res.status(201).json({
      reports: createdReports,
      count: createdReports.length,
      skippedFiles
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to process student upload: ${error.message}` });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

ensureDataStore();
seedUsersFromReports();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Performance coaching app running at http://0.0.0.0:${PORT}`);
});
