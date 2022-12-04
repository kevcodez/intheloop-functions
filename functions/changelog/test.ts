import { changelogScrapingService } from "./changelogScrapingService";

(async () => {
  const changelog = await changelogScrapingService.scrape(
    {
      changelogScrapingStrategySettings: {
        strategy: "github-release",
        meta: {
          githubOwner: "JetBrains",
          githubRepo: "kotlin",
        },
      },
      id: "kotlin",
      scm: {
        type: "github",
        url: "https://github.com/JetBrains/kotlin",
      },
    },
    {
      id: "123",
      releaseNotesUrl:
        "https://github.com/JetBrains/kotlin/releases/tag/v1.7.22",
      version: "1.7.22",
      tag: "v1.7.22",
    }
  );

  console.log(changelog);
})();
