/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.addColumn('repositories', {
    // Array of { skill, via[] } read from dependency files. NULL means "not scanned (or scan failed)";
    // [] means "scanned, nothing recognised" — the two must never be confused.
    detected_frameworks: { type: 'jsonb' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('repositories', 'detected_frameworks');
};
