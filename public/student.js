const studentParams = new URLSearchParams(window.location.search);

const studentAppShell = document.getElementById("student-app-shell");
const studentLogoutButton = document.getElementById("student-logout");
const studentStatus = document.getElementById("student-status");
const studentSummaryStack = document.getElementById("student-summary-stack");
const studentTitle = document.getElementById("student-title");
const studentSummary = document.getElementById("student-summary");
const studentSessionCount = document.getElementById("student-session-count");
const studentPersonaCard = document.getElementById("student-persona-card");
const studentPeakFlowPanel = document.getElementById("student-peak-flow-panel");
const studentEngineGrid = document.getElementById("student-engine-grid");
const studentActivityGrid = document.getElementById("student-activity-grid");
const studentPlanTitle = document.getElementById("student-plan-title");
const studentPlanBody = document.getElementById("student-plan-body");
const studentSteps = document.getElementById("student-steps");
const studentReportList = document.getElementById("student-report-list");
const studentSignatureLabel = document.getElementById("student-signature-label");
const studentSignatureHeadline = document.getElementById("student-signature-headline");
const studentSignatureSupport = document.getElementById("student-signature-support");

let studentReports = [];
let activeStudentReportId = studentParams.get("report") || "";
let activeStudentName = getStudentName() || "";

function setStudentStatus(message, isError = false) {
  studentStatus.textContent = message;
  studentStatus.style.color = isError ? "#ff9c9c" : "";
}

function studentEvidenceLink(reportId, metricKey) {
  return `/evidence.html?report=${encodeURIComponent(reportId)}&metric=${encodeURIComponent(metricKey)}`;
}

function studentActivityLink(reportId, activityKey) {
  return `/activity.html?report=${encodeURIComponent(reportId)}&activity=${encodeURIComponent(activityKey)}`;
}

function renderStudentEmptyState(message = "Choose a student to load their reports.") {
  studentSummaryStack.innerHTML = "";
  studentPersonaCard.innerHTML = `<div class="loading">${message}</div>`;
  studentPeakFlowPanel.innerHTML = '<div class="loading">Peak flow will appear once a student report is selected.</div>';
  studentEngineGrid.innerHTML = "";
  studentActivityGrid.innerHTML = "";
  studentReportList.innerHTML = "";
  studentTitle.textContent = "Choose a student";
  studentSummary.textContent = "This page stays scoped to one student's reports only.";
  studentSessionCount.textContent = "";
  studentPlanTitle.textContent = "What to work on next";
  studentPlanBody.textContent = "Choose a student to see the current coaching read.";
  studentSteps.innerHTML = "";
  studentSignatureLabel.textContent = "Student Persona";
  studentSignatureHeadline.textContent = "Choose a student";
  studentSignatureSupport.textContent = "Only this student's reports will be shown here.";
}

function renderStudentReportList() {
  if (!studentReports.length) {
    studentReportList.innerHTML = '<article class="report-card"><h3>No reports</h3><div class="report-meta">No uploads found for this student yet.</div></article>';
    return;
  }

  studentReportList.innerHTML = studentReports
    .map(
      (report) => `
        <article class="report-card ${report.id === activeStudentReportId ? "active" : ""}" data-student-report-id="${report.id}">
          <h3>${report.originalFileName}</h3>
          <div class="report-meta">${report.evaluation.primaryPersona.name}</div>
          <div class="report-meta">${report.evaluation.peakFlow.duration}</div>
        </article>
      `
    )
    .join("");

  studentReportList.querySelectorAll("[data-student-report-id]").forEach((card) => {
    card.addEventListener("click", () => {
      activeStudentReportId = card.dataset.studentReportId;
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("user", activeStudentName);
      nextUrl.searchParams.set("report", activeStudentReportId);
      window.history.replaceState({}, "", nextUrl);
      renderStudentReportList();
      renderStudentReport(studentReports.find((report) => report.id === activeStudentReportId));
    });
  });
}

