const { Redis } = require("@upstash/redis");
require("dotenv").config({ path: ".env.local" });

async function test() {
  console.log("URL:", process.env.UPSTASH_REDIS_REST_URL);
  console.log("Token:", process.env.UPSTASH_REDIS_REST_TOKEN);

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    const res = await redis.set("test_connection", "ok", { ex: 10 });
    console.log("Redis SET result:", res);
    const getRes = await redis.get("test_connection");
    console.log("Redis GET result:", getRes);
  } catch (err) {
    console.error("Redis Error:", err.message);
  }
}

test();
