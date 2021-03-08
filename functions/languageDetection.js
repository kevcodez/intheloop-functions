const { Translate } = require("@google-cloud/translate").v2;
const functions = require("firebase-functions");

const translate = new Translate({
  key: functions.config().googlecloud.api_key,
});

async function detectLanguage(text) {
  const strippedText = text.replace(/(<([^>]+)>)/gi, "");
  const detections = await translate.detect(strippedText);
  const detectionsArray = Array.isArray(detections) ? detections : [detections];
  if (detectionsArray.length) {
    return detectionsArray[0].language;
  } else {
    functions.logger.warn("Could not detect language", { text, detections });
    return null;
  }
}

module.exports = {
  detectLanguage,
};
