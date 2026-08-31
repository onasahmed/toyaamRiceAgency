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
    const dataCol = database.collection("shop_data");
    const authCol = database.collection("shop_auth");

    const authDoc = await authCol.findOne({ _id: "auth" });
    const storedPassword = authDoc && authDoc.password;

    let providedPassword = null;
    let payload = null;
    if (event.httpMethod === "GET") {
      providedPassword = event.queryStringParameters && event.queryStringParameters.password;
    } else if (event.httpMethod === "POST") {
      payload = JSON.parse(event.body || "{}");
      providedPassword = payload.password;
    }

    // password set করা থাকলে সেটা মিলতেই হবে — এখানেই আসল access control হচ্ছে,
    // শুধু frontend-এর lock screen "দেখানো" না, বরং data পড়া/লেখা দুটোই আটকে যাবে।
    if (storedPassword && providedPassword !== storedPassword) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "ভুল অথবা অনুপস্থিত Password।" }) };
    }

    if (event.httpMethod === "GET") {
      const doc = await dataCol.findOne({ _id: "default" });
      return { statusCode: 200, headers, body: JSON.stringify(doc ? doc.data : null) };
    }

    if (event.httpMethod === "POST") {
      await dataCol.updateOne(
        { _id: "default" },
        { $set: { data: payload.data, updatedAt: new Date() } },
        { upsert: true }
      );
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
