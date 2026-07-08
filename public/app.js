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
let activeStudentName = "";

function timeWindow(pattern) {
  if (!pattern) return pattern;
  if (pattern === "Morning Settler") return "Before 11 AM";
  if (pattern === "Midday Driver") return "11 AM – 4 PM";
  if (pattern === "Evening Spark") return "4 PM onwards";
  return pattern;
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
  personaCard.innerHTML = '<div class="placeholder-card">No student selected yet.</div>';
  peakFlowPanel.innerHTML = '<div class="placeholder-card">Select a student to see their whole-student peak flow.</div>';
  engineGrid.innerHTML = "";
  chartSessionGrid.innerHTML = "";
  activityBranchGrid.innerHTML = "";
  modifierGrid.innerHTML = "";
  focusWellnessSummary.textContent = "";
  timeSpentGrid.innerHTML = "";
  signatureLabel.textContent = "Student Persona";
  signatureHeadline.textContent = "Select a student";
  signatureSupport.textContent = "The app will show the whole-student persona computed from the full report history.";
  coachTitle.textContent = "Choose a student to inspect";
  coachSummary.textContent =
    "The coach side will show the whole-student persona, the playing persona, and the dominant time pattern across the full history.";
  coachSessionCount.textContent = "";
  coachPlanTitle.textContent = "How to coach this student";
  coachPlanBody.textContent = "Select a student to see the whole-student coaching profile.";
  coachingSteps.innerHTML = "";
  coachResourceList.innerHTML = '<article class="modifier-card"><strong>No student selected</strong><p>Select a student to assign resources.</p></article>';
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

function buildStudentLink(userName) {
  return `/student.html?user=${encodeURIComponent(userName)}`;
}

function renderSummaryFromProfile(userName, profile) {
  const items = [
    ["Whole-student persona", profile.wholeUserPersona.name],
    ["Playing persona", profile.playingPersona ? profile.playingPersona.name : "Insufficient Playing data"],
    ["Dominant time pattern", timeWindow(profile.dominantTimePattern)],
    ["Best historical peak flow", profile.bestPeakFlow ? profile.bestPeakFlow.duration : "Pending"],
    ["Report count", String(profile.reportCount)]
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

function renderPersonaFromProfile(userName, profile) {
  startRealOrbCycle(profile);

  coachTitle.textContent = `${userName} — Whole-Student Profile`;
  coachSummary.textContent = `Whole-student persona: ${profile.wholeUserPersona.name}. Playing persona: ${profile.playingPersona ? profile.playingPersona.name : "Pending"}. Based on ${profile.reportCount} report${profile.reportCount === 1 ? "" : "s"}.`;
  coachSessionCount.textContent = `Complete student profile built from ${profile.reportCount} report${profile.reportCount === 1 ? "" : "s"} · Dominant time pattern: ${timeWindow(profile.dominantTimePattern)}`;

  const activityPersonaRows = profile.activityPersonas.length
    ? profile.activityPersonas
        .map((ap) => `<li><strong>${ap.label}</strong>: ${ap.dominantPersona || "Pending"} (${ap.totalSessions} session${ap.totalSessions === 1 ? "" : "s"})</li>`)
        .join("")
    : "<li>No activity branches visible across the history yet.</li>";

  personaCard.innerHTML = `
    <div class="persona-heading">
      <div>
        <strong>${profile.wholeUserPersona.name}</strong>
        <div class="persona-angle">Whole-student read · ${timeWindow(profile.dominantTimePattern)}</div>
        <div class="persona-note">${profile.wholeUserPersona.summary}</div>
      </div>
      <span class="persona-chip">${timeWindow(profile.dominantTimePattern)}</span>
    </div>
    <div class="persona-columns">
      <section>
        <h3>Whole-student persona</h3>
        <p><strong>${profile.wholeUserPersona.name}</strong> — computed from ${profile.hasPlayingData ? "Playing sessions" : "all sessions"} across the full history.</p>
        <ul>${profile.wholeUserPersona.evidence.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>
      <section>
        <h3>Playing persona</h3>
        ${profile.playingPersona
          ? `<p><strong>${profile.playingPersona.name}</strong></p><ul>${profile.playingPersona.evidence.map((item) => `<li>${item}</li>`).join("")}</ul>`
          : `<p>No Playing sessions found in the history yet. Upload reports that include Playing activity to see the dedicated Playing persona.</p>`}
      </section>
      <section>
        <h3>All activity personas</h3>
        <ul>${activityPersonaRows}</ul>
      </section>
    </div>
  `;
}

function renderPeakFlowFromProfile(profile) {
  if (!profile.bestPeakFlow) {
    peakFlowPanel.innerHTML = '<div class="placeholder-card">No peak flow signal found across the history yet.</div>';
    return;
  }

  peakFlowPanel.innerHTML = `
    <div class="flow-topline">
      <div>
        <div class="flow-badge">${timeWindow(profile.dominantTimePattern)}</div>
        <h3>Best historical peak flow</h3>
        <p>The strongest sustained flow window recorded across the complete history.</p>
        <div class="session-meta">${profile.bestPeakFlow.sessionName || "Best sustained session"}</div>
      </div>
      <div>
        <div class="flow-duration">${profile.bestPeakFlow.duration}</div>
        <div class="session-meta">Best across ${profile.reportCount} report${profile.reportCount === 1 ? "" : "s"}</div>
      </div>
    </div>
  `;
}

function renderEngineFromProfile(profile) {
  const maxVal = Math.max(profile.averageSpeed, profile.averageAgility, profile.averageEndurance, 1);
  const items = [
    {
      id: "endurance",
      label: "Average Endurance",
      score: profile.averageEndurance,
      width: `${Math.max(28, (profile.averageEndurance / maxVal) * 100)}%`,
      reading: "Average endurance score across all reports in the full history."
    },
    {
      id: "peak-endurance",
      label: "Peak Endurance",
      score: profile.peakEndurance,
      width: "100%",
      reading: "The highest endurance score recorded in any single report."
    },
    {
      id: "speed",
      label: "Average Speed",
      score: profile.averageSpeed,
      width: `${Math.max(28, (profile.averageSpeed / maxVal) * 100)}%`,
      reading: "Average speed score across all reports in the full history."
    },
    {
      id: "agility",
      label: "Average Agility",
      score: profile.averageAgility,
      width: `${Math.max(28, (profile.averageAgility / maxVal) * 100)}%`,
      reading: "Average agility score across all reports in the full history."
    },
    {
      id: "peak-flow",
      label: "Best Historical Peak Flow",
      score: profile.bestPeakFlow ? profile.bestPeakFlow.duration : "Pending",
      width: "100%",
      reading: "The strongest peak flow duration detected across the complete report history."
    }
  ];

  engineGrid.innerHTML = items
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
}

function renderChartSessionsFromReports(studentReports) {
  const allSessions = studentReports.flatMap((r) => (r.evaluation?.chartSessions || []).map((s) => ({
    ...s,
    reportFileName: r.originalFileName
  })));

  if (!allSessions.length) {
    chartSessionGrid.innerHTML = '<article class="chart-session-card"><strong>No chart sessions parsed</strong><p>No chart structures could be extracted from the uploaded reports.</p></article>';
    return;
  }

  chartSessionGrid.innerHTML = allSessions
    .map(
      (session) => `
        <article class="chart-session-card">
          <strong>${session.name}</strong>
          <div class="session-meta">${session.time} · ${session.duration} · ${session.activityGroup}</div>
          <p>${session.timePersona} · Speed ${session.speed} · Agility ${session.agility} · Endurance ${session.endurance}</p>
          <div class="session-meta">${session.reportFileName}</div>
        </article>
      `
    )
    .join("");
}

function renderActivityBranchesFromReports(studentReports) {
  const allBranches = studentReports.flatMap((r) =>
    (r.evaluation?.activityBranches || []).map((b) => ({ ...b, reportId: r.id, reportFileName: r.originalFileName, pdfUrl: r.pdfUrl }))
  );

  if (!allBranches.length) {
    activityBranchGrid.innerHTML = '<article class="chart-session-card"><strong>No activity branches yet</strong><p>The reports did not expose enough named activities to compare.</p></article>';
    return;
  }

  const token = getAdminToken();

  activityBranchGrid.innerHTML = allBranches
    .map((branch) => {
      const activityUrl = buildActivityLink(branch.reportId, branch.key);
      const pdfLink = branch.pdfUrl
        ? `<a class="branch-action branch-action-secondary" href="/api/reports/${encodeURIComponent(branch.reportId)}/pdf?token=${encodeURIComponent(token)}" target="_blank" rel="noopener">View PDF report</a>`
        : "";

      return `
        <article class="activity-branch-card" data-activity-url="${activityUrl}" tabindex="0" role="link" aria-label="Open ${branch.label} branch">
          <div class="branch-card-body">
            <div class="branch-card-topline">
              <span class="branch-card-kicker">${branch.persona?.name || "Activity persona"}</span>
              <span class="branch-card-time">${branch.sessions} session${branch.sessions === 1 ? "" : "s"} · ${branch.bestWindow}</span>
            </div>
            <h3>${branch.label}</h3>
            <p>${branch.summary}</p>
            <div class="branch-file" title="${branch.reportFileName}">${branch.reportFileName}</div>
          </div>
          <div class="branch-actions">
            ${pdfLink}
            <a class="branch-action branch-action-primary" href="${activityUrl}">Open Branch</a>
          </div>
        </article>
      `;
    })
    .join("");

  activityBranchGrid.querySelectorAll(".activity-branch-card").forEach((card) => {
    card.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (event) => event.stopPropagation());
    });
    card.addEventListener("click", () => {
      window.location.href = card.dataset.activityUrl;
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = card.dataset.activityUrl;
      }
    });
  });
}

