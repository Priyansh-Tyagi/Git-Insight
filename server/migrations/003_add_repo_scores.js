/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.addColumn('repositories', {
    engineering_score: { type: 'integer' },
    score_breakdown: { type: 'jsonb' }, // array of SignalResult
    strengths: { type: 'jsonb' }, // string[]
    weaknesses: { type: 'jsonb' }, // string[]
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('repositories', ['engineering_score', 'score_breakdown', 'strengths', 'weaknesses']);
};
