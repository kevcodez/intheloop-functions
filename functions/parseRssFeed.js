const cheerio = require("cheerio");
const Parser = require("rss-parser");

const parser = new Parser({
  customFields: {
    item: ["description", "id"],
  },
});

async function parseRssFeed(feedUrl) {
  const feed = await parser.parseURL(feedUrl);

  
  return feed.items.map((item) => {
    const summary = item.description || item.summary || item.content

    return {
      title: item.title,
      link: item.link,
      image: getImageUrl(summary) || null,
      publishedAt: item.isoDate, // pubDate
      writtenBy: item.creator || item.author,
      guid: item.guid || item.id, 
      summary,
      categories: item.categories || [],
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
