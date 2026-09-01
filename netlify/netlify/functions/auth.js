const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (!uri) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "MONGODB_URI environment variable is not set in Netlify." }) };
  }

  try {
    const client = await getClient();
    const database = client.db("rice_arat_pos");
    const col = database.collection("shop_auth");

    if (event.httpMethod === "GET") {
      // শুধু বলবে password set আছে কিনা — আসল password কখনো এখান থেকে ফেরত যায় না।
      // ভুলে গেলে MongoDB Atlas-এ গিয়ে shop_auth collection-এ সরাসরি দেখে নেওয়া যাবে।
      const doc = await col.findOne({ _id: "auth" });
      return { statusCode: 200, headers, body: JSON.stringify({ hasPassword: !!(doc && doc.password) }) };
    }

    if (event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");

      if (payload.action === "verify") {
        const doc = await col.findOne({ _id: "auth" });
        const ok = !!(doc && doc.password && doc.password === payload.password);
        return { statusCode: 200, headers, body: JSON.stringify({ ok }) };
      }

      if (payload.action === "set") {
        const doc = await col.findOne({ _id: "auth" });
        const existing = doc && doc.password;
        // প্রথমবার (কোনো password নেই) সরাসরি সেট করা যাবে; পরে বদলাতে হলে পুরনোটা সঠিক হতে হবে।
        if (existing && payload.oldPassword !== existing) {
          return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: "পুরনো Password ভুল।" }) };
        }
        if (!payload.password || String(payload.password).length < 4) {
          return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Password কমপক্ষে ৪ অক্ষরের হতে হবে।" }) };
        }
        await col.updateOne(
          { _id: "auth" },
          { $set: { password: String(payload.password), updatedAt: new Date() } },
          { upsert: true }
        );
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