function renderStudentSummary(report) {
  const items = [
    ["Primary persona", report.evaluation.primaryPersona.name],
    ["Time persona", report.evaluation.timePersona.label],
    ["Peak flow", report.evaluation.peakFlow.duration],
    ["Activity lead", report.evaluation.peakFlow.sessionName]
  ];

  studentSummaryStack.innerHTML = items
    .map(
      ([label, value]) => `
        <article class="summary-chip">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");
}

function renderStudentReport(report) {
  if (!report) {
    renderStudentEmptyState();
    return;
  }

  const { evaluation } = report;
  studentTitle.textContent = `${report.userName} · ${evaluation.primaryPersona.name}`;
  studentSummary.textContent = evaluation.summary;
  studentSessionCount.textContent = evaluation.reportCoverage?.summary || `${(evaluation.chartSessions || []).length || 1} session${((evaluation.chartSessions || []).length || 1) === 1 ? "" : "s"} visible in this read`;
  studentSignatureLabel.textContent = "Primary Persona";
  studentSignatureHeadline.textContent = evaluation.primaryPersona.name;
  studentSignatureSupport.textContent = evaluation.primaryPersona.summary;
  studentPlanTitle.textContent = evaluation.coaching.title;
  studentPlanBody.textContent = evaluation.coaching.body;
  studentSteps.innerHTML = evaluation.coaching.steps.map((item) => `<li>${item}</li>`).join("");

  renderStudentSummary(report);

  studentPersonaCard.innerHTML = `
    <div class="persona-heading">
      <div>
        <strong>${evaluation.primaryPersona.name}</strong>
        <div class="persona-angle">${evaluation.primaryPersona.angle}</div>
        <div class="persona-note">${evaluation.primaryPersona.summary}</div>
      </div>
      <span class="persona-chip">${evaluation.timePersona.label}</span>
    </div>
    <div class="persona-columns">
      <section>
        <h3>Why this fits</h3>
        <ul>${evaluation.primaryPersona.evidence.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section>
        <h3>What to protect</h3>
        <ul>${evaluation.coaching.steps.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
    </div>
  `;

  studentPeakFlowPanel.innerHTML = `
    <div class="flow-topline">
      <div>
        <div class="flow-badge">${evaluation.peakFlow.timePersona}</div>
        <h3>${evaluation.peakFlow.sessionName}</h3>
        <p>${evaluation.peakFlow.reading}</p>
      </div>
      <div>
        <div class="flow-duration">${evaluation.peakFlow.duration}</div>
        <div class="session-meta">${evaluation.peakFlow.window}</div>
      </div>
    </div>
  `;

  studentEngineGrid.innerHTML = evaluation.performanceEngine
    .map(
      (metric) => `
        <a class="engine-card clickable-card" href="${studentEvidenceLink(report.id, metric.id)}">
          <strong>${metric.label}: ${metric.score}</strong>
          <div class="engine-bar"><div class="engine-fill" style="width:${metric.width || "100%"}"></div></div>
          <div class="engine-caption">${metric.reading}</div>
          <div class="engine-link">Open evidence</div>
        </a>
      `
    )
    .join("");

  studentActivityGrid.innerHTML = (evaluation.activityBranches || [])
    .map(
      (branch) => `
        <a class="chart-session-card clickable-card" href="${studentActivityLink(report.id, branch.key)}">
          <strong>${branch.label}</strong>
          <div class="session-meta">${branch.bestWindow}</div>
          <p>${branch.summary}</p>
          <div class="engine-link">Open branch</div>
        </a>
      `
    )
    .join("");
}

async function loadStudentReports(userName) {
  const trimmed = (userName || "").trim();
  if (!trimmed) {
    renderStudentEmptyState("Login to load only your own reports.");
    return;
  }

  activeStudentName = trimmed;
  setStudentStatus("Loading student reports...");
  const response = await apiFetch(`/api/students/${encodeURIComponent(trimmed)}/reports`, { role: "student" });
  if (response.status === 401 || response.status === 403) {
    clearStudentSession();
    studentAppShell.hidden = true;
    window.location.href = "/login.html";
    return;
  }
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load student reports.");
  }

  studentReports = payload.reports || [];
  activeStudentReportId =
    studentReports.find((report) => report.id === activeStudentReportId)?.id ||
    studentReports[0]?.id ||
    "";

  renderStudentReportList();
  renderStudentReport(studentReports.find((report) => report.id === activeStudentReportId) || null);
  setStudentStatus(studentReports.length ? `Loaded ${studentReports.length} report${studentReports.length === 1 ? "" : "s"} for ${trimmed}.` : `No reports found for ${trimmed}.`, !studentReports.length);
}

studentLogoutButton.addEventListener("click", () => {
  clearStudentSession();
  activeStudentName = "";
  activeStudentReportId = "";
  studentAppShell.hidden = true;
  window.location.href = "/login.html";
});

if (activeStudentName) {
  studentAppShell.hidden = false;
  loadStudentReports(activeStudentName).catch((error) => {
    setStudentStatus(error.message, true);
    renderStudentEmptyState(error.message);
  });
} else {
  studentAppShell.hidden = true;
  window.location.href = "/login.html";
}
