import {
  ChangelogFormat,
  ChangelogScraperStrategy,
  ParsedChangelog,
  Release,
  Topic,
} from "./changelogScraper";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit();

export class GithubReleaseChangelogStrategy implements ChangelogScraperStrategy {
  async parseChangelog(
    topic: Topic,
    release: Release
  ): Promise<ParsedChangelog | null> {
    const ghRelease = await octokit.repos.getReleaseByTag({
      owner: topic.changelogScrapingStrategySettings.meta.githubOwner!,
      repo: topic.changelogScrapingStrategySettings.meta.githubRepo!,
      tag: release.tag!,
    });

    if (!ghRelease.data.body) {
      return null;
    }

    return {
      changes: ghRelease.data.body,
      format: ChangelogFormat.MARKDOWN,
    };
  }

  strategy(): string {
    return "github-release";
  }
}

export const githubChangelogStrategy = new GithubReleaseChangelogStrategy();
