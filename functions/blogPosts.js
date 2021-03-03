const { parseRssFeed } = require("./parseRssFeed");
const { supabase } = require("./supabase");
const { asyncForEach } = require("./asyncForEach");
const functions = require("firebase-functions");

const getNewRssPosts = async () => {
  const { data: blogs, error } = await supabase.from("blog").select("*");

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

  functions.logger.log(
    "Checking " + blogPosts.length + " rss posts for blog " + blog.id
  );

  const newBlogPosts = blogPosts
    .filter(
      (it) =>
        !existingBlogPosts.some((existing) => existing.info.guid === it.guid)
    )
    .map((blogPostInfo) => {
      return {
        info: blogPostInfo,
        blog_id: blog.id,
        topics: blog.topics,
      };
    });

  functions.logger.log(
    newBlogPosts.length + " posts to insert for blog " + blog.id
  );

  await supabase.from("blog_posts").insert(newBlogPosts);
};

module.exports = {
  getNewRssPosts,
};