function renderCoachingFromProfile(userName, profile) {
  const enduranceLed = profile.averageEndurance >= profile.averageSpeed && profile.averageEndurance >= profile.averageAgility - 3;
  coachPlanTitle.textContent = `Coach ${profile.wholeUserPersona.name}`;
  coachPlanBody.textContent = `${profile.wholeUserPersona.name} is the whole-student identity for ${userName}. ${profile.playingPersona ? `Playing persona reads as ${profile.playingPersona.name}.` : ""} Dominant time pattern is ${timeWindow(profile.dominantTimePattern)}. ${profile.bestPeakFlow ? `Best historical peak flow is ${profile.bestPeakFlow.duration}.` : ""}`;
  coachingSteps.innerHTML = [
    enduranceLed ? "Protect the longer, calmer flow windows first." : "Use the quicker windows intentionally rather than by default.",
    `Bias coaching toward ${timeWindow(profile.dominantTimePattern)} when you want the strongest version of this student.`,
    profile.bestPeakFlow ? `Use ${profile.bestPeakFlow.duration} as the target duration when building repeatable sessions.` : "Track peak flow duration as more reports are uploaded."
  ].map((item) => `<li>${item}</li>`).join("");
}

async function renderStudentProfile(userName) {
  if (!userName) {
    renderEmptyState();
    return;
  }

  try {
    const response = await apiFetch(`/api/students/${encodeURIComponent(userName)}/profile`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load student profile.");
    }

    const profile = payload.profile;
    const studentReports = reports.filter((r) => r.userName.toLowerCase() === userName.toLowerCase());

    renderSummaryFromProfile(userName, profile);
    renderPersonaFromProfile(userName, profile);
    renderPeakFlowFromProfile(profile);
    renderEngineFromProfile(profile);
    renderChartSessionsFromReports(studentReports);
    renderActivityBranchesFromReports(studentReports);
    renderCoachingFromProfile(userName, profile);
    loadCoachResources(userName).catch((error) => {
      setCoachResourceStatus(error.message, true);
      renderCoachResources([]);
    });

    modifierGrid.innerHTML = "";
    focusWellnessSummary.textContent = "";
    timeSpentGrid.innerHTML = "";
  } catch (error) {
    coachTitle.textContent = `Error loading profile for ${userName}`;
    coachSummary.textContent = error.message;
  }
}

