const studentParams = new URLSearchParams(window.location.search);

function timeWindow(pattern) {
  if (!pattern) return pattern;
  if (pattern === "Morning Settler") return "Before 11 AM";
  if (pattern === "Midday Driver") return "11 AM – 4 PM";
  if (pattern === "Evening Spark") return "4 PM onwards";
  return pattern;
}

const studentAppShell = document.getElementById("student-app-shell");
const studentTabShell = document.getElementById("student-tab-shell");
const studentLogoutButton = document.getElementById("student-logout");
const studentBackLink = document.getElementById("student-back-to-coach");
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

const isAdminViewing = !!getAdminToken() && !getStudentToken();
const studentRole = isAdminViewing ? "admin" : "student";

let studentReports = [];
let studentResources = [];
let activeStudentReportId = studentParams.get("report") || "";
let activeStudentName = isAdminViewing
  ? (studentParams.get("user") || "").trim()
  : getStudentName() || "";
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
  studentPeakFlowPanel.innerHTML = '<div class="loading">Complete student profile will appear once reports are uploaded.</div>';
  studentEngineGrid.innerHTML = "";
  studentActivityGrid.innerHTML = "";
  studentComparisonGrid.innerHTML = "";
  studentReportList.innerHTML = "";
  studentResourceList.innerHTML = "";
  studentTitle.textContent = "Your Reports";
  studentSummary.textContent = "This page shows your complete student profile built from your full report history.";
  studentSessionCount.textContent = "";
  studentActivitySummary.textContent = "Upload reports to see your activity history and comparisons.";
  studentPlanTitle.textContent = "What to work on next";
  studentPlanBody.textContent = "Coach suggestions and assigned resources will appear here.";
  studentSteps.innerHTML = "";
  studentSignatureLabel.textContent = "Student Persona";
  studentSignatureHeadline.textContent = "Upload a report";
  studentSignatureSupport.textContent = "Upload your reports to see your complete student profile.";
}

