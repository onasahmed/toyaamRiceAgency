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

## Password Lock
প্রথমবার site খুললে একটা Password সেট করতে বলবে — এটাই এখন থেকে site খোলার চাবি। Password
MongoDB-এর `shop_auth` collection-এ প্লেইন টেক্সটে থাকে (ইচ্ছাকৃতভাবে, যাতে ভুলে গেলে Atlas-এ
ঢুকে সরাসরি দেখে নেওয়া যায়)। শুধু UI-lock না — password ছাড়া API-তে সরাসরি হিট করলেও data পাওয়া
যাবে না, যেহেতু backend (data.js) নিজেই password যাচাই করে। প্রতিটা device একবার Password দিলে
সেটা মনে রাখে (আবার আবার চাইবে না), যদি না footer থেকে "🔒 Lock করুন" চেপে বের করে দাও।

## Cash Box
দোকানের হাতের নগদের হিসাব — Sale-এ যা পাওয়া যায় ও Customer Due আদায় হলে যোগ হয়; Customer-কে
Advance ফেরত দিলে বা "− খরচ" দিয়ে কোনো খরচ লিখলে বাদ যায়। প্রতিটা movement "Cash History"-তে
লগ থাকে (paginated, কারণসহ)।

Purchase/Restock-এ এখন আর ক্রয়মূল্য বা Supplier Due হিসাব করা হয় না — শুধু Inventory-তে stock
(kg) যোগ হয়। Supplier-কে কত টাকা দেওয়া বাকি সেটা এই app-এর বাইরে হিসাব রাখতে হবে।

## Data আকার নিয়ন্ত্রণ (MongoDB 16MB single-document সীমা) — এখন কিছুই মোছা হয় না
পুরো live `db` একটাই MongoDB document (`shop_data`) হিসেবে save হয়, আর প্রতিটা MongoDB
document-এর সর্বোচ্চ সাইজ **16MB**। sales/returns/cash-history অসীম বাড়তে থাকলে একদিন এই
document বড় হয়ে যেত এবং site slow/broken হয়ে যেত — তাই `save()`-এর ভেতর automatic trimming আছে:

- Sales: সাম্প্রতিক ৫০০টা মূল document-এ থাকে
- Returns: সাম্প্রতিক ৩০০টা
- Cash History: সাম্প্রতিক ৫০০টা
- Customer Payments (internal log): সাম্প্রতিক ৫০০টা

**আগে limit ছাড়িয়ে গেলে পুরনো entry পুরোপুরি মুছে যেত। এখন আর মুছে যায় না** — trim হওয়ার
সময় সেই entry-গুলো Cloud-এর আলাদা `shop_archive` collection-এ মাস-ভিত্তিক document-এ
(`sales_2026-09` এই রকম `_id`) জমা হয়ে যায়। App-এর "পুরনো ইতিহাস (Archive)" অংশ থেকে
মাস/ধরন বেছে সেই data দেখা এবং CSV হিসেবে download করা যায়। এতে main document সবসময়
ছোট ও দ্রুত থাকে, অথচ বছরের পর বছরের হিসাব হারায় না।

এই সংখ্যাগুলো `public/index.html`-এ `HISTORY_LIMITS` constant-এ আছে। Brand/Product/Customer
তালিকা trim হয় না (এগুলো সাধারণত সীমিত সংখ্যক থাকে বলে সমস্যা করে না)।

### একা (single user), বছরের পর বছর ব্যবহারে কতদিন চলবে?
- একটা rice arat-এর দিনে ৫০-১০০টা sale ধরলেও বছরে ~৩৫,০০০টার মতো sale entry হয়; প্রতিটা
  entry মোটামুটি ২০০-৩০০ byte — তাতে বছরে ~৮-১০MB, ১০ বছরেও ~১০০MB-এর আশেপাশে।
- Archive collection-এ MongoDB Atlas-এর ফ্রি M0 cluster-এ **৫১২MB** পর্যন্ত জায়গা থাকে —
  একা ব্যবহারকারীর জন্য এই হিসেবে বহু বছর চলার কথা।
- Site-এর speed মূলত নির্ভর করে "live" document-এর সাইজের ওপর, যেটা এখন সবসময় ছোট থাকবে
  (৫০০-এর বেশি sale কখনো main document-এ জমা হবে না) — তাই বছরের পর বছর data জমলেও app
  slow হবে না; পুরনো history দেখতে চাইলে শুধু তখনই Archive থেকে আলাদাভাবে লোড হবে।

## Git push করলে কি পুরনো data হারিয়ে যায়?
**না।** Data MongoDB Atlas-এ থাকে, GitHub repo-তে না — `git push` শুধু `public/index.html` ও
`netlify/functions/*.js` কোড আপডেট করে, database-এর কোনো ডকুমেন্ট এতে touch হয় না। `MONGODB_URI`
environment variable Netlify-এর dashboard-এ (Site settings → Environment variables) সেট করা
থাকে, যেটা কোড push/redeploy-তে মুছে যায় না — শুধু ওই variable যেন কখনো ভুলে delete/change না
হয়, সেটা খেয়াল রাখলেই যথেষ্ট।

## Cash Box সিঙ্ক নিয়ে একটা সমস্যা ঠিক করা হয়েছে
আগে দিনশেষে শেষ sale/cash entry করার পর যদি সাথে সাথে ট্যাব/ব্রাউজার বন্ধ করে ফেলা হতো,
তাহলে Cloud-এ push হওয়ার আগেই connection কেটে যেত — এবং পরদিন app খুললে Cloud-এর পুরনো
(অসম্পূর্ণ) data দিয়ে local-কে ওভাররাইট করে ফেলত, ফলে cash box-এর শেষ হিসাব হারিয়ে
"কমে যাওয়া/শূন্য হয়ে যাওয়া" মনে হতো। এখন প্রতিটা change একটা "pending" flag দিয়ে ট্র্যাক
করা হয়: যতক্ষণ না Cloud থেকে push সফল হওয়ার নিশ্চয়তা পাওয়া যায়, ততক্ষণ Cloud থেকে টেনে
এনে local data ওভাররাইট করা হয় না — বরং আগে সেই বাকি থাকা change-টাই আবার পাঠানোর চেষ্টা
হয় (retry + `keepalive` + tab বন্ধ হওয়ার মুহূর্তে `sendBeacon` দিয়ে শেষ চেষ্টা)।

## ফাইল গঠন
```
public/index.html          → পুরো POS app (এটাই মূল site)
netlify/functions/data.js  → MongoDB-এর সাথে কথা বলার backend function (password-protected)
netlify/functions/auth.js  → Password set/verify করার backend function
package.json                → mongodb npm package-এর জন্য
netlify.toml                → Netlify build config
```
