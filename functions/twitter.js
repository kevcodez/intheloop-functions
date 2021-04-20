const functions = require("firebase-functions");
const Twitter = require("twitter-lite");
const { asyncForEach } = require("./asyncForEach");
const { supabase } = require("./supabase");
const { Bugsnag } = require("./bugsnag");

function getTwitterClientV2() {
  return new Twitter({
    version: "2",
    extension: false,
    consumer_key: functions.config().twitter.consumer_key,
    consumer_secret: functions.config().twitter.consumer_secret,
    bearer_token: functions.config().twitter.bearer_token,
  });
}

function getTwitterClientV1() {
  return new Twitter({
    version: "1.1",
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
    .cs("topics", [topic])
    .range(pageStart, pageStart + pageSize - 1)
    .limit(25)
    .order(`created_at`, { ascending: false });

  if (error) {
    functions.logger.error(error);
    Bugsnag.notify(error);
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

async function refreshPopularTweets() {
  const { data: allSearches, error } = await supabase
    .from("twitter_search")
    .select("*");

  if (error) {
    functions.logger.error(error);
    Bugsnag.notify(error);
  }

  await asyncForEach(
    allSearches,
    async (tweetSearch) => await saveNewPopularTweets(tweetSearch)
  );
}

async function saveNewPopularTweets(tweetSearch) {
  const tweets = await findPopularTweets(tweetSearch);

  const tweetIds = tweets.map((it) => it.id_str);

  const { data: existingTweets, error } = await supabase
    .from("tweets")
    .select("id")
    .in("id", tweetIds);


  if (error) {
    functions.logger.error(error);
    Bugsnag.notify(error);
  }

  const existingTweetsIds = existingTweets.map((it) => it.id);

  const nonExistingTweets = tweets.filter(
    (it) => !existingTweetsIds.includes(it.id_str)
  );

  functions.logger.log(`Saving ${nonExistingTweets.length} new tweets`);

  const tweetsToSave = nonExistingTweets.map((tweet) => {
    return {
      id: tweet.id_str,
      topics: [tweetSearch.topic],
      info: {
        id: tweet.id_str,
        authorId: tweet.user.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        author: tweet.user,
      },
      created_at: tweet.created_at,
    };
  });

  if (tweetsToSave.length) {
    functions.logger.info("Inserting tweets", {
      tweetSize: tweetsToSave.length,
    });
  }

  const { error: errorInserting } = await supabase
    .from("tweets")
    .insert(tweetsToSave);

  if (errorInserting) {
    functions.logger.error(errorInserting);
    Bugsnag.notify(errorInserting);
  }
}

async function findPopularTweets(tweetSearch) {
  let allTweets = [];

  await asyncForEach(tweetSearch.info.searches, async (search) => {
    const tweets = await retrieveTweets(search, tweetSearch.info.popular);
    allTweets = allTweets.concat(tweets);
  });

  return removeDuplicates(allTweets, "id");
}

function removeDuplicates(array, key) {
  return [...new Map(array.map((item) => [item[key], item])).values()];
}

async function retrieveTweets(search, popularitySettings) {
  // V2 API does not allow to filter by min favorites/replies meaning we have to loop through everything and use up all the quota very quickly
  const client = getTwitterClientV1();
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  let allTweets = [];
  let hasMore = true;
  let sinceId = null;

  while (hasMore) {
    const params = {
      count: 100,
      q:
        search.query +
        ` (min_faves:${popularitySettings.minLikes} OR min_replies:${popularitySettings.minReplies})`,
      since_id: sinceId,
      result_type: "recent",
      tweet_mode: "extended",
    };

    const baseUrl = "search/tweets.json";
    const queryParams = Object.keys(params)
      .filter((it) => params[it])
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join("&");

    const fullUrl = baseUrl + "?" + queryParams;

    functions.logger.info("Requesting twitter url", { fullUrl });

    const { statuses, search_metadata } = await client.get(fullUrl);
    statuses.forEach((status) => {
      delete status.entities;
      delete status.user.entities;
    });
    if (statuses.length !== 100) {
      hasMore = false;
    } else {
      sinceId = search_metadata.max_id;
    }
    allTweets = allTweets.concat(statuses);

    new Promise((resolve) => setTimeout(resolve, 500));
  }

  return allTweets;
}

module.exports = {
  refreshPopularTweets,
  retrieveTweetsWithUserData,
  retrieveTweets,
};
