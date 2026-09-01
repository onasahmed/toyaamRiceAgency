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

## Data আকার নিয়ন্ত্রণ (MongoDB 16MB single-document সীমা)
পুরো `db` একটাই MongoDB document হিসেবে save হয় — আর প্রতিটা MongoDB document-এর সর্বোচ্চ সাইজ
**16MB** (এটা Atlas-এর 500MB মোট storage সীমার চেয়ে অনেক আগেই আসতে পারে, যদি sales/returns/cash
history অসীম বাড়তে থাকে)। এজন্য `save()`-এর ভেতর automatic trimming বসানো আছে — প্রতিবার save
হওয়ার সময় পুরনো entry স্বয়ংক্রিয়ভাবে বাদ পড়ে যায়:

- Sales: সাম্প্রতিক ৫০০টা রাখা হয়
- Returns: সাম্প্রতিক ৩০০টা রাখা হয়
- Cash History: সাম্প্রতিক ৫০০টা রাখা হয়
- Customer Payments (internal log): সাম্প্রতিক ৫০০টা রাখা হয়

এই সংখ্যাগুলো `public/index.html`-এ `HISTORY_LIMITS` নামের একটা constant-এ আছে — দরকার হলে
বাড়িয়ে/কমিয়ে নেওয়া যাবে। Brand/Product/Customer তালিকা trim হয় না (এগুলো সাধারণত সীমিত
সংখ্যক থাকে বলে সমস্যা করে না)।

## ফাইল গঠন
```
public/index.html          → পুরো POS app (এটাই মূল site)
netlify/functions/data.js  → MongoDB-এর সাথে কথা বলার backend function (password-protected)
netlify/functions/auth.js  → Password set/verify করার backend function
package.json                → mongodb npm package-এর জন্য
netlify.toml                → Netlify build config
```
