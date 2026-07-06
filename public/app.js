const uploadForm = document.getElementById("upload-form");
const userNameInput = document.getElementById("user-name");
const reportFileInput = document.getElementById("report-file");
const reportFolderInput = document.getElementById("report-folder");
const formStatus = document.getElementById("form-status");
const reportList = document.getElementById("report-list");
const summaryStack = document.getElementById("summary-stack");
const personaCard = document.getElementById("persona-card");
const peakFlowPanel = document.getElementById("peak-flow-panel");
const engineGrid = document.getElementById("engine-grid");
const chartSessionGrid = document.getElementById("chart-session-grid");
const activityBranchGrid = document.getElementById("activity-branch-grid");
const modifierGrid = document.getElementById("modifier-grid");
const focusWellnessSummary = document.getElementById("focus-wellness-summary");
const timeSpentGrid = document.getElementById("time-spent-grid");
const coachTitle = document.getElementById("coach-title");
const coachSummary = document.getElementById("coach-summary");
const coachSessionCount = document.getElementById("coach-session-count");
const coachPlanTitle = document.getElementById("coach-plan-title");
const coachPlanBody = document.getElementById("coach-plan-body");
const coachingSteps = document.getElementById("coaching-steps");
const signatureLabel = document.getElementById("signature-label");
const signatureHeadline = document.getElementById("signature-headline");
const signatureSupport = document.getElementById("signature-support");
const adminLogoutButton = document.getElementById("admin-logout");
const adminCredentialsPanel = document.getElementById("students-panel");
const studentCredentialForm = document.getElementById("student-credential-form");
const credentialStudentName = document.getElementById("credential-student-name");
const credentialUsername = document.getElementById("credential-username");
const credentialPassword = document.getElementById("credential-password");
const credentialStatus = document.getElementById("credential-status");
const adminUserList = document.getElementById("admin-user-list");
const coachResourceForm = document.getElementById("coach-resource-form");
const coachResourceTypeInput = document.getElementById("coach-resource-type");
const coachResourceTitleInput = document.getElementById("coach-resource-title");
const coachResourceUrlInput = document.getElementById("coach-resource-url");
const coachResourceNotesInput = document.getElementById("coach-resource-notes");
const coachResourceStatus = document.getElementById("coach-resource-status");
const coachResourceList = document.getElementById("coach-resource-list");

let reports = [];
let activeReportId = "";

function buildPlainPersonaRead(evaluation) {
  const { primaryPersona, timePersona, extractedSignals, peakFlow } = evaluation;
  const speed = extractedSignals?.speed ?? 0;
  const agility = extractedSignals?.agility ?? 0;
  const endurance = extractedSignals?.endurance ?? 0;

  let styleRead = "balanced";
  if (agility >= speed + 5) {
    styleRead = "adaptive";
  } else if (speed >= agility + 5) {
    styleRead = "fast-activation";
  } else if (endurance >= speed && endurance >= agility) {
    styleRead = "steady";
  }

  const styleLine =
    styleRead === "adaptive"
      ? "This profile looks more adaptive than rigid, meaning the user can think, adjust, and keep the work moving once settled."
      : styleRead === "fast-activation"
        ? "This profile looks activation-led, meaning the user tends to rely on quick starts and fast engagement."
        : styleRead === "steady"
          ? "This profile looks steadier than explosive, meaning the user does better by holding quality over time."
          : "This profile looks balanced, meaning the user is not relying on only one mode of performance.";

  return {
    title: `${primaryPersona.name} in plain language`,
    body: `${primaryPersona.summary} ${styleLine}`,
    accent: `Best expressed around ${timePersona?.label || "mixed time windows"} with a repeatable flow window near ${peakFlow?.duration || "the detected peak duration"}.`
  };
}

function setStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.style.color = isError ? "#ff9c9c" : "";
}

function setCredentialStatus(message, isError = false) {
  credentialStatus.textContent = message;
  credentialStatus.style.color = isError ? "#ff9c9c" : "";
}

function setCoachResourceStatus(message, isError = false) {
  coachResourceStatus.textContent = message;
  coachResourceStatus.style.color = isError ? "#ff9c9c" : "";
}

