import { graphql } from '@octokit/graphql';

/**
 * Returns a GraphQL client authenticated as the specific user whose
 * (decrypted) access token is passed in. We never use a single shared
 * token — every sync happens on behalf of the logged-in user, using
 * their own OAuth token, so rate limits are per-user, not global.
 */
export function githubGraphqlClient(accessToken: string) {
  return graphql.defaults({
    headers: {
      authorization: `token ${accessToken}`,
    },
  });
}
