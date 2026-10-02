import axios from 'axios';
import { env } from './env';

export interface GithubOAuthProfile {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

/**
 * Exchanges the OAuth `code` GitHub sent back to our callback for a real
 * access token. This is a server-to-server call — the frontend never sees
 * the client secret or the token itself.
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      code,
      redirect_uri: env.githubCallbackUrl,
    },
    { headers: { Accept: 'application/json' } }
  );

  if (res.data.error) {
    throw new Error(`GitHub OAuth error: ${res.data.error_description ?? res.data.error}`);
  }

  return res.data.access_token as string;
}

export async function fetchGithubProfile(accessToken: string): Promise<GithubOAuthProfile> {
  const res = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `token ${accessToken}` },
  });
  return res.data;
}
