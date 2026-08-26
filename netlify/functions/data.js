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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "MONGODB_URI environment variable is not set in Netlify." }),
    };
  }

  try {
    const client = await getClient();
    const database = client.db("rice_arat_pos");
    const col = database.collection("shop_data");

    if (event.httpMethod === "GET") {
      const doc = await col.findOne({ _id: "default" });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(doc ? doc.data : null),
      };
    }

    if (event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      await col.updateOne(
        { _id: "default" },
        { $set: { data: payload, updatedAt: new Date() } },
        { upsert: true }
      );
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