function renderStudentReportList() {
  if (!studentReports.length) {
    studentReportList.innerHTML = '<article class="report-card"><h3>No reports</h3><div class="report-meta">Upload your first report to start the history.</div></article>';
    return;
  }

  const reportMetrics = studentReports.map((r) => ({
    id: r.id,
    flowSecs: parseDurationToSeconds(r.evaluation?.peakFlow?.peakValue || r.evaluation?.peakFlow?.duration),
    endurance: Number(r.evaluation?.extractedSignals?.endurance) || 0,
    flowLabel: r.evaluation?.peakFlow?.duration || "—"
  }));

  const peakFlow = Math.max(...reportMetrics.map((m) => m.flowSecs), 1);
  const peakEndurance = Math.max(...reportMetrics.map((m) => m.endurance), 1);

  const sortedByFlow = [...reportMetrics].sort((a, b) => b.flowSecs - a.flowSecs);
  const sortedByEndurance = [...reportMetrics].sort((a, b) => b.endurance - a.endurance);

  const flowRankMap = Object.fromEntries(sortedByFlow.map((m, i) => [m.id, i + 1]));
  const enduranceRankMap = Object.fromEntries(sortedByEndurance.map((m, i) => [m.id, i + 1]));

  studentReportList.innerHTML = studentReports
    .map((report) => {
      const m = reportMetrics.find((x) => x.id === report.id);
      const flowPct = peakFlow > 0 ? Math.round((m.flowSecs / peakFlow) * 100) : 0;
      const endPct = peakEndurance > 0 ? Math.round((m.endurance / peakEndurance) * 100) : 0;
      const flowRank = flowRankMap[report.id];
      const endRank = enduranceRankMap[report.id];
      const total = studentReports.length;

      return `
        <article class="report-card ${report.id === activeStudentReportId ? "active" : ""}" data-student-report-id="${report.id}">
          <h3>${report.originalFileName}</h3>
          <div class="report-meta">${new Date(report.createdAt).toLocaleDateString()} · ${timeWindow(report.evaluation.timePersona.label)}</div>
          <div class="report-rank-grid">
            <div class="rank-row">
              <div class="rank-labels">
                <span class="rank-name peak-flow-text">Peak Flow</span>
                <span class="rank-badge">#${flowRank} of ${total}</span>
                <span class="rank-pct peak-flow-text">${flowPct}%</span>
              </div>
              <div class="rank-bar-track">
                <div class="rank-bar-fill peak-flow-bar" style="width:${flowPct}%"></div>
              </div>
              <div class="rank-value">${m.flowLabel}</div>
            </div>
            <div class="rank-row">
              <div class="rank-labels">
                <span class="rank-name peak-endurance-text">Endurance</span>
                <span class="rank-badge">#${endRank} of ${total}</span>
                <span class="rank-pct peak-endurance-text">${endPct}%</span>
              </div>
              <div class="rank-bar-track">
                <div class="rank-bar-fill peak-endurance-bar" style="width:${endPct}%"></div>
              </div>
              <div class="rank-value">${m.endurance || "—"}</div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  studentReportList.querySelectorAll("[data-student-report-id]").forEach((card) => {
    card.addEventListener("click", () => {
      activeStudentReportId = card.dataset.studentReportId;
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("user", activeStudentName);
      nextUrl.searchParams.set("report", activeStudentReportId);
      window.history.replaceState({}, "", nextUrl);
      renderStudentReportList();
    });
  });
}

function renderStudentComparison() {
  const reportCount = studentReports.length;

  studentActivitySummary.textContent =
    reportCount > 1
      ? `Your complete history covers ${reportCount} report${reportCount === 1 ? "" : "s"}. The comparison below reflects performance across the full history.`
      : "Upload more reports to see a comparison across your own history.";

  const flowValues = studentReports
    .map((r) => {
      const dur = r.evaluation?.peakFlow?.peakValue || r.evaluation?.peakFlow?.duration;
      return dur ? parseDurationToSeconds(dur) : 0;
    })
    .filter((v) => v > 0);

  const enduranceValues = studentReports
    .map((r) => Number(r.evaluation?.extractedSignals?.endurance) || 0)
    .filter((v) => v > 0);

  const bestFlow = flowValues.length ? Math.max(...flowValues) : null;
  const avgEndurance = enduranceValues.length
    ? Math.round(enduranceValues.reduce((s, v) => s + v, 0) / enduranceValues.length * 10) / 10
    : null;
  const peakEndurance = enduranceValues.length ? Math.max(...enduranceValues) : null;

  function formatSecs(secs) {
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, "0");
    return `${m}m ${s}s`;
  }

  studentComparisonGrid.innerHTML = `
    <article class="summary-chip peak-flow">
      <span>Best historical peak flow</span>
      <strong>${bestFlow ? formatSecs(bestFlow) : "Pending"}</strong>
      <div class="report-meta">Across ${reportCount} report${reportCount === 1 ? "" : "s"}</div>
    </article>
    <article class="summary-chip">
      <span>Average endurance</span>
      <strong>${avgEndurance !== null ? avgEndurance : "Pending"}</strong>
      <div class="report-meta">Across full history</div>
    </article>
    <article class="summary-chip peak-endurance">
      <span>Peak endurance</span>
      <strong>${peakEndurance !== null ? peakEndurance : "Pending"}</strong>
      <div class="report-meta">Best single report</div>
    </article>
  `;
}

function renderStudentProfilePersona(profile) {
  startRealStudentOrbCycle(profile);

  studentTitle.textContent = `${activeStudentName} — Complete Student Profile`;
  studentSummary.textContent = `Whole-student persona: ${profile.wholeUserPersona.name}. Built from ${profile.reportCount} report${profile.reportCount === 1 ? "" : "s"}.`;
  studentSessionCount.textContent = `Full history · ${profile.reportCount} report${profile.reportCount === 1 ? "" : "s"} · Dominant time pattern: ${timeWindow(profile.dominantTimePattern)}`;

  const summaryItems = [
    ["Whole-student persona", profile.wholeUserPersona.name],
    ["Playing persona", profile.playingPersona ? profile.playingPersona.name : "Pending"],
    ["Dominant time pattern", timeWindow(profile.dominantTimePattern)],
    ["Best historical peak flow", profile.bestPeakFlow ? profile.bestPeakFlow.duration : "Pending"],
    ["Total reports", String(profile.reportCount)]
  ];

  studentSummaryStack.innerHTML = summaryItems
    .map(
      ([label, value]) => `
        <article class="summary-chip">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");

  const activityPersonaRows = profile.activityPersonas.length
    ? profile.activityPersonas
        .map((ap) => `<li><strong>${ap.label}</strong>: ${ap.dominantPersona || "Pending"} (${ap.totalSessions} session${ap.totalSessions === 1 ? "" : "s"})</li>`)
        .join("")
    : "<li>No activity branches visible across the history yet.</li>";

  studentPersonaCard.innerHTML = `
    <div class="persona-heading">
      <div>
        <strong>${profile.wholeUserPersona.name}</strong>
        <div class="persona-angle">Complete student profile · ${timeWindow(profile.dominantTimePattern)}</div>
        <div class="persona-note">${profile.wholeUserPersona.summary}</div>
      </div>
      <span class="persona-chip">${timeWindow(profile.dominantTimePattern)}</span>
    </div>
    <div class="persona-columns persona-columns-triple">
      <section>
        <h3>Whole-student persona</h3>
        <p><strong>${profile.wholeUserPersona.name}</strong> — computed from ${profile.hasPlayingData ? "Playing sessions" : "all sessions"} across your full history.</p>
        <ul>${profile.wholeUserPersona.evidence.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section>
        <h3>Playing persona</h3>
        ${profile.playingPersona
          ? `<p><strong>${profile.playingPersona.name}</strong></p><ul>${profile.playingPersona.evidence.map((item) => `<li>${item}</li>`).join("")}</ul>`
          : `<p>No Playing sessions found in your history yet. Playing sessions will generate a dedicated Playing persona.</p>`}
      </section>
      <section>
        <h3>All activity personas</h3>
        <ul>${activityPersonaRows}</ul>
      </section>
    </div>
  `;

  const maxVal = Math.max(profile.averageSpeed, profile.averageAgility, profile.averageEndurance, 1);
  studentEngineGrid.innerHTML = [
    {
      label: "Average Endurance",
      score: profile.averageEndurance,
      width: `${Math.max(28, (profile.averageEndurance / maxVal) * 100)}%`,
      reading: "Average endurance across your full report history.",
      cls: ""
    },
    {
      label: "Peak Endurance",
      score: profile.peakEndurance,
      width: "100%",
      reading: "The highest endurance score in any single report.",
      cls: "peak-endurance"
    },
    {
      label: "Average Speed",
      score: profile.averageSpeed,
      width: `${Math.max(28, (profile.averageSpeed / maxVal) * 100)}%`,
      reading: "Average speed across your full report history.",
      cls: ""
    },
    {
      label: "Average Agility",
      score: profile.averageAgility,
      width: `${Math.max(28, (profile.averageAgility / maxVal) * 100)}%`,
      reading: "Average agility across your full report history.",
      cls: ""
    }
  ]
    .map(
      (metric) => `
        <article class="engine-card${metric.cls ? ` ${metric.cls}` : ""}">
          <strong>${metric.label}: ${metric.score}</strong>
          <div class="engine-bar"><div class="engine-fill" style="width:${metric.width || "100%"}"></div></div>
          <div class="engine-caption">${metric.reading}</div>
        </article>
      `
    )
    .join("");

  if (profile.bestPeakFlow) {
    studentPeakFlowPanel.innerHTML = `
      <div class="flow-topline">
        <div>
          <div class="flow-badge">${timeWindow(profile.dominantTimePattern)}</div>
          <h3>Best historical peak flow</h3>
          <p>The strongest sustained flow window recorded across your complete history.</p>
          <div class="session-meta">${profile.bestPeakFlow.sessionName || "Best sustained session"}</div>
        </div>
        <div>
          <div class="flow-duration">${profile.bestPeakFlow.duration}</div>
          <div class="session-meta">Across ${profile.reportCount} report${profile.reportCount === 1 ? "" : "s"}</div>
        </div>
      </div>
    `;
  } else {
    studentPeakFlowPanel.innerHTML = '<div class="loading">No peak flow signal found yet. Upload more reports.</div>';
  }

  const enduranceLed = profile.averageEndurance >= profile.averageSpeed && profile.averageEndurance >= profile.averageAgility - 3;
  studentPlanTitle.textContent = `Coach ${profile.wholeUserPersona.name}`;
  studentPlanBody.textContent = `${profile.wholeUserPersona.name} is your whole-student identity. ${profile.playingPersona ? `Your Playing persona reads as ${profile.playingPersona.name}.` : ""} Dominant time pattern: ${timeWindow(profile.dominantTimePattern)}. ${profile.bestPeakFlow ? `Best historical peak flow: ${profile.bestPeakFlow.duration}.` : ""}`;
  studentSteps.innerHTML = [
    enduranceLed ? "Protect your longer, calmer flow windows first." : "Use your quicker windows intentionally rather than by default.",
    `Your strongest sessions tend to happen during ${timeWindow(profile.dominantTimePattern)}.`,
    profile.bestPeakFlow ? `Use ${profile.bestPeakFlow.duration} as your target duration when building repeatable sessions.` : "Track your peak flow duration as more reports are uploaded."
  ].map((item) => `<li>${item}</li>`).join("");
}

function renderStudentActivityBranches() {
  const allBranches = studentReports.flatMap((r) =>
    (r.evaluation?.activityBranches || []).map((b) => ({ ...b, reportId: r.id, reportFileName: r.originalFileName, pdfUrl: r.pdfUrl }))
  );

  if (!allBranches.length) {
    studentActivityGrid.innerHTML = '<article class="chart-session-card"><strong>No activity branches yet</strong><p>No named activities could be extracted from the reports.</p></article>';
    return;
  }

  const token = isAdminViewing ? getAdminToken() : getStudentToken();

  studentActivityGrid.innerHTML = allBranches
    .map(
      (branch) => {
        const pdfLink = branch.pdfUrl
          ? `<a class="pdf-report-link" href="/api/reports/${encodeURIComponent(branch.reportId)}/pdf?token=${encodeURIComponent(token)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">📄 View PDF report</a>`
          : "";
        return `
        <a class="chart-session-card clickable-card" href="${studentActivityLink(branch.reportId, branch.key)}">
          <strong>${branch.label}</strong>
          <div class="session-meta">${branch.persona?.name || "Activity persona"} · ${branch.bestWindow}</div>
          <p>${branch.summary}</p>
          <div class="session-meta">${branch.reportFileName}</div>
          ${pdfLink}
          <div class="engine-link">Open branch</div>
        </a>
      `;
      }
    )
    .join("");
}

async function loadWholeStudentProfile(userName) {
  const response = await apiFetch(`/api/students/${encodeURIComponent(userName)}/profile`, { role: studentRole });
  if (response.status === 401 || response.status === 403) {
    studentAppShell.hidden = true;
    studentTabShell.hidden = true;
    if (!isAdminViewing) clearStudentSession();
    window.location.href = isAdminViewing ? "/" : "/login.html";
    return null;
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load student profile.");
  }

  return payload.profile;
}

async function loadStudentResources(userName) {
  const response = await apiFetch(`/api/students/${encodeURIComponent(userName)}/resources`, { role: studentRole });
  if (response.status === 401 || response.status === 403) {
    studentAppShell.hidden = true;
    studentTabShell.hidden = true;
    if (!isAdminViewing) clearStudentSession();
    window.location.href = isAdminViewing ? "/" : "/login.html";
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
    renderStudentEmptyState("Login to load your complete student profile.");
    return;
  }

  activeStudentName = trimmed;
  setStudentStatus("Loading student profile...");
  const response = await apiFetch(`/api/students/${encodeURIComponent(trimmed)}/reports`, { role: studentRole });
  if (response.status === 401 || response.status === 403) {
    studentAppShell.hidden = true;
    studentTabShell.hidden = true;
    if (!isAdminViewing) clearStudentSession();
    window.location.href = isAdminViewing ? "/" : "/login.html";
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
  renderStudentComparison();
  renderStudentActivityBranches();

  if (studentReports.length) {
    const profile = await loadWholeStudentProfile(trimmed);
    if (profile) {
      renderStudentProfilePersona(profile);
    }
  } else {
    renderStudentEmptyState("Upload your first report to see your complete student profile.");
  }

  setStudentStatus(
    studentReports.length
      ? `Complete profile loaded — ${studentReports.length} report${studentReports.length === 1 ? "" : "s"} for ${trimmed}.`
      : `No reports found for ${trimmed}. Upload your first report to start.`,
    !studentReports.length
  );
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
  if (isAdminViewing) {
    window.location.href = "/";
  } else {
    clearStudentSession();
    activeStudentName = "";
    activeStudentReportId = "";
    studentAppShell.hidden = true;
    studentTabShell.hidden = true;
    window.location.href = "/login.html";
  }
});

if (isAdminViewing) {
  if (studentBackLink) studentBackLink.hidden = false;
  if (studentLogoutButton) studentLogoutButton.textContent = "Back to Coach";
  if (studentUploadForm) studentUploadForm.closest("article").hidden = true;
}

const STUDENT_ORB_PERSONAS = [
  { label: "Whole-Student Persona", headline: "Speed Reactor", support: "Explosive activation and fast-start outputs define this pattern across sessions." },
  { label: "Whole-Student Persona", headline: "Endurance Anchor", support: "Steady, high-quality output sustained across long flow windows." },
  { label: "Whole-Student Persona", headline: "Adaptive Thinker", support: "Reads the environment mid-session and adjusts without losing momentum." },
  { label: "Whole-Student Persona", headline: "Flow Keeper", support: "Maintains a consistent rhythm with peak output in one concentrated window." },
  { label: "Whole-Student Persona", headline: "Agility Driver", support: "Rapid context-switching with short, high-intensity bursts across activities." },
  { label: "Whole-Student Persona", headline: "Deep Processor", support: "Long ramp-up before peak, but output quality exceeds average once settled." }
];

let studentOrbTimer = null;
let studentOrbIndex = 0;
let studentOrbCycling = false;

function fadeStudentOrbTo(label, headline, support) {
  const els = [studentSignatureLabel, studentSignatureHeadline, studentSignatureSupport];
  els.forEach((el) => { el.style.opacity = "0"; });
  setTimeout(() => {
    studentSignatureLabel.textContent = label;
    studentSignatureHeadline.textContent = headline;
    studentSignatureSupport.textContent = support;
    els.forEach((el) => { el.style.opacity = "1"; });
  }, 580);
}

function startStudentOrbCycle() {
  if (studentOrbCycling) return;
  studentOrbCycling = true;
  studentOrbIndex = 0;
  const p0 = STUDENT_ORB_PERSONAS[0];
  fadeStudentOrbTo(p0.label, p0.headline, p0.support);
  studentOrbTimer = setInterval(() => {
    studentOrbIndex = (studentOrbIndex + 1) % STUDENT_ORB_PERSONAS.length;
    const p = STUDENT_ORB_PERSONAS[studentOrbIndex];
    fadeStudentOrbTo(p.label, p.headline, p.support);
  }, 3200);
}

function stopStudentOrbCycle() {
  if (studentOrbTimer) {
    clearInterval(studentOrbTimer);
    studentOrbTimer = null;
  }
  studentOrbCycling = false;
  [studentSignatureLabel, studentSignatureHeadline, studentSignatureSupport].forEach((el) => { el.style.opacity = "1"; });
}

function startRealStudentOrbCycle(profile) {
  stopStudentOrbCycle();
  const slots = [
    {
      label: "Whole-Student Persona",
      headline: profile.wholeUserPersona.name,
      support: profile.wholeUserPersona.summary
    }
  ];
  if (profile.playingPersona) {
    slots.push({
      label: "Playing Persona",
      headline: profile.playingPersona.name,
      support: profile.playingPersona.summary
    });
  }
  slots.push({
    label: "Dominant Time Pattern",
    headline: timeWindow(profile.dominantTimePattern),
    support: "Strongest sessions cluster in this window."
  });
  if (slots.length === 1) {
    fadeStudentOrbTo(slots[0].label, slots[0].headline, slots[0].support);
    return;
  }
  studentOrbCycling = true;
  studentOrbIndex = 0;
  fadeStudentOrbTo(slots[0].label, slots[0].headline, slots[0].support);
  studentOrbTimer = setInterval(() => {
    studentOrbIndex = (studentOrbIndex + 1) % slots.length;
    const p = slots[studentOrbIndex];
    fadeStudentOrbTo(p.label, p.headline, p.support);
  }, 3200);
}

if (activeStudentName) {
  studentAppShell.hidden = false;
  studentTabShell.hidden = false;
  activateStudentTab(activeStudentTab);
  startStudentOrbCycle();
  Promise.all([loadStudentReports(activeStudentName), loadStudentResources(activeStudentName)]).catch((error) => {
    setStudentStatus(error.message, true);
    renderStudentEmptyState(error.message);
  });
} else {
  studentAppShell.hidden = true;
  studentTabShell.hidden = true;
  window.location.href = isAdminViewing ? "/" : "/login.html";
}
