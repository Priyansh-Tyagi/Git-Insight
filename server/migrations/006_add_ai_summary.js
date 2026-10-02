/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.addColumn('repositories', {
    ai_summary: { type: 'text' },
    ai_summary_generated_at: { type: 'timestamp' },
    ai_grounding_warnings: { type: 'jsonb' }, // ClaimCheck[] where contradicted === true, if any
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('repositories', ['ai_summary', 'ai_summary_generated_at', 'ai_grounding_warnings']);
};