function renderAdminUsers(users) {
  adminUserList.innerHTML = users.length
    ? users
        .map(
          (user) => `
            <article class="report-card">
              <h3>${user.studentName}</h3>
              <div class="report-meta">Username: ${user.username}</div>
              <div class="report-meta">Password: ${user.password}</div>
            </article>
          `
        )
        .join("")
    : '<article class="report-card"><h3>No student users yet</h3><div class="report-meta">Create the first student login above.</div></article>';
}

async function loadAdminUsers() {
  const response = await apiFetch("/api/admin/users");
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load student users.");
  }

  renderAdminUsers(payload.users || []);
  adminCredentialsPanel.hidden = false;
}

function renderEmptyState() {
  summaryStack.innerHTML = "";
  personaCard.innerHTML = '<div class="placeholder-card">No report selected yet.</div>';
  peakFlowPanel.innerHTML = '<div class="placeholder-card">Upload a PDF to read time persona and peak flow duration.</div>';
  engineGrid.innerHTML = "";
  chartSessionGrid.innerHTML = "";
  activityBranchGrid.innerHTML = "";
  modifierGrid.innerHTML = "";
  focusWellnessSummary.textContent = "";
  timeSpentGrid.innerHTML = "";
  signatureLabel.textContent = "Time Signature";
  signatureHeadline.textContent = "Upload a report";
  signatureSupport.textContent = "The app will detect the strongest time persona and peak flow duration.";
  coachTitle.textContent = "Choose a report to inspect";
  coachSummary.textContent =
    "The coach side will show the strongest persona, the time-based version of that persona, and the peak flow duration pulled from the report chart.";
  coachSessionCount.textContent = "";
  coachPlanTitle.textContent = "How to coach this user";
  coachPlanBody.textContent = "Upload or select a report to see the coaching plan.";
  coachingSteps.innerHTML = "";
  coachResourceList.innerHTML = '<article class="modifier-card"><strong>No student selected</strong><p>Select a report to assign resources.</p></article>';
  setCoachResourceStatus("");
}

function renderCoachResources(resources = []) {
  coachResourceList.innerHTML = resources.length
    ? resources
        .map(
          (resource) => `
            <article class="modifier-card">
              <strong>${resource.type}: ${resource.title}</strong>
              <p>${resource.notes || "Coach-assigned support item."}</p>
              ${resource.url ? `<a class="engine-link" href="${resource.url}" target="_blank" rel="noreferrer">Open resource</a>` : ""}
            </article>
          `
        )
        .join("")
    : '<article class="modifier-card"><strong>No suggestions yet</strong><p>Assign audio, video, or an activity for this student.</p></article>';
}

async function loadCoachResources(userName) {
  if (!userName) {
    renderCoachResources([]);
    return;
  }

  const response = await apiFetch(`/api/students/${encodeURIComponent(userName)}/resources`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load coach resources.");
  }

  renderCoachResources(payload.resources || []);
}

function buildEvidenceLink(reportId, metricKey) {
  return `/evidence.html?report=${encodeURIComponent(reportId)}&metric=${encodeURIComponent(metricKey)}`;
}

function buildActivityLink(reportId, activityKey) {
  return `/activity.html?report=${encodeURIComponent(reportId)}&activity=${encodeURIComponent(activityKey)}`;
}

function buildStudentLink(userName, reportId) {
  return `/student.html?user=${encodeURIComponent(userName)}&report=${encodeURIComponent(reportId)}`;
}

