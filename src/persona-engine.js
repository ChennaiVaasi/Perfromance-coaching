function extractNumbers(text, patterns) {
  const values = [];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = Number(match[1]);
      if (!Number.isNaN(value) && value >= 0 && value <= 100) {
        values.push(value);
      }
    }
  }

  return values;
}

function normaliseReportText(text) {
  return text.replace(/Â·/g, "·").replace(/\s+/g, " ").trim();
}

function buildMetricSummary(reportText) {
  const cognitiveSpeedMatch = reportText.match(/(\d+(?:\.\d+)?)\s+Cognitive Speed/i);
  const cognitiveAgilityMatch = reportText.match(/(\d+(?:\.\d+)?)\s+Cognitive Agility/i);
  const cognitiveEnduranceMatch = reportText.match(/(\d+(?:\.\d+)?)\s+Cognitive Endurance/i);

  const enduranceCandidates = extractNumbers(reportText, [
    /(\d+(?:\.\d+)?)\s+Cognitive Endurance/gi,
    /best endurance[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /strongest stamina[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /endurance[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /stamina[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /staying power[^0-9]{0,20}(\d+(?:\.\d+)?)/gi
  ]);

  const speedCandidates = extractNumbers(reportText, [
    /(\d+(?:\.\d+)?)\s+Cognitive Speed/gi,
    /fastest session at[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /top speed peaked at[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /speed peaked at[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /speed[^0-9]{0,20}(\d+(?:\.\d+)?)/gi
  ]);

  const agilityCandidates = extractNumbers(reportText, [
    /(\d+(?:\.\d+)?)\s+Cognitive Agility/gi,
    /highest agility[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /best agility[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /agility[^0-9]{0,20}(\d+(?:\.\d+)?)/gi
  ]);

  return {
    endurance: cognitiveEnduranceMatch ? Number(cognitiveEnduranceMatch[1]) : enduranceCandidates.length ? Math.max(...enduranceCandidates) : 48,
    speed: cognitiveSpeedMatch ? Number(cognitiveSpeedMatch[1]) : speedCandidates.length ? Math.max(...speedCandidates) : 44,
    agility: cognitiveAgilityMatch ? Number(cognitiveAgilityMatch[1]) : agilityCandidates.length ? Math.max(...agilityCandidates) : 46
  };
}

function extractReportCoverage(reportText, chartSessions) {
  const uniqueReportsMatch = reportText.match(/(\d+)\s+unique reports/i);
  const uniqueSessionsMatch = reportText.match(/covers\s+(\d+)\s+unique sessions/i);
  const trackedTotal = uniqueSessionsMatch
    ? Number(uniqueSessionsMatch[1])
    : uniqueReportsMatch
      ? Number(uniqueReportsMatch[1])
      : null;

  return {
    totalSessions: trackedTotal,
    visibleSessions: chartSessions.length,
    summary: trackedTotal
      ? `Conclusions are being formed from ${trackedTotal} sessions in the report, with ${chartSessions.length || 1} session${(chartSessions.length || 1) === 1 ? "" : "s"} shown as visible evidence.`
      : `Conclusions are being formed from the report summary, with ${chartSessions.length || 1} visible session${(chartSessions.length || 1) === 1 ? "" : "s"} available as evidence.`
  };
}

function parseDurationToSeconds(duration) {
  const match = duration.match(/(?:(\d+)h )?(\d+)m (\d+)s/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatSeconds(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainder}s`;
  }

  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function bucketTimeLabel(timeString) {
  const match = timeString.match(/(\d{1,2}):(\d{2}) ([AP]M)/);
  if (!match) return "Mixed";
  let hour = Number(match[1]);
  const meridiem = match[3];
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  if (hour < 11) return "Morning Settler";
  if (hour < 16) return "Day Carrier";
  return "Evening Spark";
}

function extractChartSessions(reportText) {
  const sessionRegex =
    /([A-Z][A-Za-z ]+?)\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+·\s+(\d{1,2}:\d{2} [AP]M)\s+((?:\d+h )?\d+m \d+s)([\d.]+)(Fastest session|Strongest stamina|Best agility|Largest ramp-up delay|Shortest sample|Longest session)/g;

  const sessions = [];

  for (const match of reportText.matchAll(sessionRegex)) {
    const rawName = match[1]
      .replace(/SessionTimeDurationSpee d AgilityEnduran ce Reading /g, "")
      .replace(/Fastest session /g, "")
      .replace(/Strongest stamina /g, "")
      .replace(/Best agility /g, "")
      .replace(/Largest ramp-up delay /g, "")
      .replace(/Shortest sample /g, "")
      .replace(/Longest session /g, "")
      .trim();
    const time = match[2];
    const duration = match[3];
    const scoreSegment = match[4];
    const scoreParts = [...scoreSegment.matchAll(/\d{1,2}\.\d/g)].map((item) => Number(item[0]));
    if (scoreParts.length < 3) continue;

    const speed = scoreParts[0];
    const agility = scoreParts[1];
    const endurance = scoreParts[2];
    const composite = (speed + agility + endurance) / 3;
    const durationWeighted = composite * parseDurationToSeconds(duration);

    sessions.push({
      name: rawName,
      activityGroup: classifyActivity(rawName),
      time,
      duration,
      speed,
      agility,
      endurance,
      durationSeconds: parseDurationToSeconds(duration),
      composite,
      durationWeighted,
      timePersona: bucketTimeLabel(time)
    });
  }

  return sessions;
}

function cleanOcrLine(line) {
  return line
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bOm\b/g, "0m")
    .replace(/\bOs\b/g, "0s")
    .trim();
}

function mergeSessionFragments(lines) {
  const merged = [];
  for (const rawLine of lines) {
    const line = cleanOcrLine(rawLine);
    if (!line) continue;

    if (/^(AM|PM)$/i.test(line) && merged.length) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line.toUpperCase()}`;
      continue;
    }

    if (/^(Sanjay|Raghav)$/i.test(line) && merged.length) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`;
      continue;
    }

    if (/^\d+s$/i.test(line) && merged.length && /\d+h \d+m$/i.test(merged[merged.length - 1])) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`;
      continue;
    }

    merged.push(line);
  }

  return merged;
}

function extractChartSessionsFromOcr(ocrText) {
  if (!ocrText) return [];
  const rawLines = ocrText.split("\n").map((line) => line.trim()).filter(Boolean);
  const lines = mergeSessionFragments(rawLines);
  const sessions = [];
  const sessionPattern =
    /^(.*?)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[-·]?\s*(\d{1,2}:\d{2})\s*(AM|PM)\s+((?:\d+h\s+)?\d+m\s+\d+s)\s+(\d{1,2}(?:\.\d+)?)\s+(\d{1,2}(?:\.\d+)?)\s+(\d{1,2}(?:\.\d+)?)\s+(.*)$/i;

  for (const line of lines) {
    const match = line.match(sessionPattern);
    if (!match) continue;

    const name = match[1].trim();
    const time = `${match[4]} ${match[5].toUpperCase()}`;
    const duration = match[6].replace(/\s+/g, " ");
    const speed = Number(match[7]);
    const agility = Number(match[8]);
    const endurance = Number(match[9]);
    const composite = (speed + agility + endurance) / 3;
    const durationSeconds = parseDurationToSeconds(duration);

    sessions.push({
      name,
      activityGroup: classifyActivity(name),
      time,
      duration,
      speed,
      agility,
      endurance,
      durationSeconds,
      composite,
      durationWeighted: composite * durationSeconds,
      timePersona: bucketTimeLabel(time)
    });
  }

  return sessions;
}

function mergeChartSessions(primarySessions, supplementalSessions) {
  const byKey = new Map();
  for (const session of [...primarySessions, ...supplementalSessions]) {
    const key = `${session.name}|${session.time}|${session.duration}`;
    if (!byKey.has(key)) {
      byKey.set(key, session);
    }
  }

  return [...byKey.values()];
}

function inferPatternPersona(text, metrics) {
  const lower = text.toLowerCase();

  const slowBurnSignal =
    lower.includes("startup friction") ||
    lower.includes("slowest ramp-up") ||
    lower.includes("settling into deep work") ||
    lower.includes("strongest stamina") ||
    lower.includes("best endurance");

  const depthSignal =
    lower.includes("longest session") ||
    lower.includes("lecture") ||
    lower.includes("focus work dominated tracked time");

  const balancedFlowSignal =
    lower.includes("balanced cognitive speed and agility") ||
    lower.includes("'flow' state") ||
    lower.includes("strong focus and creative immersion");

  const warmupSignal =
    lower.includes("slow ramp-up") ||
    lower.includes("warm up") ||
    lower.includes("deep work ramp-up");

  if (balancedFlowSignal && warmupSignal && metrics.agility >= 55 && metrics.endurance >= 55) {
    return {
      name: "Flow Builder",
      angle: "Adaptive analytical flow",
      summary: "Builds quality by warming into the work, then holding a balanced mix of analysis and flexibility.",
      evidence: [
        "The report explicitly describes a balanced speed-and-agility flow state.",
        "A slow warm-up pattern is present, which suggests quality improves after entry.",
        "Agility and endurance both remain strong enough to support deeper work."
      ]
    };
  }

  if (slowBurnSignal && depthSignal && metrics.endurance >= metrics.speed - 8) {
    return {
      name: "Slow-Burn Operator",
      angle: "Settling curve",
      summary: "Gets stronger after settling in and often produces the best work once the runway is long enough.",
      evidence: [
        "The report explicitly points to startup friction or a slower ramp-up pattern.",
        "Long-form or focus-heavy evidence is present in the report.",
        "Endurance remains competitive with speed rather than disappearing behind it."
      ]
    };
  }

  if (metrics.speed > metrics.endurance + 6) {
    return {
      name: "Evening Spark",
      angle: "Quick activation",
      summary: "Looks sharp and fast early, especially when the work is shorter or more technical.",
      evidence: [
        "Speed clearly outruns endurance in the report.",
        "The profile looks more activation-led than staying-power-led.",
        "The report supports sharper bursts more than long-form depth."
      ]
    };
  }

  return {
    name: "Day Carrier",
    angle: "Workload window",
    summary: "Carries the bulk of the day and adapts well when the middle of the day gets heavy.",
    evidence: [
      "The report does not isolate one sharp time window strongly enough to replace the day-carrying default.",
      "Agility and endurance both remain meaningful.",
      "This persona usually appears when the user handles volume rather than spike performance."
    ]
  };
}

function inferPrimaryPersona(text, metrics, chartSessions = []) {
  const patternPersona = inferPatternPersona(text, metrics);
  const agilityLead = metrics.agility - metrics.speed;
  const speedLead = metrics.speed - metrics.agility;
  const lower = text.toLowerCase();

  const aggregateAgilitySignal =
    lower.includes("agility stayed more resilient than speed") ||
    lower.includes("highest agility") ||
    lower.includes("best agility");

  const aggregateSpeedSignal =
    lower.includes("fastest session") ||
    lower.includes("top speed peaked") ||
    lower.includes("speed peaked");

  const meaningfulComparisons = chartSessions.filter((session) => Math.abs(session.agility - session.speed) >= 3);
  const agilityWins = meaningfulComparisons.filter((session) => session.agility > session.speed).length;
  const speedWins = meaningfulComparisons.filter((session) => session.speed > session.agility).length;
  const comparisonCount = meaningfulComparisons.length;

  const consistentAgility =
    comparisonCount >= 3
      ? agilityWins / comparisonCount >= 0.65 && agilityLead >= 2
      : aggregateAgilitySignal && agilityLead >= 3;

  const consistentSpeed =
    comparisonCount >= 3
      ? speedWins / comparisonCount >= 0.65 && speedLead >= 2
      : aggregateSpeedSignal && speedLead >= 3;

  const hasMixedWins = comparisonCount >= 2 && agilityWins >= 1 && speedWins >= 1;
  const bestAgilitySession = chartSessions.length ? [...chartSessions].sort((a, b) => b.agility - a.agility)[0] : null;
  const bestSpeedSession = chartSessions.length ? [...chartSessions].sort((a, b) => b.speed - a.speed)[0] : null;
  const activityShift =
    bestAgilitySession &&
    bestSpeedSession &&
    classifyActivity(bestAgilitySession.name) !== classifyActivity(bestSpeedSession.name);
  const timeShift =
    bestAgilitySession &&
    bestSpeedSession &&
    bestAgilitySession.timePersona !== bestSpeedSession.timePersona;
  const moderateSpread = Math.abs(speedLead) >= 2 || Math.abs(agilityLead) >= 2;

  if (consistentAgility) {
    return {
      name: "Intuitive-leaning",
      angle: patternPersona.name,
      summary: `Leans on feel, adjustment, and live pattern recognition more than straight-line activation. ${patternPersona.name} is the deeper performance style underneath this read.`,
      evidence: [
        comparisonCount >= 3
          ? `Agility outruns speed in ${agilityWins} of ${comparisonCount} meaningful visible sessions, and the overall report edge also favors agility (${metrics.agility} vs ${metrics.speed}).`
          : `Agility (${metrics.agility}) is stronger than speed (${metrics.speed}), and the report language reinforces agility as the more repeatable edge.`,
        patternPersona.summary,
        ...patternPersona.evidence.slice(0, 2)
      ]
    };
  }

  if (consistentSpeed) {
    return {
      name: "Analytical-leaning",
      angle: patternPersona.name,
      summary: `Leans on direct processing, sharper activation, and clearer task entry more than live improvisation. ${patternPersona.name} is the deeper performance style underneath this read.`,
      evidence: [
        comparisonCount >= 3
          ? `Speed outruns agility in ${speedWins} of ${comparisonCount} meaningful visible sessions, and the overall report edge also favors speed (${metrics.speed} vs ${metrics.agility}).`
          : `Speed (${metrics.speed}) is stronger than agility (${metrics.agility}), and the report language reinforces speed as the more repeatable edge.`,
        patternPersona.summary,
        ...patternPersona.evidence.slice(0, 2)
      ]
    };
  }

  if (hasMixedWins && (activityShift || timeShift || moderateSpread)) {
    const contextLine = activityShift
      ? `${classifyActivity(bestSpeedSession.name)} pushes more analytical speed, while ${classifyActivity(bestAgilitySession.name)} brings out more intuitive agility.`
      : timeShift
        ? `${bestSpeedSession.timePersona} looks more analytical, while ${bestAgilitySession.timePersona} looks more intuitive.`
        : `The report keeps showing both speed-led and agility-led moments rather than one stable thinker style.`;

    return {
      name: "Dual-mode",
      angle: patternPersona.name,
      summary: `Shows different strengths in different contexts instead of one fixed cognitive mode. ${patternPersona.name} is the deeper performance style underneath this read.`,
      evidence: [
        contextLine,
        `The report contains meaningful visible sessions on both sides of the speed-versus-agility split (${speedWins} speed-led, ${agilityWins} agility-led).`,
        patternPersona.summary,
        ...patternPersona.evidence.slice(0, 1)
      ]
    };
  }

  return {
    name: "Balanced Thinker",
    angle: patternPersona.name,
    summary: `Uses analysis and intuition in a fairly even mix. ${patternPersona.name} is the deeper performance style underneath this read.`,
    evidence: [
      `Speed (${metrics.speed}) and agility (${metrics.agility}) are close, so neither analysis nor intuition fully dominates the profile.`,
      patternPersona.summary,
      ...patternPersona.evidence.slice(0, 2)
    ]
  };
}

function inferTimePersona(reportText, chartSessions, primaryPersona) {
  if (chartSessions.length) {
    const bestFlowSession = [...chartSessions].sort((a, b) => b.composite - a.composite)[0];
    return {
      label: bestFlowSession.timePersona,
      window: bestFlowSession.time,
      summary: `${bestFlowSession.name} suggests ${bestFlowSession.timePersona.toLowerCase()} is where the user's strongest flow signature appears.`,
      evidence: [
        `${bestFlowSession.name} had the strongest combined chart profile.`,
        `The session happened at ${bestFlowSession.time}.`,
        `Its duration was ${bestFlowSession.duration}.`
      ]
    };
  }

  const sessionWindowMatch = reportText.match(/from\s+(\d{1,2}:\d{2} [AP]M)\s+to\s+(\d{1,2}:\d{2} [AP]M)/i);
  if (sessionWindowMatch) {
    const startTime = sessionWindowMatch[1];
    const label = bucketTimeLabel(startTime);
    return {
      label,
      window: startTime,
      summary: `The session started at ${startTime}, so the strongest time-based read from this report is ${label.toLowerCase()}.`,
      evidence: [
        `The report explicitly states the session began at ${startTime}.`,
        "There is not enough chart structure to override the session-time reading.",
        `${label} is the clearest time persona available from this report format.`
      ]
    };
  }

  if (primaryPersona.name === "Slow-Burn Operator") {
    return {
      label: "Morning Settler",
      window: "Likely early-day",
      summary: "The report reads like a calmer, steadier time-based persona rather than a fast spike persona.",
      evidence: [
        "The strongest language in the report points to settling and runway.",
        "Depth is more visible than speed-only activation.",
        "This usually aligns with earlier, steadier work windows."
      ]
    };
  }

  return {
    label: "Day Carrier",
    window: "Mixed-day load",
    summary: "The report supports a middle-of-day workload persona more than a highly isolated time spike.",
    evidence: [
      "Time signals are not specific enough to override the workload interpretation.",
      "Agility and endurance both remain active.",
      "The day-carrying profile is the best time read from the report."
    ]
  };
}

function inferActivityModifiers(text) {
  const lower = text.toLowerCase();
  const modifiers = [];

  if (/(puzzle|study|lecture|calculation)/i.test(lower)) {
    modifiers.push({
      label: "Activity",
      value: "Study-heavy",
      note: "Study, puzzle, or lecture work seems to reveal the clearest version of this persona."
    });
  }

  if (/(meditation|wellness|calm|reset|recovery)/i.test(lower)) {
    modifiers.push({
      label: "Wellness",
      value: "Calm entry matters",
      note: "The report suggests the user performs better when the session begins from a steadier internal state."
    });
  }

  if (/(focus|deep work|uninterrupted|coherent)/i.test(lower)) {
    modifiers.push({
      label: "Focus",
      value: "Focus amplifies the persona",
      note: "Cleaner focus makes the strongest persona more repeatable."
    });
  }

  if (!modifiers.length) {
    modifiers.push({
      label: "Context",
      value: "Needs more evidence",
      note: "This report gives a primary persona, but not enough clear modifier context yet."
    });
  }

  return modifiers;
}

function inferPrimaryActivity(text, chartSessions) {
  if (chartSessions.length) {
    const bestSession = [...chartSessions].sort((a, b) => b.durationWeighted - a.durationWeighted)[0];
    return bestSession.name;
  }

  const titleMatch = text.match(/Deep Calculation|Puzzles Solving|Polgar Studies|Lecture|Game Against [A-Za-z]+/i);
  return titleMatch ? titleMatch[0] : "Report activity";
}

function classifyActivity(activityName) {
  const lower = activityName.toLowerCase();
  if (lower.includes("puzzle")) return "Puzzles";
  if (lower.includes("polgar")) return "Study";
  if (lower.includes("lecture")) return "Lecture";
  if (lower.includes("game")) return "Games";
  if (lower.includes("calculation")) return "Calculation";
  return "Other";
}

function buildMetricEvidence(reportText, chartSessions, metrics, peakFlow, timePersona) {
  const activity = inferPrimaryActivity(reportText, chartSessions);
  const avgDeepWorkMatch = reportText.match(/Avg Deep Work Duration(\d+)\s*s/i);
  const maxDeepWorkMatch = reportText.match(/Max Deep Work Duration(\d+)\s*s/i);
  const sessionWindowMatch = reportText.match(/from\s+(\d{1,2}:\d{2} [AP]M)\s+to\s+(\d{1,2}:\d{2} [AP]M)/i);
  const dateMatch = reportText.match(/session on ([A-Za-z]+ \d{1,2}, \d{4})/i);
  const sessionWindow = sessionWindowMatch ? `${sessionWindowMatch[1]}-${sessionWindowMatch[2]}` : timePersona.window;
  const sessionDate = dateMatch ? dateMatch[1] : "Date not isolated";

  const findBestSession = (key) =>
    chartSessions.length ? [...chartSessions].sort((a, b) => b[key] - a[key])[0] : null;

  const bestSpeed = findBestSession("speed");
  const bestAgility = findBestSession("agility");
  const bestEndurance = findBestSession("endurance");

  return {
    speed: bestSpeed
      ? {
          metricKey: "speed",
          metricLabel: "Speed",
          activity: bestSpeed.name,
          branch: classifyActivity(bestSpeed.name),
          value: bestSpeed.speed,
          basis: "Fastest chart session",
          comparedTo: `Agility ${bestSpeed.agility} and endurance ${bestSpeed.endurance} in the same session.`,
          timeWindow: `${bestSpeed.time} · ${bestSpeed.duration}`,
          sessionDate: "Representative chart session",
          explanation: `${bestSpeed.name} is the fastest visible session in the chart sample.`,
          source: "Representative sessions chart"
        }
      : {
          metricKey: "speed",
          metricLabel: "Speed",
          activity,
          branch: classifyActivity(activity),
          value: metrics.speed,
          basis: "Report-level cognitive score",
          comparedTo: `Agility ${metrics.agility} and endurance ${metrics.endurance}.`,
          timeWindow: sessionWindow,
          sessionDate,
          explanation: "This report does not expose multiple chart rows, so speed is coming from the headline score.",
          source: "Cognitive Performance Scores"
        },
    agility: bestAgility
      ? {
          metricKey: "agility",
          metricLabel: "Agility",
          activity: bestAgility.name,
          branch: classifyActivity(bestAgility.name),
          value: bestAgility.agility,
          basis: "Best agility chart session",
          comparedTo: `Speed ${bestAgility.speed} and endurance ${bestAgility.endurance} in the same session.`,
          timeWindow: `${bestAgility.time} · ${bestAgility.duration}`,
          sessionDate: "Representative chart session",
          explanation: `${bestAgility.name} shows the best visible adaptability signal in the chart sample.`,
          source: "Representative sessions chart"
        }
      : {
          metricKey: "agility",
          metricLabel: "Agility",
          activity,
          branch: classifyActivity(activity),
          value: metrics.agility,
          basis: "Report-level cognitive score",
          comparedTo: `Speed ${metrics.speed} and endurance ${metrics.endurance}.`,
          timeWindow: sessionWindow,
          sessionDate,
          explanation: "This report does not expose multiple chart rows, so agility is coming from the headline score.",
          source: "Cognitive Performance Scores"
        },
    endurance: bestEndurance
      ? {
          metricKey: "endurance",
          metricLabel: "Endurance",
          activity: bestEndurance.name,
          branch: classifyActivity(bestEndurance.name),
          value: bestEndurance.endurance,
          basis: "Strongest stamina chart session",
          comparedTo: `Speed ${bestEndurance.speed} and agility ${bestEndurance.agility} in the same session.`,
          timeWindow: `${bestEndurance.time} · ${bestEndurance.duration}`,
          sessionDate: "Representative chart session",
          explanation: `${bestEndurance.name} is the clearest sustained-output session in the chart sample.`,
          source: "Representative sessions chart"
        }
      : {
          metricKey: "endurance",
          metricLabel: "Endurance",
          activity,
          branch: classifyActivity(activity),
          value: metrics.endurance,
          basis: "Report-level cognitive score",
          comparedTo: `Speed ${metrics.speed} and agility ${metrics.agility}.`,
          timeWindow: sessionWindow,
          sessionDate,
          explanation: "This report does not expose multiple chart rows, so endurance is coming from the headline score.",
          source: "Cognitive Performance Scores"
        },
    "peak-flow": {
      metricKey: "peak-flow",
      metricLabel: "Peak Flow Duration",
      activity: peakFlow.sessionName || activity,
      branch: classifyActivity(peakFlow.sessionName || activity),
      value: peakFlow.duration,
      basis: peakFlow.basis || "Detected peak flow signal",
      comparedTo: avgDeepWorkMatch
        ? `Average deep work bout: ${formatSeconds(avgDeepWorkMatch[1])}.`
        : chartSessions.length
          ? `Compared against ${chartSessions.length} representative chart sessions.`
          : "No average comparison was isolated from the report.",
      timeWindow: peakFlow.window || sessionWindow,
      sessionDate,
      explanation: peakFlow.reading,
      source: maxDeepWorkMatch ? "Behavioural Metrics" : "Representative sessions chart",
      averageValue: avgDeepWorkMatch ? formatSeconds(avgDeepWorkMatch[1]) : null,
      peakValue: maxDeepWorkMatch ? formatSeconds(maxDeepWorkMatch[1]) : peakFlow.duration
    }
  };
}

function buildActivityBranches(reportText, chartSessions, metricEvidence, timePersona) {
  if (!chartSessions.length) {
    const activity = inferPrimaryActivity(reportText, chartSessions);
    return [
      {
        key: classifyActivity(activity).toLowerCase().replace(/\s+/g, "-"),
        label: classifyActivity(activity),
        activity,
        sessions: 1,
        bestWindow: timePersona.window,
        summary: `${activity} is the only clearly named activity in this report, so the branch is being built from the single-session evidence.`,
        highlights: [
          `Primary activity: ${activity}.`,
          `Time window: ${timePersona.window}.`,
          `Peak flow signal: ${metricEvidence["peak-flow"].value}.`
        ]
      }
    ];
  }

  const groups = new Map();
  for (const session of chartSessions) {
    const label = classifyActivity(session.name);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(session);
  }

  return [...groups.entries()].map(([label, sessions]) => {
    const bestSustained = [...sessions].sort((a, b) => b.durationWeighted - a.durationWeighted)[0];
    const bestSpeed = [...sessions].sort((a, b) => b.speed - a.speed)[0];
    const bestAgility = [...sessions].sort((a, b) => b.agility - a.agility)[0];
    const bestEndurance = [...sessions].sort((a, b) => b.endurance - a.endurance)[0];

    return {
      key: label.toLowerCase().replace(/\s+/g, "-"),
      label,
      activity: bestSustained.name,
      sessions: sessions.length,
      bestWindow: `${bestSustained.time} · ${bestSustained.duration}`,
      summary: `${label} tends to look best when ${bestSustained.name} is active, with its strongest sustained window at ${bestSustained.duration}.`,
      highlights: [
        `Strongest sustained session: ${bestSustained.name} at ${bestSustained.time}.`,
        `Fastest expression: ${bestSpeed.name} at speed ${bestSpeed.speed}.`,
        `Best adaptability: ${bestAgility.name} at agility ${bestAgility.agility}.`,
        `Best stamina: ${bestEndurance.name} at endurance ${bestEndurance.endurance}.`
      ]
    };
  });
}

function inferFocusWellnessImpact(text) {
  const lower = text.toLowerCase();
  const focusMatch = text.match(/focus (?:used|sessions covered)\s+(\d+(?:\.\d+)?)%?/i);
  const wellnessMatch = text.match(/wellness (?:used|sessions covered)\s+(\d+(?:\.\d+)?)%?/i);
  const deepWorkMatch = text.match(/deep work %(\d+(?:\.\d+)?)%/i);
  const recoveryMatch = text.match(/recovery %(\d+(?:\.\d+)?)%/i);
  const focusPercent = focusMatch ? Number(focusMatch[1]) : null;
  const wellnessPercent = wellnessMatch ? Number(wellnessMatch[1]) : null;
  const deepWorkPercent = deepWorkMatch ? Number(deepWorkMatch[1]) : null;
  const recoveryPercent = recoveryMatch ? Number(recoveryMatch[1]) : null;

  const focusEffect =
    focusPercent !== null && focusPercent >= 70
      ? "Most tracked time was spent in focus-heavy work, which likely strengthened depth, steadiness, and the slow-burn persona."
      : "Focus time does not dominate the report strongly enough yet to explain the whole persona by itself.";

  const wellnessEffect =
    wellnessPercent !== null && wellnessPercent > 0
      ? "Wellness time appears to act like a stabilizer. It probably helped the user enter sessions more calmly, even if it was not the main block of time."
      : "Wellness does not appear as a major time investment in this report.";

  const timeSpent = [];

  if (focusPercent !== null) {
    timeSpent.push({
      label: "Focus",
      value: `${focusPercent}%`,
      note: focusEffect
    });
  }

  if (wellnessPercent !== null) {
    timeSpent.push({
      label: "Wellness",
      value: `${wellnessPercent}%`,
      note: wellnessEffect
    });
  }

  if (!timeSpent.length) {
    if (deepWorkPercent !== null) {
      timeSpent.push({
        label: "Deep Work",
        value: `${deepWorkPercent}%`,
        note: "A meaningful part of the session was spent in deep work, which supports the student's stronger analytical or flow-building side."
      });
    }

    if (recoveryPercent !== null) {
      timeSpent.push({
        label: "Recovery",
        value: `${recoveryPercent}%`,
        note: "Recovery time suggests the student needed resets inside the session rather than maintaining one unbroken state."
      });
    }
  }

  if (!timeSpent.length) {
    timeSpent.push({
      label: "Time Mix",
      value: "Not clearly extracted",
      note: "The report did not expose a clean focus versus wellness split, so the app is relying more on qualitative signals."
    });
  }

  const impactSummary =
    focusPercent !== null && wellnessPercent !== null
      ? `The user spent ${focusPercent}% of tracked time in focus work and ${wellnessPercent}% in wellness work. Focus appears to build the main persona, while wellness likely improves entry quality and recovery.`
      : deepWorkPercent !== null && recoveryPercent !== null
        ? `The session spent ${deepWorkPercent}% in deep work and ${recoveryPercent}% in recovery. That suggests a performance pattern built on entering flow, resetting, and re-entering rather than one perfectly flat session.`
      : "The time-spent mix is only partially visible, so the impact read is more directional than precise.";

  return {
    focusPercent,
    wellnessPercent,
    impactSummary,
    timeSpent
  };
}

function buildPeakFlow(chartSessions, timePersona, metrics) {
  if (chartSessions.length) {
    const bestFlowSession = [...chartSessions].sort((a, b) => b.durationWeighted - a.durationWeighted)[0];
    return {
      duration: bestFlowSession.duration,
      sessionName: bestFlowSession.name,
      timePersona: bestFlowSession.timePersona,
      window: bestFlowSession.time,
      basis: "Best sustained session from the chart",
      reading: `${bestFlowSession.duration} looks like the strongest sustained flow window from the chart, driven by ${bestFlowSession.name}.`
    };
  }

  const maxDeepWorkMatch = timePersona.summary.match(/nothing-will-match/); // placeholder to keep structure stable
  void maxDeepWorkMatch;

  return {
    duration: metrics.endurance >= metrics.speed ? "60m+" : "30-45m",
    sessionName: "Derived from report pattern",
    timePersona: timePersona.label,
    window: timePersona.window,
    basis: "Fallback estimate",
    reading: "This is a fallback peak-flow read when the chart is not structured enough to isolate a specific session."
  };
}

function buildPerformanceEngine(metrics, peakFlow) {
  const maxMetric = Math.max(metrics.endurance, metrics.speed, metrics.agility);

  return [
    {
      id: "endurance",
      label: "Endurance",
      score: metrics.endurance,
      width: `${Math.max(28, (metrics.endurance / maxMetric) * 100)}%`,
      reading: "How well the user stays with the work once the session has begun."
    },
    {
      id: "speed",
      label: "Speed",
      score: metrics.speed,
      width: `${Math.max(28, (metrics.speed / maxMetric) * 100)}%`,
      reading: "How quickly the user activates or moves through the work."
    },
    {
      id: "agility",
      label: "Agility",
      score: metrics.agility,
      width: `${Math.max(28, (metrics.agility / maxMetric) * 100)}%`,
      reading: "How flexibly the user adapts inside the work without breaking it."
    },
    {
      id: "peak-flow",
      label: "Peak Flow Duration",
      score: peakFlow.duration,
      width: "100%",
      reading: peakFlow.reading
    }
  ];
}

function buildCoaching(primaryPersona, timePersona, peakFlow, metrics) {
  const enduranceLed = metrics.endurance >= metrics.speed && metrics.endurance >= metrics.agility - 3;

  return {
    title: `Coach ${primaryPersona.name}`,
    body: `${primaryPersona.name} is the main identity, but ${timePersona.label} is the strongest time-based expression from the report. ${peakFlow.duration} is the clearest flow-duration cue to protect.`,
    steps: [
      enduranceLed ? "Protect the longer, calmer flow windows first." : "Use the quicker windows intentionally rather than by default.",
      `Bias coaching toward ${timePersona.label.toLowerCase()} when you want the strongest version of the user.`,
      `Use ${peakFlow.duration} as the first duration target when building repeatable sessions.`
    ]
  };
}

function withIndefiniteArticle(value) {
  return /^[aeiou]/i.test(value) ? `an ${value}` : `a ${value}`;
}

function evaluatePersonaFromReport({ userName, reportText, ocrText = "", originalFileName }) {
  const cleanedReportText = normaliseReportText(reportText);
  const metrics = buildMetricSummary(cleanedReportText);
  const chartSessions = mergeChartSessions(extractChartSessions(cleanedReportText), extractChartSessionsFromOcr(ocrText));
  const primaryPersona = inferPrimaryPersona(cleanedReportText, metrics, chartSessions);
  const reportCoverage = extractReportCoverage(cleanedReportText, chartSessions);
  const timePersona = inferTimePersona(cleanedReportText, chartSessions, primaryPersona);
  const maxDeepWorkMatch = cleanedReportText.match(/Max Deep Work Duration(\d+)\s*s/i);
  const peakFlow = chartSessions.length
    ? buildPeakFlow(chartSessions, timePersona, metrics)
    : maxDeepWorkMatch
      ? {
          duration: `${Math.floor(Number(maxDeepWorkMatch[1]) / 60)}m ${String(Number(maxDeepWorkMatch[1]) % 60).padStart(2, "0")}s`,
          sessionName: "Max Deep Work Duration",
          timePersona: timePersona.label,
          window: timePersona.window,
          basis: "Max uninterrupted deep work bout",
          reading: `The clearest peak-flow signal in this report is the max uninterrupted deep work bout of ${Math.floor(Number(maxDeepWorkMatch[1]) / 60)}m ${String(Number(maxDeepWorkMatch[1]) % 60).padStart(2, "0")}s.`
        }
      : buildPeakFlow(chartSessions, timePersona, metrics);
  const modifiers = inferActivityModifiers(cleanedReportText);
  const focusWellnessImpact = inferFocusWellnessImpact(cleanedReportText);
  const performanceEngine = buildPerformanceEngine(metrics, peakFlow);
  const coaching = buildCoaching(primaryPersona, timePersona, peakFlow, metrics);
  const metricEvidence = buildMetricEvidence(cleanedReportText, chartSessions, metrics, peakFlow, timePersona);
  const activityBranches = buildActivityBranches(cleanedReportText, chartSessions, metricEvidence, timePersona);

  return {
    userName,
    reportTitle: originalFileName,
    summary: `${userName}'s report suggests ${withIndefiniteArticle(primaryPersona.name)} core, ${withIndefiniteArticle(timePersona.label)} time persona, and a peak flow duration around ${peakFlow.duration}.`,
    primaryPersona,
    timePersona,
    peakFlow,
    performanceEngine,
    modifiers,
    focusWellnessImpact,
    coaching,
    chartSessions,
    reportCoverage,
    metricEvidence,
    activityBranches,
    extractedSignals: {
      endurance: metrics.endurance,
      speed: metrics.speed,
      agility: metrics.agility
    }
  };
}

module.exports = { evaluatePersonaFromReport };
