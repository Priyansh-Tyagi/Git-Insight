import axios from 'axios';
import { createApp } from './app';
import { env } from './config/env';

// Never let a stalled GitHub/Gemini connection hang a request (and a server worker) forever.
axios.defaults.timeout = 20_000;

const app = createApp();

app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
});
