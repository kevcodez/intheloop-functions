import {
  ChangelogScraperStrategy,
  ParsedChangelog,
  Release,
  Topic,
} from "./changelogScraper";
import { githubChangelogStrategy } from "./GithubReleaseChangelogStrategy copy";
import { markdownFileChangelogStrategy } from "./MarkdownFileChangelogStrategy";
import {
  changelogSanitizer,
  ChangelogSanitizer,
} from "./sanitizer/changelogSanitizer";

class ChangelogScrapingService {
  constructor(
    private scrapingStrategies: ChangelogScraperStrategy[],
    private changelogSanitizer: ChangelogSanitizer
  ) {}

  async scrape(
    topic: Topic,
    release: Release
  ): Promise<ParsedChangelog | null> {
    const matchingStrategy = this.scrapingStrategies.find(
      (it) => it.strategy() === topic.changelogScrapingStrategySettings.strategy
    );

    const changelog = await matchingStrategy!.parseChangelog(topic, release);
    if (changelog?.changes) {
      changelog.changes = await this.changelogSanitizer.sanitize(changelog);
    }

    return changelog;
  }
}

export const changelogScrapingService = new ChangelogScrapingService(
  [githubChangelogStrategy, markdownFileChangelogStrategy],
  changelogSanitizer
);
