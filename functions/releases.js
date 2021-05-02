const functions = require("firebase-functions");
const { Octokit } = require("@octokit/rest");
const { supabase } = require("./supabase");
const { asyncForEach } = require("./asyncForEach");
const npmFetch = require("npm-registry-fetch");
const { Bugsnag } = require("./bugsnag");
const _ = require("lodash");

const octokit = new Octokit();

const getNewReleasesFromNpm = async () => {
  const topics = await getTopicsByReleaseType("npm");

  await asyncForEach(topics, async (topic) => {
    const npmData = await npmFetch.json(
      "/" + topic.info.fetchReleases.meta.package
    );

    const termsToIgnore = ["0.0.0", "canary", "dev", "insider"];

    const releasesFromNpm = Object.keys(npmData.versions)
      .filter((it) => !termsToIgnore.some((ignore) => it.includes(ignore)))
      .map((version) => {
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

    const timeKeys = Object.keys(npmData.time).filter(
      (it) => !termsToIgnore.some((ignore) => it.includes(ignore))
    );
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

    functions.logger.info("Getting latest release", { fetchMeta });

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

  if (error) {
    functions.logger.error(error);
    Bugsnag.notify(error);
    return;
  }

  return data;
};

const saveUnknownReleases = async (topic, fetchedReleases) => {
  functions.logger.info("Fetched releases", {
    topic,
    releases: fetchedReleases.map((it) => it.version),
  });

  const releasesFromSupabase = [];

  // Need to chunk for Supabase
  const versionChunks = _.chunk(
    fetchedReleases.map((it) => it.version),
    100
  );

  await asyncForEach(versionChunks, async (versions) => {
    const { data, error } = await supabase
      .from("release")
      .select("info")
      .eq("topic", topic.id)
      .in("info->>version", versions);

    releasesFromSupabase.push(...data);

    if (error) {
      functions.logger.error(error.message);
      Bugsnag.notify(new Error(error.message));
      return;
    }
  });

  const releasesNotInDatabaseYet = fetchedReleases.filter(
    (release) =>
      !releasesFromSupabase.some((it) => it.info.version === release.version)
  );

  if (releasesNotInDatabaseYet.length) {
    functions.logger.info("Saving new releases", {
      releasesInSupabase: releasesFromSupabase.length,
      releasesNotInDatabase: releasesNotInDatabaseYet.length,
    });
  }

  const releasesNotInDatabseWithTopic = releasesNotInDatabaseYet.map(
    (release) => {
      return {
        info: release,
        topic: topic.id,
      };
    }
  );

  const { error: errorInserting } = await supabase
    .from("release")
    .insert(releasesNotInDatabseWithTopic);

  if (errorInserting) {
    Bugsnag.notify(errorInserting);
  }
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

  const { error: errorUpdating } = await supabase
    .from("topic")
    .update({
      info: updatedInfo,
    })
    .eq("id", topic.id);

  if (errorUpdating) {
    functions.logger.error(errorUpdating);
    Bugsnag.notify(errorUpdating);
  }
};

module.exports = {
  getNewReleasesFromGithub,
  getNewReleasesFromNpm,
};
