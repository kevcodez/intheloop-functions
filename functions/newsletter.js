const functions = require("firebase-functions");
const got = require("got");

async function subscribeToNewsletter(email) {
  if (!email || !/^\S+@\S+$/.test(email)) {
    return {
      success: false,
      error: "Invalid email",
    };
  }

  const apiKey = functions.config().emailoctopus.key;
  const listId = functions.config().emailoctopus.list;

  try {
    functions.logger.info("Subscribe user to newsletter", { email });
    await got.post(
      `https://emailoctopus.com/api/1.5/lists/${listId}/contacts`,
      {
        json: {
          api_key: apiKey,
          email_address: email,
        },
      }
    );
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    const statusCode = error.response.statusCode;

    functions.logger.info(
      `Received status code ${statusCode} when trying to register email`
    );

    let errorMessage = "Something went wrong";
    if (statusCode === 409) {
      errorMessage = "Already subscribed";
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

module.exports = {
  subscribeToNewsletter,
};
