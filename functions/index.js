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

exports.refreshReleases = functions.region('europe-west1').https.onRequest(
  async (request, response) => {
    await getNewReleases();
    response.send("hi");
  }
);

exports.refreshReleasesScheduled = functions.region('europe-west1').pubsub
  .schedule("every 3 hours")
  .onRun(async () => {
    await getNewReleases();
  });

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const getNewReleases = async () => {
  const { data, error } = await supabase.from("topic").select("*");

  await asyncForEach(data, async (topic) => {
    const scmUrlSplit = topic.info.scm.url.split("/");
    const owner = scmUrlSplit[scmUrlSplit.length - 2];
    const repo = scmUrlSplit[scmUrlSplit.length - 1];

    const { data } = await octokit.repos.listReleases({
      owner: owner,
      repo: repo,
    });

    const githubReleases = data.map((release) => {
      const version = release.tag_name.replace("v", "");

      return {
        info: {
          name: release.name,
          publishedAt: release.published_at,
          version: version,
          releaseNotesUrl: release.html_url,
          prerelease: release.prerelease,
        },
        topic: topic.id,
      };
    });

    const { data: releasesFromSupabase, error } = await supabase
      .from("release")
      .select("info->>version")
      .eq("topic", topic.id)
      .in(
        "info->>version",
        githubReleases.map((it) => it.info.version)
      );

    const releasesNotInDatabaseYet = githubReleases.filter(
      (release) =>
        !releasesFromSupabase.some((it) => it.version === release.info.version)
    );

    if (releasesNotInDatabaseYet.length) {
      functions.logger.info("Saving new releases", releasesNotInDatabaseYet);
    }

    await supabase.from("release").insert(releasesNotInDatabaseYet);

    // release type: stable, beta, milestone, release candidate, eap
  });
};
