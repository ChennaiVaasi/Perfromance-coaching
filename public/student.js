const studentParams = new URLSearchParams(window.location.search);

const studentAppShell = document.getElementById("student-app-shell");
const studentTabShell = document.getElementById("student-tab-shell");
const studentLogoutButton = document.getElementById("student-logout");
const studentStatus = document.getElementById("student-status");
const studentUploadForm = document.getElementById("student-upload-form");
const studentReportFileInput = document.getElementById("student-report-file");
const studentReportFolderInput = document.getElementById("student-report-folder");
const studentUploadStatus = document.getElementById("student-upload-status");
const studentSummaryStack = document.getElementById("student-summary-stack");
const studentTitle = document.getElementById("student-title");
const studentSummary = document.getElementById("student-summary");
const studentSessionCount = document.getElementById("student-session-count");
const studentPersonaCard = document.getElementById("student-persona-card");
const studentPeakFlowPanel = document.getElementById("student-peak-flow-panel");
const studentEngineGrid = document.getElementById("student-engine-grid");
const studentActivityGrid = document.getElementById("student-activity-grid");
const studentActivitySummary = document.getElementById("student-activity-summary");
const studentComparisonGrid = document.getElementById("student-comparison-grid");
const studentPlanTitle = document.getElementById("student-plan-title");
const studentPlanBody = document.getElementById("student-plan-body");
const studentSteps = document.getElementById("student-steps");
const studentReportList = document.getElementById("student-report-list");
const studentSignatureLabel = document.getElementById("student-signature-label");
const studentSignatureHeadline = document.getElementById("student-signature-headline");
const studentSignatureSupport = document.getElementById("student-signature-support");
const studentResourceList = document.getElementById("student-resource-list");
const studentTabButtons = document.querySelectorAll("[data-student-tab]");
const studentTabPanels = document.querySelectorAll("[data-student-panel]");

let studentReports = [];
let studentResources = [];
let activeStudentReportId = studentParams.get("report") || "";
let activeStudentName = getStudentName() || "";
let activeStudentTab = "persona";

function setStudentStatus(message, isError = false) {
  studentStatus.textContent = message;
  studentStatus.style.color = isError ? "#ff9c9c" : "";
}

function setStudentUploadStatus(message, isError = false) {
  studentUploadStatus.textContent = message;
  studentUploadStatus.style.color = isError ? "#ff9c9c" : "";
}

function studentActivityLink(reportId, activityKey) {
  return `/activity.html?report=${encodeURIComponent(reportId)}&activity=${encodeURIComponent(activityKey)}`;
}

function activateStudentTab(tabName) {
  activeStudentTab = tabName;
  studentTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.studentTab === tabName);
  });
  studentTabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.studentPanel === tabName);
  });
}

