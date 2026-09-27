export const INJECTION_PATTERNS = [
  {
    code: "IGNORE_PRIOR_INSTRUCTIONS",
    severity: "high",
    pattern:
      /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?)\b/gi,
    message: "Attempt to override system or planner instructions.",
  },
  {
    code: "ROLE_OVERRIDE",
    severity: "high",
    pattern:
      /\b(you are now|act as|pretend to be|simulate being)\s+(an?\s+)?(ai|assistant|agent|trader|admin|system)\b/gi,
    message: "Role-play instruction embedded in external content.",
  },
  {
    code: "SYSTEM_PROMPT_LEAK",
    severity: "high",
    pattern: /\b(system\s*prompt|developer\s*message|hidden\s*instructions?)\b/gi,
    message: "Reference to hidden or system prompts.",
  },
  {
    code: "CHAT_MARKUP",
    severity: "high",
    pattern: /<\s*\/?\s*(system|assistant|user|human|tool)\s*>|\[\s*INST\s*\]|<\|im_start\|>/gi,
    message: "Chat-template markup often used for injection.",
  },
  {
    code: "TRADE_COMMAND",
    severity: "high",
    pattern:
      /\b(buy|sell|short|liquidate|execute)\s+(all|every|maximum|100%|immediately|now)\b|\bplace\s+(a\s+)?(market|limit)\s+order\b/gi,
    message: "Direct trade execution language in untrusted content.",
  },
  {
    code: "PLANNER_OVERRIDE",
    severity: "high",
    pattern:
      /\b(override|bypass|disable)\s+(the\s+)?(planner|risk\s*controls?|budget\s*limit|allowed\s*symbols?)\b/gi,
    message: "Attempt to bypass planner or risk constraints.",
  },
  {
    code: "JSON_INSTRUCTION_BLOCK",
    severity: "medium",
    pattern: /```(?:json)?\s*\{[\s\S]{0,400}?(?:"action"|"side"|"order"|"execute")[\s\S]{0,400}?\}```/gi,
    message: "Structured command block inside narrative content.",
  },
  {
    code: "URGENCY_MANIPULATION",
    severity: "medium",
    pattern:
      /\b(must\s+trade|do\s+not\s+wait|urgent\s+buy|guaranteed\s+profit|ignore\s+risk|all\s+in\s+now)\b/gi,
    message: "High-pressure language that may manipulate agent behavior.",
  },
];

export function findInjectionMatches(text) {
  if (!text || typeof text !== "string") return [];

  const findings = [];
  for (const rule of INJECTION_PATTERNS) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const excerpt = match[0].slice(0, 160);
      findings.push({
        code: rule.code,
        severity: rule.severity,
        message: rule.message,
        matchedExcerpt: excerpt,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  findings.sort((a, b) => a.start - b.start);
  return dedupeOverlapping(findings);
}

function dedupeOverlapping(findings) {
  const kept = [];
  for (const f of findings) {
    const overlaps = kept.some((k) => f.start < k.end && f.end > k.start);
    if (!overlaps) kept.push(f);
  }
  return kept;
}
