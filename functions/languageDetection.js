const { Translate } = require("@google-cloud/translate").v2;
const functions = require("firebase-functions");
const { decode } = require("html-entities");

const translate = new Translate({
  key: functions.config().googlecloud.api_key,
});

async function detectLanguage(text) {
  const strippedText = text.replace(/(<([^>]+)>)/gi, "");
  const htmlEntitiesDecoded = decode(strippedText);
  const detections = await translate.detect(htmlEntitiesDecoded);
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
