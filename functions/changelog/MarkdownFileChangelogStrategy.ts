import {
  ChangelogFormat,
  ChangelogScraperStrategy,
  ParsedChangelog,
  Release,
  Topic,
} from "./changelogScraper";
import { remark } from "remark";
import { version } from "cheerio";
import { isGcsTfliteModelOptions } from "firebase-admin/lib/machine-learning/machine-learning-api-client";

export class MarkdownFileChangelogStrategy implements ChangelogScraperStrategy {
  async parseChangelog(
    topic: Topic,
    release: Release
  ): Promise<ParsedChangelog | null> {
    const releaseNotes = await fetch(
      topic.changelogScrapingStrategySettings.meta.markdownFile!
    ).then((res) => res.text());

    const tree = remark().parse(releaseNotes);

    const versionHeading = tree.children.findIndex(
      (it) =>
        it.type === "heading" &&
        it.children?.[0].value?.includes(release.version + " ")
    );
    if (versionHeading === -1) return null;

    const heading = tree.children[versionHeading];
    const nextHeadingIdx = tree.children.findIndex(
      (val, idx) =>
        val.type === "heading" &&
        idx > versionHeading &&
        val.depth <= heading.depth
    );

    const lastIndex =
      nextHeadingIdx === -1 ? tree.children.length : nextHeadingIdx;

    tree.children = tree.children.splice(
      versionHeading,
      lastIndex - versionHeading + 1
    );

    return {
      changes: remark().stringify(tree),
      format: ChangelogFormat.MARKDOWN,
    };
  }

  strategy(): string {
    return "markdown-file";
  }
}

export const markdownFileChangelogStrategy =
  new MarkdownFileChangelogStrategy();
