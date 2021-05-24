const { Translate } = require("@google-cloud/translate").v2;
const functions = require("firebase-functions");
const { decode } = require("html-entities");

const translate = new Translate({
  key: functions.config().googlecloud.api_key,
});

async function detectLanguage(text) {
  if (!text) {
    return null
  }
  const strippedText = text.replace(/(<([^>]+)>)/gi, "");
  const htmlEntitiesDecoded = decode(strippedText);

  // Google Cloud bills based on the amount of characters
  const maxCharacterCount = 50;
  const partOfTheText =
    htmlEntitiesDecoded.length > maxCharacterCount
      ? htmlEntitiesDecoded.slice(0, maxCharacterCount)
      : htmlEntitiesDecoded;

  const detections = await translate.detect(partOfTheText);
  const detectionsArray = Array.isArray(detections) ? detections : [detections];
  if (detectionsArray.length) {
    return detectionsArray[0].language;
  } else {
    return null;
  }
}

module.exports = {
  detectLanguage,
};
