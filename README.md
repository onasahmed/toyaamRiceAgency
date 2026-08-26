# চাল আড়ত POS — MongoDB + Netlify Setup

## যা লাগবে (তোমাকে নিজে করতে হবে, ফ্রি)

### ধাপ ১: MongoDB Atlas (Free Database)
1. https://www.mongodb.com/cloud/atlas/register এ গিয়ে ফ্রি account বানাও
2. একটা Free "M0" Cluster তৈরি করো (৫১২MB ফ্রি)
3. Database Access → নতুন Database User বানাও (username + password মনে রাখো)
4. Network Access → "Allow Access from Anywhere" (0.0.0.0/0) সিলেক্ট করো
5. Cluster-এর "Connect" বাটনে গিয়ে "Drivers" থেকে connection string কপি করো, দেখতে এমন হবে:
   `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   (এখানে `<password>` এর জায়গায় নিজের password বসিয়ে দাও)

### ধাপ ২: Netlify-তে Deploy
এই পুরো folder-টা **GitHub-এ push করে** Netlify-এর সাথে connect করাই সবচেয়ে সহজ পথ
(শুধু drag-drop দিয়ে MongoDB package ইনস্টল হবে না, তাই Git দিয়েই deploy করতে হবে):

1. এই folder-টা একটা নতুন GitHub repo-তে push করো
2. Netlify-তে "Add new site" → "Import an existing project" → GitHub repo সিলেক্ট করো
3. Build settings এমনিতেই ঠিক থাকবে (netlify.toml থেকে auto-detect হবে)
4. Deploy হওয়ার আগে/পরে: Site settings → Environment variables → নতুন variable যোগ করো:
   - Key: `MONGODB_URI`
   - Value: ধাপ ১-এ পাওয়া connection string
5. আবার Deploy করো (redeploy) যাতে environment variable কার্যকর হয়

### ব্যবহার
Deploy হয়ে গেলে যে URL পাবে (যেমন `yourapp.netlify.app`), সেটা PC ও Mobile — দুই জায়গা থেকেই খুললে
এখন থেকে stock/sale/due সব **MongoDB-তে sync হয়ে থাকবে**। একটা device-এ বিক্রি করলে ~২০ সেকেন্ডের
মধ্যে অন্য device-এও দেখা যাবে (নিচে footer-এ "Sync হয়েছে" লেখা দেখাবে)।

Internet না থাকলেও app বন্ধ হবে না — local device-এ কাজ চালিয়ে যেতে পারবে, internet ফিরলে
automatic আবার sync হয়ে যাবে (অথবা footer থেকে "এখনই Sync করুন" চাপা যাবে)।

## ফাইল গঠন
```
public/index.html          → পুরো POS app (এটাই মূল site)
netlify/functions/data.js  → MongoDB-এর সাথে কথা বলার backend function
package.json                → mongodb npm package-এর জন্য
netlify.toml                → Netlify build config
```
