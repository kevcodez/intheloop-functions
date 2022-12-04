import { ChangelogFormat, ParsedChangelog } from "../changelogScraper";
import { remark } from "remark";
import { Root } from "mdast";

export class MarkdownSanitizer {
  async sanitize(changelog: ParsedChangelog): Promise<string> {
    const tree = await remark().parse(changelog.changes);

    this.removeHeading(tree, "Checksums");

    return remark().stringify(tree);
  }

  private removeHeading(tree: Root, heading: string) {
    const idxHeading = tree.children.findIndex(
      // @ts-ignore
      (it) => it.type === "heading" || it.children?.[0]?.value === heading
    );

    if (idxHeading !== -1) {
      const nextHeading = tree.children.findIndex(
        (it, idx) => it.type === "heading" && idx > idxHeading
      );

      const endIndex =
        nextHeading === -1 ? tree.children.length - 1 : nextHeading;

      tree.children.splice(idxHeading, endIndex - idxHeading + 1);
    }
  }

  format(): ChangelogFormat {
    return ChangelogFormat.MARKDOWN;
  }
}

export const markdownSanitizer = new MarkdownSanitizer();
