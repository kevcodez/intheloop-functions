const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { subscribeToNewsletter } = require("./newsletter");
const { getNewRssPosts } = require("./blogPosts");
const {
  getNewReleasesFromGithub,
  getNewReleasesFromNpm,
} = require("./releases");
const {
  refreshPopularTweets,
  retrieveTweetsWithUserData,
  retrieveTweets,
} = require("./twitter");
const { Bugsnag } = require("./bugsnag");

Bugsnag.start({ apiKey: functions.config().bugsnag.api_key });

exports.subscribeToNewsletter = functions
  .region("europe-west1")
  .https.onRequest((request, response) => {
    cors(request, response, async () => {
      const { success, error } = await subscribeToNewsletter(
        request.body.email
      );

      if (success) {
        response.send("Ok");
      } else {
        response.status(400).json({ error }).send();
      }
    });
  });

exports.getTweetsByTopic = functions
  .region("europe-west1")
  .https.onRequest((request, response) => {
    cors(request, response, async () => {
      const topic = request.query.topic;
      const page = request.query.page;

      if (!topic || !page || isNaN(page) || Number(page) < 1) {
        functions.logger.info("Invalid request for tweets by topic");
        response.status(400).send();
        return;
      }

      try {
        const tweets = await retrieveTweetsWithUserData(topic, page);
        response.status(200).json(tweets).send();
      } catch (err) {
        functions.logger.error(err);
        response.status(500).send();
      }
    });
  });

exports.retrieveTweetsBySearch = functions
  .region("europe-west1")
  .https.onRequest((request, response) => {
    cors(request, response, async () => {
      if (!request.body || request.method !== "POST") {
        return response.status(400).send();
      }

      try {
        const data = await retrieveTweets(request.body);
        return response.status(200).json(data).send();
      } catch (err) {
        return response.status(500).send(err);
      }
    });
  });

exports.refreshGithubReleasesScheduled = functions
  .region("europe-west1")
  .pubsub.schedule("every 3 hours")
  .onRun(async () => {
    // idea: possibly tag release type: stable, beta, milestone, release candidate, eap
    await getNewReleasesFromGithub();
  });

exports.refreshNpmReleasesScheduled = functions
  .region("europe-west1")
  .pubsub.schedule("every 3 hours")
  .onRun(async () => {
    await getNewReleasesFromNpm();
  });

exports.refreshRssFeedsScheduled = functions
  .region("europe-west1")
  .pubsub.schedule("every 6 hours")
  .onRun(async () => {
    await getNewRssPosts();
  });

exports.refreshPopularTweetsScheduled = functions
  .region("europe-west1")
  .pubsub.schedule("every 2 hours")
  .onRun(async () => {
    await refreshPopularTweets();
  });
