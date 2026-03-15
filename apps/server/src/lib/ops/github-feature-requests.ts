import { getServerEnv } from "../env";

export type FeatureRequestGithubIssueInput = {
  title: string;
  body: string;
};

export type FeatureRequestGithubIssueResult =
  | {
      status: "created";
      issueNumber: number;
      issueUrl: string;
    }
  | {
      status: "skipped";
      reason: "unconfigured";
    }
  | {
      status: "failed";
      error: string;
    };

export async function createFeatureRequestGithubIssue(
  input: FeatureRequestGithubIssueInput
): Promise<FeatureRequestGithubIssueResult> {
  const env = getServerEnv();

  if (
    !env.GITHUB_FEATURE_REQUEST_TOKEN ||
    !env.GITHUB_FEATURE_REQUEST_OWNER ||
    !env.GITHUB_FEATURE_REQUEST_REPO
  ) {
    return {
      status: "skipped",
      reason: "unconfigured",
    };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${env.GITHUB_FEATURE_REQUEST_OWNER}/${env.GITHUB_FEATURE_REQUEST_REPO}/issues`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${env.GITHUB_FEATURE_REQUEST_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "profitabledge-feature-request-bot",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title: input.title,
          body: input.body,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();

      return {
        status: "failed",
        error: `GitHub API ${response.status}: ${errorBody.slice(0, 400)}`,
      };
    }

    const data = (await response.json()) as {
      html_url?: string;
      number?: number;
    };

    if (!data.html_url || typeof data.number !== "number") {
      return {
        status: "failed",
        error: "GitHub API response did not include an issue number and URL.",
      };
    }

    return {
      status: "created",
      issueNumber: data.number,
      issueUrl: data.html_url,
    };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error
          ? error.message
          : "Unknown GitHub issue creation failure",
    };
  }
}
