const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { subscribeToNewsletter } = require("./newsletter");
const {
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
