import { githubGraphqlClient } from '../config/githubGraphql';

export interface GithubSyncResult {
  profile: {
    login: string;
    name: string | null;
    avatarUrl: string;
    bio: string | null;
    followers: number;
    publicRepos: number;
  };
  repos: Array<{
    githubRepoId: string;
    name: string;
    fullName: string;
    description: string | null;
    isFork: boolean;
    stargazerCount: number;
    languages: Record<string, number>; // { "TypeScript": 60000, ... } — bytes
    pushedAt: string;
    size: number;
    defaultBranch: string;
  }>;
  rateLimit: {
    remaining: number;
    resetAt: string;
  };
}

/**
 * ONE GraphQL round trip that pulls:
 *  - viewer profile
 *  - up to 100 repos (owned, non-archived), each with:
 *      - basic metadata
 *      - top 10 languages by byte-size
 *  - the rate-limit envelope (so we always know remaining/reset without a separate call)
 *
 * This replaces what would be 1 (user) + N (per-repo languages) REST calls.
 * For a user with 40 repos, that's 41 REST calls vs. 1 GraphQL call.
 */
const BULK_SYNC_QUERY = /* GraphQL */ `
  query BulkSync($first: Int!) {
    viewer {
      login
      name
      avatarUrl
      bio
      followers {
        totalCount
      }
      repositories(
        first: $first
        ownerAffiliations: OWNER
        isFork: false
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes {
          databaseId
          name
          nameWithOwner
          description
          isFork
          stargazerCount
          pushedAt
          diskUsage
          defaultBranchRef {
            name
          }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
              }
            }
          }
        }
      }
      repositoriesContributedTo {
        totalCount
      }
    }
    rateLimit {
      remaining
      resetAt
    }
  }
`;

export async function fetchProfileAndRepos(accessToken: string): Promise<GithubSyncResult> {
  const client = githubGraphqlClient(accessToken);

  const data: any = await client(BULK_SYNC_QUERY, { first: 100 });

  const viewer = data.viewer;

  const repos = viewer.repositories.nodes.map((node: any) => {
    const languages: Record<string, number> = {};
    for (const edge of node.languages.edges) {
      languages[edge.node.name] = edge.size;
    }

    return {
      githubRepoId: node.databaseId?.toString(),
      name: node.name,
      fullName: node.nameWithOwner,
      description: node.description,
      isFork: node.isFork,
      stargazerCount: node.stargazerCount,
      languages,
      pushedAt: node.pushedAt,
      size: node.diskUsage,
      defaultBranch: node.defaultBranchRef?.name ?? 'main',
    };
  });

  return {
    profile: {
      login: viewer.login,
      name: viewer.name,
      avatarUrl: viewer.avatarUrl,
      bio: viewer.bio,
      followers: viewer.followers.totalCount,
      publicRepos: repos.length,
    },
    repos,
    rateLimit: {
      remaining: data.rateLimit.remaining,
      resetAt: data.rateLimit.resetAt,
    },
  };
}
