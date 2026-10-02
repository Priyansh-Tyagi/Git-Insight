/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true }); // for gen_random_uuid()

  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    github_id: { type: 'bigint', notNull: true, unique: true },
    username: { type: 'text', notNull: true },
    avatar_url: { type: 'text' },
    access_token_enc: { type: 'text', notNull: true }, // AES-256-GCM ciphertext, never plaintext
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
