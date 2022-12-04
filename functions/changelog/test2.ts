import { changelogScrapingService } from "./changelogScrapingService";

(async () => {
  const changelog = await changelogScrapingService.scrape(
    {
      changelogScrapingStrategySettings: {
        strategy: "markdown-file",
        meta: {
          markdownFile:
            "https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/CHANGELOG.md",
        },
      },
      id: "vite",
      scm: {
        type: "github",
        url: "https://github.com/vitejs/vite",
      },
    },
    {
      id: "123",
      version: "3.0.0",
      tag: "3.0.0",
    }
  );

  console.log(changelog);
})();