function renderSummary(report) {
  const { evaluation } = report;
  const items = [
    ["Primary persona", evaluation.primaryPersona.name],
    ["Activity persona", evaluation.activityPersona?.label || "Pending"],
    ["Time persona", evaluation.timePersona?.label || "Mixed"],
    ["Peak flow duration", evaluation.peakFlow?.duration || "Unknown"],
    ["Peak flow window", evaluation.peakFlow?.window || evaluation.timePersona?.window || "Unknown"]
  ];

  summaryStack.innerHTML = items
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

function renderPersona(report) {
  const { evaluation } = report;
  const { primaryPersona, timePersona, activityPersona } = evaluation;
  const consumerRead = buildPlainPersonaRead(evaluation);

  coachTitle.textContent = `${report.userName} - ${primaryPersona.name}`;
  coachSummary.textContent = evaluation.summary;
  coachSessionCount.textContent = evaluation.reportCoverage?.summary || `${(evaluation.chartSessions || []).length || 1} session${((evaluation.chartSessions || []).length || 1) === 1 ? "" : "s"} visible in this read`;
  signatureLabel.textContent = "Primary Persona";
  signatureHeadline.textContent = primaryPersona.name;
  signatureSupport.textContent = `${primaryPersona.summary} Strongest time read: ${timePersona?.label || "Mixed"}.`;

  personaCard.innerHTML = `
    <div class="persona-heading">
      <div>
        <strong>${primaryPersona.name}</strong>
        <div class="persona-angle">${primaryPersona.angle}</div>
        <div class="persona-note">${primaryPersona.summary}</div>
      </div>
      <span class="persona-chip">${timePersona?.label || "Time persona"}</span>
    </div>
    <section class="persona-translation">
      <p class="panel-label">What this means</p>
      <h3>${consumerRead.title}</h3>
      <p>${consumerRead.body}</p>
      <p class="persona-translation-accent">${consumerRead.accent}</p>
    </section>
    <div class="persona-columns">
      <section>
        <h3>Why this persona</h3>
        <ul>${primaryPersona.evidence.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section>
        <h3>Activity persona</h3>
        <p><strong>${activityPersona?.label || "Pending"}</strong> ${activityPersona?.summary || "No activity persona could be formed yet."}</p>
        <ul>${(activityPersona?.evidence || []).map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section>
        <h3>Time-based read</h3>
        <p>${timePersona?.summary || "No specific time persona could be isolated from this report."}</p>
        <ul>${(timePersona?.evidence || []).map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
    </div>
  `;
}

function renderPeakFlow(report) {
  const { peakFlow } = report.evaluation;

  peakFlowPanel.innerHTML = `
    <div class="flow-topline">
      <div>
        <div class="flow-badge">${peakFlow.timePersona}</div>
        <h3>${peakFlow.sessionName}</h3>
        <p>${peakFlow.reading}</p>
        <div class="session-meta">${peakFlow.basis || "Detected flow basis"}</div>
      </div>
      <div>
        <div class="flow-duration">${peakFlow.duration}</div>
        <div class="session-meta">${peakFlow.window}</div>
      </div>
    </div>
  `;
}

function renderEngine(report) {
  engineGrid.innerHTML = report.evaluation.performanceEngine
    .map(
      (metric) => `
        <a class="engine-card clickable-card" href="${buildEvidenceLink(report.id, metric.id)}">
          <strong>${metric.label}: ${metric.score}</strong>
          <div class="engine-bar"><div class="engine-fill" style="width:${metric.width || "100%"}"></div></div>
          <div class="engine-caption">${metric.reading}</div>
          <div class="engine-link">Open evidence</div>
        </a>
      `
    )
    .join("");
}

function renderChartSessions(report) {
  const sessions = report.evaluation.chartSessions || [];
  if (!sessions.length) {
    chartSessionGrid.innerHTML = '<article class="chart-session-card"><strong>No chart sessions parsed</strong><p>The uploaded report did not expose a chart structure cleanly enough yet.</p></article>';
    return;
  }

  chartSessionGrid.innerHTML = sessions
    .map(
      (session) => `
        <article class="chart-session-card">
          <strong>${session.name}</strong>
          <div class="session-meta">${session.time} · ${session.duration}</div>
          <p>${session.timePersona} · Speed ${session.speed} · Agility ${session.agility} · Endurance ${session.endurance}</p>
        </article>
      `
    )
    .join("");
}

function renderModifiers(report) {
  modifierGrid.innerHTML = report.evaluation.modifiers
    .map(
      (modifier) => `
        <article class="modifier-card">
          <strong>${modifier.label}: ${modifier.value}</strong>
          <p>${modifier.note}</p>
        </article>
      `
    )
    .join("");
}

function renderActivityBranches(report) {
  const branches = report.evaluation.activityBranches || [];
  if (!branches.length) {
    activityBranchGrid.innerHTML = '<article class="chart-session-card"><strong>No activity branches yet</strong><p>The report did not expose enough named activities to compare.</p></article>';
    return;
  }

  activityBranchGrid.innerHTML = branches
    .map(
      (branch) => `
        <a class="chart-session-card clickable-card" href="${buildActivityLink(report.id, branch.key)}">
          <strong>${branch.label}</strong>
          <div class="session-meta">${branch.sessions} session${branch.sessions === 1 ? "" : "s"} · ${branch.bestWindow}</div>
          <p>${branch.summary}</p>
          <div class="engine-link">Open branch</div>
        </a>
      `
    )
    .join("");
}

function renderFocusWellness(report) {
  const impact = report.evaluation.focusWellnessImpact;
  if (!impact) {
    focusWellnessSummary.textContent = "No focus or wellness split could be read from this report yet.";
    timeSpentGrid.innerHTML = "";
    return;
  }

  focusWellnessSummary.textContent = impact.impactSummary;
  timeSpentGrid.innerHTML = impact.timeSpent
    .map(
      (item) => `
        <article class="modifier-card">
          <strong>${item.label}: ${item.value}</strong>
          <p>${item.note}</p>
        </article>
      `
    )
    .join("");
}

function renderCoaching(report) {
  const { coaching } = report.evaluation;
  coachPlanTitle.textContent = coaching.title;
  coachPlanBody.textContent = coaching.body;
  coachingSteps.innerHTML = coaching.steps.map((item) => `<li>${item}</li>`).join("");
}

function renderReport(report) {
  if (!report) {
    renderEmptyState();
    return;
  }

  stopOrbCycle();
  renderSummary(report);
  renderPersona(report);
  renderPeakFlow(report);
  renderEngine(report);
  renderChartSessions(report);
  renderActivityBranches(report);
  renderModifiers(report);
  renderFocusWellness(report);
  renderCoaching(report);
  loadCoachResources(report.userName).catch((error) => {
    setCoachResourceStatus(error.message, true);
    renderCoachResources([]);
  });
}

function renderReportList() {
  if (!reports.length) {
    reportList.innerHTML =
      '<article class="report-card"><h3>No reports yet</h3><div class="report-meta">Upload the first PDF to create a time-based persona evaluation.</div></article>';
    return;
  }

  reportList.innerHTML = reports
    .map(
      (report) => `
        <article class="report-card ${activeReportId === report.id ? "active" : ""}" data-report-id="${report.id}">
          <h3>${report.userName}</h3>
          <div class="report-meta">${report.evaluation.primaryPersona.name}</div>
          <div class="report-meta">${report.evaluation.timePersona?.label || "Time persona pending"}</div>
          <div class="report-meta">${report.evaluation.peakFlow?.duration || "No peak flow"}</div>
          <a class="engine-link report-link" href="${buildStudentLink(report.userName, report.id)}">Open student page</a>
        </article>
      `
    )
    .join("");

  reportList.querySelectorAll("[data-report-id]").forEach((card) => {
    card.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (event) => event.stopPropagation());
    });
    card.addEventListener("click", () => {
      activeReportId = card.dataset.reportId;
      renderReportList();
      renderReport(reports.find((item) => item.id === activeReportId));
    });
  });
}

