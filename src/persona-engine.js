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

function buildMetricSummary(reportText) {
  const enduranceCandidates = extractNumbers(reportText, [
    /best endurance[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /endurance[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /stamina[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /staying power[^0-9]{0,20}(\d+(?:\.\d+)?)/gi
  ]);

  const speedCandidates = extractNumbers(reportText, [
    /fastest session at[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /speed peaked at[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /speed[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /quick(?:ness)?[^0-9]{0,20}(\d+(?:\.\d+)?)/gi
  ]);

  const agilityCandidates = extractNumbers(reportText, [
    /highest agility[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /agility[^0-9]{0,20}(\d+(?:\.\d+)?)/gi,
    /adapt(?:ability)?[^0-9]{0,20}(\d+(?:\.\d+)?)/gi
  ]);

  return {
    endurance: enduranceCandidates.length ? Math.max(...enduranceCandidates) : 48,
    speed: speedCandidates.length ? Math.max(...speedCandidates) : 44,
    agility: agilityCandidates.length ? Math.max(...agilityCandidates) : 46
  };
}

function inferTimePersona(text, metrics) {
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

  if (lower.includes("morning") && metrics.endurance >= metrics.speed) {
    return {
      name: "Slow-Burn Operator",
      angle: "Morning depth",
      summary: "Best when given a calmer start and enough runway to settle into the work.",
      evidence: [
        "Morning references were present in the report.",
        "Endurance appears stronger than raw opening speed.",
        "The report language suggests performance improves after settling in."
      ]
    };
  }

  if (lower.includes("evening") && metrics.speed > metrics.endurance) {
    return {
      name: "Evening Spark",
      angle: "Sharpness window",
      summary: "Looks quickest later in the day, especially when the work is shorter or more technical.",
      evidence: [
        "Evening references were present in the report.",
        "Speed appears stronger than endurance.",
        "The report signals faster activation than long-form staying power."
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

function inferActivityModifiers(text) {
  const lower = text.toLowerCase();
  const modifiers = [];

  if (/(puzzle|study|lecture|calculation)/i.test(lower)) {
    modifiers.push({
      label: "Activity",
      value: "Study-heavy",
      note: "The report points toward study, puzzle, or lecture contexts as good persona-reveal environments."
    });
  }

  if (/(meditation|wellness|calm|reset|recovery)/i.test(lower)) {
    modifiers.push({
      label: "Wellness",
      value: "Calm entry matters",
      note: "The report suggests the user performs better when the session starts from a steadier internal state."
    });
  }

  if (/(focus|deep work|uninterrupted|coherent)/i.test(lower)) {
    modifiers.push({
      label: "Focus",
      value: "Focus amplifies the persona",
      note: "The report language suggests cleaner focus makes the strongest persona more repeatable."
    });
  }

  if (!modifiers.length) {
    modifiers.push({
      label: "Context",
      value: "Needs more evidence",
      note: "This report gives enough material for a primary persona, but not enough clear context markers yet."
    });
  }

  return modifiers;
}

function buildCoaching(primaryPersona, metrics) {
  const isEnduranceLed = metrics.endurance >= metrics.speed && metrics.endurance >= metrics.agility - 3;
  const focus = isEnduranceLed ? "Protect longer, calmer work blocks." : "Use the quicker windows intentionally, not by default.";

  return {
    title: `Coach ${primaryPersona.name}`,
    body: `${primaryPersona.name} is the strongest detected persona from this report. The coaching side should help the user lean into that version rather than forcing a style that the report does not support.`,
    steps: [
      focus,
      "Use the proof points below to explain why this persona was detected.",
      "Compare future uploads against this persona to see whether it is becoming more stable or changing."
    ]
  };
}

function buildPerformanceEngine(metrics) {
  return [
    {
      id: "endurance",
      label: "Endurance",
      score: metrics.endurance,
      reading: "How well the user stays with the work once the session has begun."
    },
    {
      id: "speed",
      label: "Speed",
      score: metrics.speed,
      reading: "How quickly the user activates or moves through the work."
    },
    {
      id: "agility",
      label: "Agility",
      score: metrics.agility,
      reading: "How flexibly the user adapts inside the work without breaking it."
    }
  ];
}

function evaluatePersonaFromReport({ userName, reportText, originalFileName }) {
  const metrics = buildMetricSummary(reportText);
  const primaryPersona = inferTimePersona(reportText, metrics);
  const modifiers = inferActivityModifiers(reportText);
  const performanceEngine = buildPerformanceEngine(metrics);
  const coaching = buildCoaching(primaryPersona, metrics);

  return {
    userName,
    reportTitle: originalFileName,
    summary: `${userName}'s report most strongly suggests a ${primaryPersona.name} persona with ${primaryPersona.angle.toLowerCase()} and a ${metrics.endurance >= metrics.speed ? "staying-power" : "quick-activation"} bias.`,
    primaryPersona,
    performanceEngine,
    modifiers,
    coaching,
    extractedSignals: {
      endurance: metrics.endurance,
      speed: metrics.speed,
      agility: metrics.agility
    }
  };
}

module.exports = { evaluatePersonaFromReport };
