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
} = require("./twitter");

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
      const topic = request.body.topic;
      const page = request.body.page;

      if (!topic || !page || isNaN(page) || Number(page) < 1) {
        response.status(400).send();
        return;
      }

      try {
        const tweets = await retrieveTweetsWithUserData(topic, page);
        response.status(200).json(tweets).send();
      } catch (err) {
        response.status(500).send();
      }
    });
  });

// idea: possibly tag release type: stable, beta, milestone, release candidate, eap

exports.refreshReleasesFromGithub = functions
  .region("europe-west1")
  .https.onRequest(async (request, response) => {
    await getNewReleasesFromGithub();
    response.send("hi");
  });

exports.refreshReleasesFromNpm = functions
  .region("europe-west1")
  .https.onRequest(async (request, response) => {
    await getNewReleasesFromNpm();
    response.send("hi");
  });

exports.getNewRssPosts = functions
  .region("europe-west1")
  .https.onRequest(async (request, response) => {
    await getNewRssPosts();
    response.send("hi");
  });

exports.getPopularTweets = functions
  .region("europe-west1")
  .https.onRequest(async (request, response) => {
    await refreshPopularTweets();
    response.send("hi");
  });

exports.refreshGithubReleasesScheduled = functions
  .region("europe-west1")
  .pubsub.schedule("every 3 hours")
  .onRun(async () => {
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
