import 'dotenv/config';
import { afterAll } from 'vitest';
import { pool } from '../config/db';

afterAll(async () => {
  await pool.end();
});