function groupReportsByStudent(allReports) {
  const studentMap = new Map();
  for (const report of allReports) {
    const name = report.userName;
    if (!studentMap.has(name)) {
      studentMap.set(name, []);
    }
    studentMap.get(name).push(report);
  }
  return studentMap;
}

function renderStudentList() {
  const studentMap = groupReportsByStudent(reports);

  if (!studentMap.size) {
    reportList.innerHTML =
      '<article class="report-card"><h3>No students yet</h3><div class="report-meta">Upload the first PDF to create a student profile.</div></article>';
    return;
  }

  reportList.innerHTML = [...studentMap.entries()]
    .map(
      ([studentName, studentReports]) => `
        <article class="report-card ${activeStudentName === studentName ? "active" : ""}" data-student-name="${studentName}">
          <h3>${studentName}</h3>
          <div class="report-meta">${studentReports.length} report${studentReports.length === 1 ? "" : "s"}</div>
          <div class="report-meta">Whole-student profile available</div>
          <a class="engine-link report-link" href="${buildStudentLink(studentName)}">Open student page</a>
        </article>
      `
    )
    .join("");

  reportList.querySelectorAll("[data-student-name]").forEach((card) => {
    card.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (event) => event.stopPropagation());
    });
    card.addEventListener("click", () => {
      activeStudentName = card.dataset.studentName;
      renderStudentList();
      renderStudentProfile(activeStudentName);
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

  const firstStudent = reports[0]?.userName || "";
  activeStudentName = firstStudent;
  renderStudentList();

  if (activeStudentName) {
    await renderStudentProfile(activeStudentName);
  } else {
    renderEmptyState();
  }
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
  if (!activeStudentName) {
    setCoachResourceStatus("Choose a student first.", true);
    return;
  }

  setCoachResourceStatus("Assigning resource...");
  const response = await apiFetch(`/api/admin/students/${encodeURIComponent(activeStudentName)}/resources`, {
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
  { label: "Whole-Student Persona", headline: "Speed Reactor", support: "Explosive activation and fast-start outputs define this pattern across sessions." },
  { label: "Whole-Student Persona", headline: "Endurance Anchor", support: "Steady, high-quality output sustained across long flow windows." },
  { label: "Whole-Student Persona", headline: "Adaptive Thinker", support: "Reads the environment mid-session and adjusts without losing momentum." },
  { label: "Whole-Student Persona", headline: "Flow Keeper", support: "Maintains a consistent rhythm with peak output concentrated in one window." },
  { label: "Whole-Student Persona", headline: "Agility Driver", support: "Rapid context-switching with short, high-intensity bursts across activities." },
  { label: "Whole-Student Persona", headline: "Deep Processor", support: "Long ramp-up before peak, but output quality exceeds average once settled." }
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

function startRealOrbCycle(profile) {
  stopOrbCycle();
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
    fadeOrbTo(slots[0].label, slots[0].headline, slots[0].support);
    return;
  }
  orbCycling = true;
  orbCycleIndex = 0;
  fadeOrbTo(slots[0].label, slots[0].headline, slots[0].support);
  orbCycleTimer = setInterval(() => {
    orbCycleIndex = (orbCycleIndex + 1) % slots.length;
    const p = slots[orbCycleIndex];
    fadeOrbTo(p.label, p.headline, p.support);
  }, 3200);
}

loadReports().catch((error) => {
  setStatus(`Failed to load reports: ${error.message}`, true);
  renderEmptyState();
});

loadAdminUsers().catch(() => {
  renderAdminUsers([]);
});

startOrbCycle();
