const functions = require("firebase-functions");
const Twitter = require("twitter-lite");
const { supabase } = require("./supabase");

function getTwitterClientV2() {
  return new Twitter({
    version: "2",
    extension: false,
    consumer_key: functions.config().twitter.consumer_key,
    consumer_secret: functions.config().twitter.consumer_secret,
    bearer_token: functions.config().twitter.bearer_token,
  });
}

async function retrieveTweetsWithUserData(topic, page) {
  const client = getTwitterClientV2();
  const pageSize = 20;
  const pageStart = (page - 1) * pageSize;
  const { data: tweetsFromSupabase, error, count } = await supabase
    .from("tweets")
    .select("id", { count: "exact" })
    .containedBy("topics", topic.split(','))
    .range(pageStart, pageStart + pageSize - 1)
    .limit(25)
    .order(`created_at`, { ascending: false });

  if (error) {
    functions.logger.error(error);
  }

  const hasMore = count > tweetsFromSupabase.length;

  const tweetIds = tweetsFromSupabase.map((it) => it.id);

  let tweetsWithUser = [];

  if (tweetIds.length) {
    const params = {
      "tweet.fields": "public_metrics,created_at,entities",
      "user.fields": "profile_image_url",
      "media.fields": "preview_image_url",
      ids: tweetIds,
      expansions: "author_id,attachments.media_keys",
    };

    const baseUrl = "tweets";
    const queryParams = Object.keys(params)
      .filter((it) => params[it])
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join("&");

    const fullUrl = baseUrl + "?" + queryParams;

    functions.logger.info("Requesting twitter", { fullUrl });

    const { data, includes } = await client.get(fullUrl);

    tweetsWithUser = data.map((tweet) => {
      return {
        user: includes.users.find((it) => it.id === tweet.author_id),
        includes,
        ...tweet,
      };
    });
  }

  return {
    tweets: tweetsWithUser,
    currentPage: page,
    hasMore,
    count,
  };
}

module.exports = {
  retrieveTweetsWithUserData,
};
