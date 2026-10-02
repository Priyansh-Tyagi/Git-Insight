/* eslint-disable camelcase */

// ai_summary (text) and ai_grounding_warnings (jsonb) from migration 006 are
// kept as-is for backward compatibility with any rows generated before this
// migration. ai_summary_structured stores the raw {headline, signalNotes,
// closing} object the model returned — the source of truth the deterministic
// grounding check (checkStructuredSummary) runs against. ai_summary itself
// now stores a template-rendered version of that structured data (see
// renderStructuredSummary in aiSummary.service.ts) rather than raw LLM prose,
// so existing readers of ai_summary keep working unchanged.
exports.up = (pgm) => {
  pgm.addColumn('repositories', {
    ai_summary_structured: { type: 'jsonb' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('repositories', ['ai_summary_structured']);
};
