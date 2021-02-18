const functions = require("firebase-functions");
const { Octokit } = require("@octokit/rest");
const { createClient } = require("@supabase/supabase-js");
const { asyncForEach } = require("./asyncForEach");
const npmFetch = require("npm-registry-fetch");

const octokit = new Octokit();
const supabase = createClient(
  "https://pvnyntuqgqafdtgzucqj.supabase.co",
  functions.config().supabase.key
);

// idea: posisbly tag release type: stable, beta, milestone, release candidate, eap

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

const getNewReleasesFromNpm = async () => {
  const topics = await getTopicsByReleaseType("npm");

  await asyncForEach(topics, async (topic) => {
    const npmData = await npmFetch.json(
      "/" + topic.info.fetchReleases.meta.package
    );

    const releasesFromNpm = Object.keys(npmData.versions).map((version) => {
      const versionDetails = npmData.versions[version];

      return {
        name: versionDetails.name,
        publishedAt: npmData.time[versionDetails.version],
        version: versionDetails.version,
        meta: {
          dependencies: versionDetails.dependencies,
        },
      };
    });

    await saveUnknownReleases(topic, releasesFromNpm);

    const timeKeys = Object.keys(npmData.time);
    const latestReleaseVersion = timeKeys[timeKeys.length - 1];

    await saveLatestVersion(topic, latestReleaseVersion);
  });
};

const getNewReleasesFromGithub = async () => {
  const topics = await getTopicsByReleaseType("Github");

  await asyncForEach(topics, async (topic) => {
    const fetchMeta = topic.info.fetchReleases.meta;
    const { data } = await octokit.repos.listReleases({
      owner: fetchMeta.owner,
      repo: fetchMeta.repo,
    });

    const releasesFromGithub = data.map((release) => {
      const version = release.tag_name.replace("v", "");

      return {
        name: release.name,
        publishedAt: release.published_at,
        version: version,
        releaseNotesUrl: release.html_url,
        meta: {
          prerelease: release.prerelease,
        },
      };
    });

    await saveUnknownReleases(topic, releasesFromGithub);

    const { data: latestRelease } = await octokit.repos.getLatestRelease({
      owner: fetchMeta.owner,
      repo: fetchMeta.repo,
    });

    const latestReleaseVersion = latestRelease.tag_name.replace("v", "");

    await saveLatestVersion(topic, latestReleaseVersion);
  });
};

const getTopicsByReleaseType = async (via) => {
  const { data, error } = await supabase
    .from("topic")
    .select("*")
    .eq("info->fetchReleases->>via", via);

  return data;
};

const saveUnknownReleases = async (topic, fetchedReleases) => {
  const { data: releasesFromSupabase, error } = await supabase
    .from("release")
    .select("info")
    .eq("topic", topic.id)
    .in(
      "info->>version",
      fetchedReleases.map((it) => it.version)
    );

  const releasesNotInDatabaseYet = fetchedReleases.filter(
    (release) =>
      !releasesFromSupabase.some((it) => it.version === release.version)
  );

  if (releasesNotInDatabaseYet.length) {
    functions.logger.info("Saving new releases", releasesNotInDatabaseYet);
  }

  const releasesNotInDatabseWithTopic = releasesNotInDatabaseYet.map(
    (release) => {
      return {
        info: release,
        topic: topic.id,
      };
    }
  );

  await supabase.from("release").insert(releasesNotInDatabseWithTopic);
};

const saveLatestVersion = async (topic, latestReleaseVersion) => {
  if (topic.info.latestVersion === latestReleaseVersion) return;

  functions.logger.info("Setting latest version", {
    topic: topic.id,
    version: latestReleaseVersion,
  });

  const updatedInfo = {
    ...topic.info,
    latestVersion: latestReleaseVersion,
  };

  console.log(updatedInfo.latestVersion)
  console.log(updatedInfo)

  await supabase.from("topic").update({
    info: updatedInfo,
  })
  .eq('id', topic.id);
};
