const cheerio = require("cheerio");
const Parser = require("rss-parser");

const parser = new Parser({
  customFields: {
    item: ["description"],
  },
});

async function parseRssFeed(feedUrl) {
  const feed = await parser.parseURL(feedUrl);

  return feed.items.map((item) => {
    return {
      title: item.title,
      link: item.link,
      image: getImageUrl(item.summary) || null,
      publishedAt: item.isoDate,
      writtenBy: item.creator,
      guid: item.guid,
      summary: item.description,
      categories: item.categories,
    };
  });
}

function getImageUrl(description) {
  if (!description) {
    return null;
  }
  const $ = cheerio.load(description);

  return $("img").attr("src");
}

module.exports = {
  parseRssFeed,
};
