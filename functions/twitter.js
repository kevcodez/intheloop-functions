const functions = require("firebase-functions");
const Twitter = require("twitter-lite");
const { asyncForEach } = require("./asyncForEach");
const { supabase } = require("./supabase");

function getTwitterClient() {
  return new Twitter({
    version: "2",
    extension: false,
    consumer_key: functions.config().twitter.consumer_key,
    consumer_secret: functions.config().twitter.consumer_secret,
    bearer_token: functions.config().twitter.bearer_token,
  });
}

async function refreshPopularTweets() {
  const { data: allSearches } = await supabase
    .from("twitter_search")
    .select("*");

  await asyncForEach(
    allSearches,
    async (tweetSearch) => await saveNewPopularTweets(tweetSearch)
  );
}

async function saveNewPopularTweets(tweetSearch) {
  // todo restrict to not update too frequently
  const lastUpdatedAt = tweetSearch.last_updated_at;

  const { tweets, users } = await findPopularTweets(tweetSearch);

  const tweetIds = tweets.map((it) => it.id);

  const { data: existingTweets } = await supabase
    .from("tweets")
    .select("id")
    .in("id", tweetIds);

  const existingTweetsIds = existingTweets.map((it) => it.id);

  const nonExistingTweets = tweets.filter(
    (it) => !existingTweetsIds.includes(it.id)
  );

  functions.logger.log(`Saving ${nonExistingTweets.length} new tweets`);

  const tweetsToSave = nonExistingTweets.map((tweet) => {
    const user = users.find((user) => user.id === tweet.author_id);
    return {
      id: tweet.id,
      topics: [tweetSearch.topic],
      info: {
        id: tweet.id,
        authorId: tweet.author_id,
        text: tweet.text,
        createdAt: tweet.created_at,
        author: {
          ...user,
        },
      },
    };
  });

  console.log(tweetsToSave);

  const { error } = await supabase.from("tweets").insert(tweetsToSave);
  if (error) {
    console.log(error);
  }
}

async function findPopularTweets(tweetSearch) {
  /* { "popular": {  "minLikes": "80", "minReplies": "30" },
         "searches": [ {"query": "kotlin -is:retweet lang:en"}]} */

  let allTweets = [];
  let allUsers = [];

  await asyncForEach(tweetSearch.info.searches, async (search) => {
    const { tweets, users } = await retrieveTweets(search);
    allTweets = allTweets.concat(tweets);
    allUsers = allUsers.concat(allUsers);
  });

  const popularTweets = filterPopularTweets(allTweets, tweetSearch);

  return {
    tweets: popularTweets,
    users: allUsers,
  };
}

function filterPopularTweets(tweets, tweetSearch) {
  const minLikes = tweetSearch.info.popular.minLikes;
  const minReplies = tweetSearch.info.popular.minReplies;

  return tweets.filter(
    (it) =>
      it.public_metrics.like_count >= minLikes ||
      it.public_metrics.reply_count > minReplies
  );
}

async function retrieveTweets(search) {
  const client = getTwitterClient();
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  let allTweets = [];
  let users = [];
  let hasMore = true;
  let nextToken = null;

  while (hasMore) {
    const params = {
      start_time: twoDaysAgo.toISOString(),
      max_results: 100,
      "tweet.fields": "public_metrics,created_at",
      "user.fields": "profile_image_url",
      query: search.query,
      next_token: nextToken,
      expansions: "author_id",
    };

    const baseUrl = "tweets/search/recent";
    const queryParams = Object.keys(params)
      .filter((it) => params[it])
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join("&");

    const fullUrl = baseUrl + "?" + queryParams;
    console.log(fullUrl);

    const { data, meta, includes } = await client.get(fullUrl);
    if (meta.result_count !== 100) {
      hasMore = false;
    } else {
      nextToken = meta.next_token;
    }
    allTweets = allTweets.concat(data);
    users = users.concat(includes.users);

    new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { tweets: allTweets, users };
}

module.exports = {
  refreshPopularTweets,
};
