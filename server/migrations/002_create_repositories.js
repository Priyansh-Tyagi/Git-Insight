/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('repositories', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'cascade' },
    github_repo_id: { type: 'bigint', notNull: true },
    name: { type: 'text', notNull: true },
    full_name: { type: 'text', notNull: true },
    description: { type: 'text' },
    is_fork: { type: 'boolean', notNull: true, default: false },
    stargazer_count: { type: 'integer', notNull: true, default: 0 },
    language_stats: { type: 'jsonb' },       // { "TypeScript": 60000, "CSS": 12000 } (bytes, from GraphQL)
    raw_metadata: { type: 'jsonb' },          // pushed_at, size, url, default_branch, etc.
    last_analyzed_at: { type: 'timestamp' },  // set later in Phase 4, null for now
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('repositories', 'repositories_user_github_repo_unique', {
    unique: ['user_id', 'github_repo_id'],
  });

  pgm.addColumn('users', {
    last_synced_at: { type: 'timestamp' },
    profile_json: { type: 'jsonb' }, // raw cached profile snapshot (bio, followers, public_repos count, etc.)
  });

  pgm.createIndex('repositories', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropColumn('users', ['last_synced_at', 'profile_json']);
  pgm.dropTable('repositories');
};