function parseDurationToSeconds(value) {
  const match = String(value || "").match(/(?:(\d+)h\s*)?(\d+)m\s*(\d+)s/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function renderStudentResources() {
  studentResourceList.innerHTML = studentResources.length
    ? studentResources
        .map(
          (resource) => `
            <article class="modifier-card">
              <strong>${resource.type}: ${resource.title}</strong>
              <p>${resource.notes || "Coach-assigned resource."}</p>
              ${resource.url ? `<a class="engine-link" href="${resource.url}" target="_blank" rel="noreferrer">Open resource</a>` : ""}
            </article>
          `
        )
        .join("")
    : '<article class="modifier-card"><strong>No suggestions yet</strong><p>Your coach has not assigned audio, video, or activity resources yet.</p></article>';
}

function renderStudentEmptyState(message = "Choose a student to load their reports.") {
  studentSummaryStack.innerHTML = "";
  studentPersonaCard.innerHTML = `<div class="loading">${message}</div>`;
  studentPeakFlowPanel.innerHTML = '<div class="loading">Peak flow will appear once a report is selected.</div>';
  studentEngineGrid.innerHTML = "";
  studentActivityGrid.innerHTML = "";
  studentComparisonGrid.innerHTML = "";
  studentReportList.innerHTML = "";
  studentResourceList.innerHTML = "";
  studentTitle.textContent = "Choose a report";
  studentSummary.textContent = "This page stays scoped to your own reports only.";
  studentSessionCount.textContent = "";
  studentActivitySummary.textContent = "Choose a report to compare flow and endurance against your own history.";
  studentPlanTitle.textContent = "What to work on next";
  studentPlanBody.textContent = "Coach suggestions and assigned resources will appear here.";
  studentSteps.innerHTML = "";
  studentSignatureLabel.textContent = "Student Persona";
  studentSignatureHeadline.textContent = "Choose a report";
  studentSignatureSupport.textContent = "Upload or choose a report to see your strongest persona.";
}

function renderStudentReportList() {
  if (!studentReports.length) {
    studentReportList.innerHTML = '<article class="report-card"><h3>No reports</h3><div class="report-meta">Upload your first report to start the history.</div></article>';
    return;
  }

  studentReportList.innerHTML = studentReports
    .map(
      (report) => `
        <article class="report-card ${report.id === activeStudentReportId ? "active" : ""}" data-student-report-id="${report.id}">
          <h3>${report.originalFileName}</h3>
          <div class="report-meta">${report.evaluation.primaryPersona.name}</div>
          <div class="report-meta">${report.evaluation.timePersona.label}</div>
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
    ["Persona Plus", report.evaluation.primaryPersona.name],
    ["Thinking style", report.evaluation.activityPersona?.label || report.evaluation.primaryPersona.name],
    ["Time flow", report.evaluation.timePersona.label],
    ["Peak flow", report.evaluation.peakFlow.duration],
    ["Endurance", report.evaluation.extractedSignals.endurance]
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

function renderStudentComparison(report) {
  const comparison = report.historyComparison || {};
  const flowPercentile = comparison.flowPercentile ?? null;
  const endurancePercentile = comparison.endurancePercentile ?? null;
  const reportCount = comparison.reportCount || studentReports.length;
  const flowBasis = report.evaluation.peakFlow.peakValue || report.evaluation.peakFlow.duration;

  studentActivitySummary.textContent =
    reportCount > 1
      ? `This report is being compared against ${reportCount - 1} older report${reportCount - 1 === 1 ? "" : "s"} from your own history.`
      : "Upload more reports to see a proper percentile comparison across your own history.";

  studentComparisonGrid.innerHTML = `
    <article class="summary-chip">
      <span>Peak flow percentile</span>
      <strong>${flowPercentile === null ? "Pending" : `${flowPercentile}th`}</strong>
      <div class="report-meta">Current peak: ${flowBasis}</div>
    </article>
    <article class="summary-chip">
      <span>Endurance percentile</span>
      <strong>${endurancePercentile === null ? "Pending" : `${endurancePercentile}th`}</strong>
      <div class="report-meta">Current endurance: ${report.evaluation.extractedSignals.endurance}</div>
    </article>
    <article class="summary-chip">
      <span>Flow vs average</span>
      <strong>${report.evaluation.metricEvidence["peak-flow"]?.averageValue || "No average found"}</strong>
      <div class="report-meta">Peak signal is ${flowBasis}</div>
    </article>
  `;
}

function renderStudentReport(report) {
  if (!report) {
    renderStudentEmptyState();
    return;
  }

  const { evaluation } = report;
  studentTitle.textContent = `${report.userName} · ${evaluation.primaryPersona.name}`;
  studentSummary.textContent = evaluation.summary;
  studentSessionCount.textContent = evaluation.reportCoverage?.summary || `${(evaluation.chartSessions || []).length || 1} visible session read`;
  studentSignatureLabel.textContent = "Persona Plus";
  studentSignatureHeadline.textContent = evaluation.primaryPersona.name;
  studentSignatureSupport.textContent = `${evaluation.activityPersona?.label || evaluation.primaryPersona.name} · ${evaluation.timePersona.label} · Peak flow ${evaluation.peakFlow.duration}`;
  studentPlanTitle.textContent = evaluation.coaching.title;
  studentPlanBody.textContent = evaluation.coaching.body;
  studentSteps.innerHTML = evaluation.coaching.steps.map((item) => `<li>${item}</li>`).join("");

  renderStudentSummary(report);
  renderStudentComparison(report);

  studentPersonaCard.innerHTML = `
    <div class="persona-heading">
      <div>
        <strong>${evaluation.primaryPersona.name}</strong>
        <div class="persona-angle">${evaluation.activityPersona?.label || "Thinking read"} · ${evaluation.timePersona.label}</div>
        <div class="persona-note">${evaluation.primaryPersona.summary}</div>
      </div>
      <span class="persona-chip">${evaluation.timePersona.label}</span>
    </div>
    <div class="persona-columns persona-columns-triple">
      <section>
        <h3>Intuitive / analytical / balanced</h3>
        <p><strong>${evaluation.primaryPersona.name}</strong> is the top read from this report.</p>
        <ul>${evaluation.primaryPersona.evidence.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section>
        <h3>Time-based flow</h3>
        <p>${evaluation.timePersona.summary}</p>
        <ul>${evaluation.timePersona.evidence.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section>
        <h3>Endurance and flow</h3>
        <p>Endurance is ${evaluation.extractedSignals.endurance} and peak flow is ${evaluation.peakFlow.duration} in this report.</p>
        <ul>
          <li>${evaluation.metricEvidence.endurance.explanation}</li>
          <li>${evaluation.peakFlow.reading}</li>
          <li>${evaluation.metricEvidence["peak-flow"]?.comparedTo || "No average comparison found."}</li>
        </ul>
      </section>
    </div>
  `;

  studentEngineGrid.innerHTML = evaluation.performanceEngine
    .map(
      (metric) => `
        <article class="engine-card">
          <strong>${metric.label}: ${metric.score}</strong>
          <div class="engine-bar"><div class="engine-fill" style="width:${metric.width || "100%"}"></div></div>
          <div class="engine-caption">${metric.reading}</div>
        </article>
      `
    )
    .join("");

  studentPeakFlowPanel.innerHTML = `
    <div class="flow-topline">
      <div>
        <div class="flow-badge">${evaluation.timePersona.label}</div>
        <h3>${evaluation.peakFlow.sessionName}</h3>
        <p>${evaluation.peakFlow.reading}</p>
      </div>
      <div>
        <div class="flow-duration">${evaluation.peakFlow.duration}</div>
        <div class="session-meta">${evaluation.peakFlow.window}</div>
      </div>
    </div>
  `;

  studentActivityGrid.innerHTML = (evaluation.activityBranches || [])
    .map(
      (branch) => `
        <a class="chart-session-card clickable-card" href="${studentActivityLink(report.id, branch.key)}">
          <strong>${branch.label}</strong>
          <div class="session-meta">${branch.persona?.name || "Activity persona"} · ${branch.bestWindow}</div>
          <p>${branch.summary}</p>
          <div class="engine-link">Open branch</div>
        </a>
      `
    )
    .join("");
}

async function loadStudentResources(userName) {
  const response = await apiFetch(`/api/students/${encodeURIComponent(userName)}/resources`, { role: "student" });
  if (response.status === 401 || response.status === 403) {
    clearStudentSession();
    studentAppShell.hidden = true;
    studentTabShell.hidden = true;
    window.location.href = "/login.html";
    return;
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load student resources.");
  }

  studentResources = payload.resources || [];
  renderStudentResources();
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
    studentTabShell.hidden = true;
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

studentTabButtons.forEach((button) => {
  button.addEventListener("click", () => activateStudentTab(button.dataset.studentTab));
});

studentUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = [...Array.from(studentReportFileInput.files || []), ...Array.from(studentReportFolderInput.files || [])];
  if (!files.length) {
    setStudentUploadStatus("Choose one or more PDF reports first.", true);
    return;
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("reports", file));
  setStudentUploadStatus("Uploading your reports...");

  const response = await apiFetch("/api/student/reports/upload", {
    method: "POST",
    body: formData,
    role: "student"
  });

  const payload = await response.json();
  if (!response.ok) {
    setStudentUploadStatus(payload.error || "Upload failed.", true);
    return;
  }

  studentReportFileInput.value = "";
  studentReportFolderInput.value = "";
  setStudentUploadStatus(`${payload.count || 0} report${payload.count === 1 ? "" : "s"} uploaded and evaluated.`);
  await loadStudentReports(activeStudentName);
});

studentLogoutButton.addEventListener("click", () => {
  clearStudentSession();
  activeStudentName = "";
  activeStudentReportId = "";
  studentAppShell.hidden = true;
  studentTabShell.hidden = true;
  window.location.href = "/login.html";
});

if (activeStudentName) {
  studentAppShell.hidden = false;
  studentTabShell.hidden = false;
  activateStudentTab(activeStudentTab);
  Promise.all([loadStudentReports(activeStudentName), loadStudentResources(activeStudentName)]).catch((error) => {
    setStudentStatus(error.message, true);
    renderStudentEmptyState(error.message);
  });
} else {
  studentAppShell.hidden = true;
  studentTabShell.hidden = true;
  window.location.href = "/login.html";
}
