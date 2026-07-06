const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const fs = require("fs");
const path = require("path");

const { evaluatePersonaFromReport } = require("./src/persona-engine");
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
  res.json({ users: readUsers() });
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
  const reports = readReports().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ reports });
});

app.get("/api/students/:userName/reports", requireStudentOrAdmin, (req, res) => {
  const requestedUser = (req.params.userName || "").trim().toLowerCase();
  const reports = readReports()
    .filter((report) => report.userName.toLowerCase() === requestedUser)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  res.json({
    userName: req.params.userName,
    reports
  });
});

app.get("/api/reports/:reportId", requireReportAccess, (req, res) => {
  res.json({ report: req.report });
});

app.get("/api/reports/:reportId/evidence/:metricKey", requireReportAccess, (req, res) => {
  const evidence = req.report.evaluation?.metricEvidence?.[req.params.metricKey];
  if (!evidence) {
    res.status(404).json({ error: "Metric evidence not found." });
    return;
  }

  res.json({ report: req.report, evidence });
});

app.get("/api/reports/:reportId/activities/:activityKey", requireReportAccess, (req, res) => {
  const branch = (req.report.evaluation?.activityBranches || []).find((item) => item.key === req.params.activityKey);
  if (!branch) {
    res.status(404).json({ error: "Activity branch not found." });
    return;
  }

  res.json({ report: req.report, branch });
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

    if (!createdReports.length) {
      res.status(400).json({ error: "The uploaded PDFs could not be read into usable reports." });
      return;
    }

    writeReports(reports);

    res.status(201).json({
      reports: createdReports,
      count: createdReports.length,
      skippedFiles
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to process report: ${error.message}` });
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
