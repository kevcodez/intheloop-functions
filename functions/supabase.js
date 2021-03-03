const functions = require("firebase-functions");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://pvnyntuqgqafdtgzucqj.supabase.co",
  functions.config().supabase.key
);

module.exports = {
  supabase,
};
