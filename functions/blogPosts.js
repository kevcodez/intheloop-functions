const { parseRssFeed } = require("./parseRssFeed");
const { supabase } = require("./supabase");
const { asyncForEach } = require("./asyncForEach");
const functions = require("firebase-functions");
const { Bugsnag } = require("./bugsnag");
const { detectLanguage } = require("./languageDetection");

const getNewRssPosts = async () => {
  const { data: blogs, error } = await supabase.from("blog").select("*");

  if (error) {
    Bugsnag.notify(error);
    return [];
  }

  const blogsWithRssFeed = blogs.filter((it) => it.info.rssFeedUrl);

  await asyncForEach(blogsWithRssFeed, async (blog) => {
    const blogPosts = await parseRssFeed(blog.info.rssFeedUrl);

    await saveNewBlogPosts(blog, blogPosts);
  });
};

const saveNewBlogPosts = async (blog, blogPosts) => {
  const { data: existingBlogPosts, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("blog_id", blog.id)
    .in(
      "info->>guid",
      blogPosts.map((it) => it.guid)
    );

  if (error) {
    Bugsnag.notify(error);
    return;
  }

  functions.logger.log(
    "Checking " + blogPosts.length + " rss posts for blog " + blog.id
  );

  const unsavedBlogPosts = blogPosts.filter(
    (it) =>
      !existingBlogPosts.some((existing) => existing.info.guid === it.guid)
  );

  const newBlogPosts = [];

  await asyncForEach(unsavedBlogPosts, async (blogPostInfo) => {
    const blogPostLanguage = await detectLanguage(blogPostInfo.summary);
    functions.logger.info("Detected language for blog post", {
      blogPostLanguage,
    });

    newBlogPosts.push({
      info: blogPostInfo,
      blog_id: blog.id,
      topics: blog.topics,
      language: blogPostLanguage,
    });
  });

  functions.logger.log(
    newBlogPosts.length + " posts to insert for blog " + blog.id
  );

  const { error: errorInserting } = await supabase
    .from("blog_posts")
    .insert(newBlogPosts);

  if (errorInserting) {
    Bugsnag.notify(errorInserting);
  }
};

module.exports = {
  getNewRssPosts,
};
