const params = new URLSearchParams(window.location.search);
const reportId = params.get("report");
const metricKey = params.get("metric");

const titleEl = document.getElementById("detail-title");
const summaryEl = document.getElementById("detail-summary");
const metaEl = document.getElementById("detail-meta");
const bodyEl = document.getElementById("detail-body");
const sourceEl = document.getElementById("detail-source");

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

async function loadEvidence() {
  if (!reportId || !metricKey) {
    titleEl.textContent = "Missing evidence target";
    return;
  }

  const role = getStudentToken() ? "student" : "admin";
  const response = await apiFetch(`/api/reports/${encodeURIComponent(reportId)}/evidence/${encodeURIComponent(metricKey)}`, { role });
  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load evidence.");
  }

  const { report, evidence } = payload;
  titleEl.textContent = `${report.userName} · ${evidence.metricLabel}`;
  summaryEl.textContent = evidence.explanation;
  metaEl.innerHTML = renderMeta([
    ["Activity", evidence.activity],
    ["Branch", evidence.branch],
    ["Value", evidence.value],
    ["Basis", evidence.basis]
  ]);

  bodyEl.innerHTML = `
    <div class="modifier-grid">
      <article class="modifier-card">
        <strong>When</strong>
        <p>${evidence.sessionDate} · ${evidence.timeWindow}</p>
      </article>
      <article class="modifier-card">
        <strong>Comparison</strong>
        <p>${evidence.comparedTo}</p>
      </article>
      <article class="modifier-card">
        <strong>Source</strong>
        <p>${evidence.source}</p>
      </article>
    </div>
  `;

  sourceEl.innerHTML = report.pdfUrl
    ? `
        <p class="strapline">The original uploaded PDF is embedded below for proof and context.</p>
        <iframe class="pdf-frame" src="/api/reports/${encodeURIComponent(report.id)}/pdf?token=${encodeURIComponent(role === "student" ? getStudentToken() : getAdminToken())}" title="Source PDF"></iframe>
      `
    : `
        <article class="modifier-card">
          <strong>PDF unavailable</strong>
          <p>This report was stored before PDF retention was enabled, so only the extracted evidence is available here.</p>
        </article>
      `;
}

loadEvidence().catch((error) => {
  titleEl.textContent = "Could not load metric evidence";
  summaryEl.textContent = error.message;
});
