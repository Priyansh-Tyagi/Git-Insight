/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.addColumn('repositories', {
    commit_pattern_json: { type: 'jsonb' }, // raw AuthenticitySignalInput, for auditability
    authenticity_flag: { type: 'text' }, // 'likely_original' | 'possible_tutorial_clone' | 'insufficient_data'
    authenticity_evidence: { type: 'jsonb' }, // array of AuthenticitySignalResult
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('repositories', ['commit_pattern_json', 'authenticity_flag', 'authenticity_evidence']);
};
