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
    // পুরনো sales/returns/cash-history এখন মুছে ফেলা হয় না — এই collection-এ মাস-ভিত্তিক
    // document-এ চিরকালের জন্য জমা থাকে, যাতে main "shop_data" document ছোট ও দ্রুত থাকে
    // অথচ কোনো হিসাব হারিয়ে না যায়।
    const archiveCol = database.collection("shop_archive");

    const authDoc = await authCol.findOne({ _id: "auth" });
    const storedPassword = authDoc && authDoc.password;

    const qs = event.queryStringParameters || {};
    let providedPassword = null;
    let payload = null;
    if (event.httpMethod === "GET") {
      providedPassword = qs.password;
    } else if (event.httpMethod === "POST") {
      payload = JSON.parse(event.body || "{}");
      providedPassword = payload.password;
    }

    // password set করা থাকলে সেটা মিলতেই হবে — এখানেই আসল access control হচ্ছে,
    // শুধু frontend-এর lock screen "দেখানো" না, বরং data পড়া/লেখা দুটোই আটকে যাবে।
    if (storedPassword && providedPassword !== storedPassword) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "ভুল অথবা অনুপস্থিত Password।" }) };
    }

    // ---- পুরনো (archived) মাসের history পড়া (type=sales/returns/cashLedger/customerPayments, month=YYYY-MM) ----
    if (event.httpMethod === "GET" && qs.archiveType && qs.month) {
      const doc = await archiveCol.findOne({ _id: `${qs.archiveType}_${qs.month}` });
      return { statusCode: 200, headers, body: JSON.stringify(doc ? doc.items : []) };
    }

    // ---- কোন কোন মাসের archive Cloud-এ জমা আছে তার তালিকা ----
    if (event.httpMethod === "GET" && qs.archiveList) {
      const docs = await archiveCol.find({}).project({ items: 0 }).toArray();
      const counts = await archiveCol.aggregate([{ $project: { count: { $size: "$items" } } }]).toArray();
      const countMap = Object.fromEntries(counts.map(c => [c._id, c.count]));
      return { statusCode: 200, headers, body: JSON.stringify(docs.map(d => ({ id: d._id, count: countMap[d._id] || 0 }))) };
    }

    if (event.httpMethod === "GET") {
      const doc = await dataCol.findOne({ _id: "default" });
      return { statusCode: 200, headers, body: JSON.stringify(doc ? doc.data : null) };
    }

    if (event.httpMethod === "POST") {
      // ---- main document থেকে trim হওয়া পুরনো entry Cloud archive-এ যোগ করা (মুছে ফেলা হয় না) ----
      if (payload.archive) {
        const { type, month, items } = payload.archive;
        if (type && month && Array.isArray(items) && items.length) {
          await archiveCol.updateOne(
            { _id: `${type}_${month}` },
            { $push: { items: { $each: items } }, $set: { updatedAt: new Date() } },
            { upsert: true }
          );
        }
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

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
