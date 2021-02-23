const Parser = require("rss-parser");
const parser = new Parser({
  customFields: {
    item: ["description"],
  }
});

async function parseRssFeed(feedUrl) {
  const feed = await parser.parseURL(feedUrl);

  return feed.items.map((item) => {
    return {
      title: item.title,
      link: item.link,
      image: null,
      publishedAt: item.isoDate,
      writtenBy: item.creator,
      guid: item.guid,
      summary: item.description,
      categories: item.categories
    };
  });
}

function getImageUrl(description) {
  let cleanUrl = "";
  if (description.indexOf(".png") > 0)
    cleanUrl = description.substring(
      description.indexOf("src=") + 5,
      description.indexOf(".png") + 4
    );
  else if (description.indexOf(".jpg") > 0) {
    cleanUrl = description.substring(
      description.indexOf("src=") + 5,
      description.indexOf(".jpg") + 4
    );
  } else if (description.indexOf(".jpeg") > 0) {
    cleanUrl = description.substring(
      description.indexOf("src=") + 5,
      description.indexOf(".jpeg") + 5
    );
  } else if (description.indexOf(".gif") > 0) {
    cleanUrl = description.substring(
      description.indexOf("src=") + 5,
      description.indexOf(".gif") + 4
    );
  } else if (description.indexOf(".bmp") > 0) {
    cleanUrl = description.substring(
      description.indexOf("src=") + 5,
      description.indexOf(".bmp") + 4
    );
  } else {
    cleanUrl = null;
  }
  return cleanUrl;
}

module.exports = {
  parseRssFeed,
};
