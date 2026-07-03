const uploadForm = document.getElementById("upload-form");
const userNameInput = document.getElementById("user-name");
const reportFileInput = document.getElementById("report-file");
const formStatus = document.getElementById("form-status");
const reportList = document.getElementById("report-list");
const coachTitle = document.getElementById("coach-title");
const coachSummary = document.getElementById("coach-summary");
const personaCard = document.getElementById("persona-card");
const engineGrid = document.getElementById("engine-grid");
const modifierGrid = document.getElementById("modifier-grid");
const coachingSteps = document.getElementById("coaching-steps");

let reports = [];
let activeReportId = "";

function setStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.style.color = isError ? "#ff9c9c" : "";
}

function renderPersona(report) {
  if (!report) {
    coachTitle.textContent = "Choose a user to inspect";
    coachSummary.textContent =
      "Once a PDF is uploaded, the coach side will show the detected persona, the performance engine, and the supporting evidence from the report.";
    personaCard.className = "persona-card placeholder";
    personaCard.textContent = "No report selected yet.";
    engineGrid.innerHTML = "";
    modifierGrid.innerHTML = "";
    coachingSteps.innerHTML = "";
    return;
  }

  const { evaluation } = report;
  const { primaryPersona, performanceEngine, modifiers, coaching } = evaluation;

  coachTitle.textContent = `${report.userName} - ${primaryPersona.name}`;
  coachSummary.textContent = evaluation.summary;

  personaCard.className = "persona-card";
  personaCard.innerHTML = `
    <strong>${primaryPersona.name}</strong>
    <p>${primaryPersona.summary}</p>
    <ul class="coaching-steps">${primaryPersona.evidence.map((item) => `<li>${item}</li>`).join("")}</ul>
  `;

  engineGrid.innerHTML = performanceEngine
    .map(
      (metric) => `
        <article class="metric-card">
          <strong>${metric.label}: ${metric.score}</strong>
          <div class="metric-reading">${metric.reading}</div>
        </article>
      `
    )
    .join("");

  modifierGrid.innerHTML = modifiers
    .map(
      (modifier) => `
        <article class="modifier-card">
          <strong>${modifier.label}: ${modifier.value}</strong>
          <p>${modifier.note}</p>
        </article>
      `
    )
    .join("");

  coachingSteps.innerHTML = coaching.steps.map((item) => `<li>${item}</li>`).join("");
}

function renderReportList() {
  if (!reports.length) {
    reportList.innerHTML = '<article class="report-card"><h3>No reports yet</h3><div class="report-meta">Upload the first PDF to create a persona evaluation.</div></article>';
    return;
  }

  reportList.innerHTML = reports
    .map(
      (report) => `
        <article class="report-card ${activeReportId === report.id ? "active" : ""}" data-report-id="${report.id}">
          <h3>${report.userName}</h3>
          <div class="report-meta">${report.evaluation.primaryPersona.name}</div>
          <div class="report-meta">${report.originalFileName}</div>
          <div class="report-meta">${new Date(report.createdAt).toLocaleString()}</div>
        </article>
      `
    )
    .join("");

  reportList.querySelectorAll("[data-report-id]").forEach((card) => {
    card.addEventListener("click", () => {
      activeReportId = card.dataset.reportId;
      renderReportList();
      renderPersona(reports.find((item) => item.id === activeReportId));
    });
  });
}

async function loadReports() {
  const response = await fetch("/api/reports");
  const payload = await response.json();
  reports = payload.reports || [];
  activeReportId = reports[0]?.id || "";
  renderReportList();
  renderPersona(reports[0] || null);
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Uploading and evaluating report...");

  const formData = new FormData();
  formData.append("userName", userNameInput.value.trim());

  if (!reportFileInput.files[0]) {
    setStatus("Please choose a PDF report.", true);
    return;
  }

  formData.append("report", reportFileInput.files[0]);

  try {
    const response = await fetch("/api/reports/upload", {
      method: "POST",
      body: formData
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Upload failed.");
    }

    userNameInput.value = "";
    reportFileInput.value = "";
    setStatus("Report evaluated successfully.");
    await loadReports();
  } catch (error) {
    setStatus(error.message, true);
  }
});

loadReports().catch((error) => {
  setStatus(`Failed to load reports: ${error.message}`, true);
});
