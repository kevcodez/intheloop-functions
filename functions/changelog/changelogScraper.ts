export interface ChangelogScraperStrategy {
  parseChangelog(topic: Topic, release: Release): Promise<ParsedChangelog | null>;

  strategy(): string
}

export interface Topic {
  id: string;
  changelogScrapingStrategySettings: ChangelogScrapingStrategySettings
  scm: { url: string; type: string };
}

export interface ChangelogScrapingStrategySettings {
  strategy: string
  meta: {
    githubOwner?: string
    githubRepo?: string
    markdownFile?: string
  }
}

export interface Release {
  id: string;
  version: string;
  tag?: string;
  releaseNotesUrl?: string;
}

export interface ParsedChangelog {
  changes: string;
  format: ChangelogFormat;
  releaseNotesUrl?: string;
}

export enum ChangelogFormat {
  MARKDOWN = "markdown",
}
