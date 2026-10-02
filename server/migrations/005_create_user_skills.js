/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('user_skills', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'cascade' },
    skill: { type: 'text', notNull: true },
    category: { type: 'text', notNull: true },
    strength_score: { type: 'integer', notNull: true },
    trend: { type: 'text', notNull: true }, // 'growing' | 'stable' | 'stale'
    repo_count: { type: 'integer', notNull: true },
    evidence_repo_ids: { type: 'jsonb', notNull: true },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('user_skills', 'user_skills_user_skill_unique', {
    unique: ['user_id', 'skill'],
  });

  pgm.createIndex('user_skills', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('user_skills');
};