async function loadReports() {
  const response = await apiFetch("/api/reports");
  if (response.status === 401) {
    clearAdminToken();
    window.location.href = "/login.html";
    return;
  }
  const payload = await response.json();
  reports = payload.reports || [];
  activeReportId = reports[0]?.id || "";
  renderReportList();
  renderReport(reports[0] || null);
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Uploading and reading reports...");

  const formData = new FormData();
  formData.append("userName", userNameInput.value.trim());
  const pickedFiles = [...Array.from(reportFileInput.files || []), ...Array.from(reportFolderInput.files || [])];

  if (!pickedFiles.length) {
    setStatus("Please choose one or more PDF reports.", true);
    return;
  }

  pickedFiles.forEach((file) => {
    formData.append("reports", file);
  });

  try {
    const response = await apiFetch("/api/reports/upload", {
      method: "POST",
      body: formData
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Upload failed.");
    }

    userNameInput.value = "";
    reportFileInput.value = "";
    reportFolderInput.value = "";
    const createdCount = payload.count || payload.reports?.length || 0;
    setStatus(`${createdCount} report${createdCount === 1 ? "" : "s"} evaluated successfully.`);
    await loadReports();
  } catch (error) {
    setStatus(error.message, true);
  }
});

adminLogoutButton.addEventListener("click", () => {
  clearAdminToken();
  window.location.href = "/login.html";
});

studentCredentialForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setCredentialStatus("Saving student login...");

  const response = await apiFetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentName: credentialStudentName.value.trim(),
      username: credentialUsername.value.trim(),
      password: credentialPassword.value.trim()
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    setCredentialStatus(payload.error || "Could not save student login.", true);
    return;
  }

  credentialStudentName.value = "";
  credentialUsername.value = "";
  credentialPassword.value = "";
  setCredentialStatus("Student login saved.");
  renderAdminUsers(payload.users || []);
});

coachResourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const activeReport = reports.find((item) => item.id === activeReportId);
  if (!activeReport) {
    setCoachResourceStatus("Choose a student report first.", true);
    return;
  }

  setCoachResourceStatus("Assigning resource...");
  const response = await apiFetch(`/api/admin/students/${encodeURIComponent(activeReport.userName)}/resources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: coachResourceTypeInput.value.trim(),
      title: coachResourceTitleInput.value.trim(),
      url: coachResourceUrlInput.value.trim(),
      notes: coachResourceNotesInput.value.trim()
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    setCoachResourceStatus(payload.error || "Could not assign resource.", true);
    return;
  }

  coachResourceTypeInput.value = "";
  coachResourceTitleInput.value = "";
  coachResourceUrlInput.value = "";
  coachResourceNotesInput.value = "";
  setCoachResourceStatus("Resource assigned.");
  renderCoachResources(payload.resources || []);
});

const ORB_PERSONAS = [
  { label: "Persona Detected", headline: "Speed Reactor", support: "Explosive activation and fast-start outputs define this pattern across sessions." },
  { label: "Persona Detected", headline: "Endurance Anchor", support: "Steady, high-quality output sustained across long flow windows." },
  { label: "Persona Detected", headline: "Adaptive Thinker", support: "Reads the environment mid-session and adjusts without losing momentum." },
  { label: "Persona Detected", headline: "Flow Keeper", support: "Maintains a consistent rhythm with peak output concentrated in one window." },
  { label: "Persona Detected", headline: "Agility Driver", support: "Rapid context-switching with short, high-intensity bursts across activities." },
  { label: "Persona Detected", headline: "Deep Processor", support: "Long ramp-up before peak, but output quality exceeds average once settled." }
];

let orbCycleTimer = null;
let orbCycleIndex = 0;
let orbCycling = false;

function setOrbContent(label, headline, support) {
  signatureLabel.textContent = label;
  signatureHeadline.textContent = headline;
  signatureSupport.textContent = support;
}

function fadeOrbTo(label, headline, support) {
  const els = [signatureLabel, signatureHeadline, signatureSupport];
  els.forEach((el) => { el.style.opacity = "0"; });
  setTimeout(() => {
    setOrbContent(label, headline, support);
    els.forEach((el) => { el.style.opacity = "1"; });
  }, 580);
}

function startOrbCycle() {
  if (orbCycling) return;
  orbCycling = true;
  orbCycleIndex = 0;
  fadeOrbTo(ORB_PERSONAS[0].label, ORB_PERSONAS[0].headline, ORB_PERSONAS[0].support);
  orbCycleTimer = setInterval(() => {
    orbCycleIndex = (orbCycleIndex + 1) % ORB_PERSONAS.length;
    const p = ORB_PERSONAS[orbCycleIndex];
    fadeOrbTo(p.label, p.headline, p.support);
  }, 3200);
}

function stopOrbCycle() {
  if (orbCycleTimer) {
    clearInterval(orbCycleTimer);
    orbCycleTimer = null;
  }
  orbCycling = false;
  const els = [signatureLabel, signatureHeadline, signatureSupport];
  els.forEach((el) => { el.style.opacity = "1"; });
}

loadReports().catch((error) => {
  setStatus(`Failed to load reports: ${error.message}`, true);
  renderEmptyState();
});

loadAdminUsers().catch(() => {
  renderAdminUsers([]);
});

startOrbCycle();
