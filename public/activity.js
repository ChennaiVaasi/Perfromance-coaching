const activityParams = new URLSearchParams(window.location.search);
const activityReportId = activityParams.get("report");
const activityKey = activityParams.get("activity");

const activityTitleEl = document.getElementById("activity-title");
const activitySummaryEl = document.getElementById("activity-summary");
const activityMetaEl = document.getElementById("activity-meta");
const activityHighlightsEl = document.getElementById("activity-highlights");
const activityPersonaEl = document.getElementById("activity-persona");
const activitySessionsEl = document.getElementById("activity-sessions");

function renderMeta(items) {
  return items
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

async function loadActivity() {
  if (!activityReportId || !activityKey) {
    activityTitleEl.textContent = "Missing activity target";
    return;
  }

  const role = getStudentToken() ? "student" : "admin";
  const response = await apiFetch(`/api/reports/${encodeURIComponent(activityReportId)}/activities/${encodeURIComponent(activityKey)}`, { role });
  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load activity branch.");
  }

  const { report, branch } = payload;
  const relatedSessions = (report.evaluation.chartSessions || []).filter((session) => session.activityGroup === branch.label);

  activityTitleEl.textContent = `${report.userName} · ${branch.label}`;
  activitySummaryEl.textContent = branch.summary;
  activityMetaEl.innerHTML = renderMeta([
    ["Sessions", branch.sessions],
    ["Best window", branch.bestWindow],
    ["Lead activity", branch.activity]
  ]);

  activityHighlightsEl.innerHTML = `
    <ul class="coach-steps">${branch.highlights.map((item) => `<li>${item}</li>`).join("")}</ul>
  `;

  activityPersonaEl.innerHTML = branch.persona
    ? `
      <div class="persona-heading">
        <div>
          <strong>${branch.persona.name}</strong>
          <div class="persona-angle">${branch.persona.angle}</div>
          <div class="persona-note">${branch.persona.summary}</div>
        </div>
        <span class="persona-chip">${branch.label}</span>
      </div>
      <ul class="coach-steps">${(branch.persona.evidence || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    `
    : '<p class="strapline">No scoped persona could be formed for this activity yet.</p>';

  activitySessionsEl.innerHTML = relatedSessions.length
    ? relatedSessions
        .map(
          (session) => `
            <article class="chart-session-card">
              <strong>${session.name}</strong>
              <div class="session-meta">${session.time} · ${session.duration}</div>
              <p>Speed ${session.speed} · Agility ${session.agility} · Endurance ${session.endurance}</p>
            </article>
          `
        )
        .join("")
    : '<article class="chart-session-card"><strong>Single-session branch</strong><p>This branch is being inferred from the report summary rather than multiple chart rows.</p></article>';
}

loadActivity().catch((error) => {
  activityTitleEl.textContent = "Could not load activity branch";
  activitySummaryEl.textContent = error.message;
});
