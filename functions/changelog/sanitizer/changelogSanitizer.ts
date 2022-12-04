import { ChangelogFormat, ParsedChangelog } from "../changelogScraper";
import { Root } from "mdast";
import { markdownSanitizer } from "./markdownSanitizer";

export class ChangelogSanitizer {
  async sanitize(changelog: ParsedChangelog): Promise<string> {
    switch (changelog.format) {
        case ChangelogFormat.MARKDOWN:
            return markdownSanitizer.sanitize(changelog)
    }
  }

  removeHeading(tree: Root, heading: string) {
    const idxHeading = tree.children.findIndex(
      // @ts-ignore
      (it) => it.type === "heading" || it.children?.[0]?.value === heading
    );

    console.log(idxHeading);

    if (idxHeading !== -1) {
      const nextHeading = tree.children.findIndex(
        (it, idx) => it.type === "heading" && idx > idxHeading
      );

      const endIndex =
        nextHeading === -1 ? tree.children.length - 1 : nextHeading;

      console.log(endIndex - idxHeading);

      tree.children.splice(idxHeading, endIndex - idxHeading + 1);
    }
  }
}

export const changelogSanitizer = new ChangelogSanitizer();
