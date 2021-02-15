const functions = require("firebase-functions");
const { Octokit } = require("@octokit/rest");
const { createClient } = require("@supabase/supabase-js");

const octokit = new Octokit();
const supabase = createClient(
  "https://pvnyntuqgqafdtgzucqj.supabase.co",
  functions.config().supabase.key
);

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.helloWorld = functions.https.onRequest(async (request, response) => {
  const { data, error } = await supabase.from("topic").select("*");

  await asyncForEach(data, async (topic) => {
    const scmUrlSplit = topic.info.scm.url.split("/");
    const owner = scmUrlSplit[scmUrlSplit.length - 2];
    const repo = scmUrlSplit[scmUrlSplit.length - 1];

    const {data} = await octokit.repos.listReleases({
      owner: "JetBrains",
      repo: "kotlin",
    });

    functions.logger.info("Hello logs!", { owner, repo });
    data.forEach(release => functions.logger.info(release.tag_name))
  });

  response.send(JSON.stringify(data));
});

exports.scheduled = functions.pubsub
  .schedule("every 1 minutes")
  .onRun((context) => {
    console.log("This will be run every 5 minutes!");
    functions.logger.info("hello");
    return null;
  });

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
