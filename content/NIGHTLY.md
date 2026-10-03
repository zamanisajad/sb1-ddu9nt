# اجرای شبانه: انتشار یک مقاله در masports.ir

این فایل دستورالعمل Routine شبانه است. اجرا حدود ساعت 18:45 به وقت تهران شروع می‌شود و مقاله برای **ساعت 20:30 به وقت تهران** در وردپرس زمان‌بندی می‌شود (status=future). اگر اجرا بعد از 20:30 تمام شود، مقاله همان لحظه منتشر می‌شود.

در تمام مراحل، تو همان ایجنتی هستی که در `.claude/agents/masport-content-agent.md` تعریف شده است. آن فایل را کامل بخوان و تمام قواعدش را رعایت کن. حالت Autonomous Publishing فعال است، پس فقط وقتی منتشر کن که تمام Quality Gates پاس شده باشند.

## ۰. پیش‌نیازها (Preflight)

1. بررسی کن متغیرهای محیطی `WP_URL`، `WP_USER` و `WP_APP_PASSWORD` وجود داشته باشند و `python3 content/tools/wp_publish.py check` بدون خطا اجرا شود.
2. با WebFetch صفحه `https://masports.ir` و `https://assistantcoach.ir` را باز کن.
3. اگر هر کدام شکست خورد: فایل `content/reports/<YYYY-MM-DD>-blocked.md` را با دلیل دقیق خطا بنویس، commit و push کن و **متوقف شو**. هیچ چیزی منتشر نکن و مقاله را با اطلاعات ناقص ننویس.

## ۱. بارگذاری وضعیت

- فایل‌های `content/inventory.md`، `content/database.csv` و `content/topical-map.md` را بخوان (اگر وجود دارند).
- اگر `inventory.md` وجود ندارد یا از آخرین بروزرسانی‌اش بیش از ۷ روز گذشته، آن را با `python3 content/tools/wp_publish.py posts` و WebFetch صفحات سایت بازسازی کن (STEP 1 ایجنت).
- اگر `topical-map.md` وجود ندارد، آن را بساز.
- اگر `database.csv` وجود ندارد، آن را با ستون‌های بخش CONTENT DATABASE بساز.

## ۲. اطلاعات محصول

قابلیت‌های فعلی «کمک مربی» را از assistantcoach.ir بخوان. فقط قابلیت‌هایی را که امروز آنجا دیدی در مقاله ذکر کن.

## ۳. انتخاب موضوع

- اگر در `database.csv` موضوعی با وضعیت `READY_TO_WRITE` هست، اولویت با آن است. در غیر این صورت، چرخه Topic Discovery را اجرا کن و بهترین موضوع را انتخاب کن. بقیه موضوع‌های خوب را با وضعیت `IDEA` در دیتابیس ثبت کن.
- با inventory بررسی کن که هم‌پوشانی (cannibalization) نداشته باشد. اگر بهترین کار به‌روزرسانی یک مقاله موجود است، آن را در گزارش پیشنهاد بده، ولی امشب یک مقاله جدیدِ غیرتکراری منتشر کن.
- در اجرای خودکار، موضوعاتی را که به تشخیص پزشکی، درمان آسیب، مکمل یا رژیم درمانی نیاز دارند انتخاب نکن. این موضوعات را با وضعیت `REVIEW` برای بررسی انسانی ثبت کن.

## ۴. تحقیق و نوشتن

- بخش BEFORE WRITING ایجنت را کامل اجرا کن (WebSearch + WebFetch).
- **هر لینک خارجی را با WebFetch باز کن** و مطمئن شو واقعی است و ادعای مورد نظر را پشتیبانی می‌کند. لینکی که باز نشد را حذف کن.
- لینک‌های داخلی را فقط از URLهای واقعی موجود در inventory انتخاب کن.
- لینک‌های CTA همیشه UTM داشته باشند (`utm_content` برابر slug مقاله باشد).

## ۵. خروجی‌ها

در `content/articles/<slug>/` این فایل‌ها را بساز:

- `package.md`: FINAL ARTICLE PACKAGE کامل (۱۰ بخش) به‌همراه Pre-Publish Report
- `post.json`: ورودی `wp_publish.py` با این فیلدها:
  - `title`، `slug` (لاتین، کوتاه، با خط تیره)، `excerpt`
  - `content`: HTML بدنه مقاله، بدون H1 چون وردپرس عنوان را خودش نمایش می‌دهد. از `<h2>`، `<h3>`، `<p>`، `<ul>`، `<ol>`، `<table>`، `<a>` و `<strong>` استفاده کن. باکس CTA وسط مقاله و باکس منابع را با `<div>` و style درون‌خطی ساده بساز (پس‌زمینه `#fdf2f6`، حاشیه راست `4px solid #6B002A`، padding و border-radius ملایم). از `<script>` استفاده نکن.
  - `categories` و `tags`: تا جای ممکن از دسته‌بندی‌ها و برچسب‌های موجود سایت استفاده کن.
  - `publish_at_tehran`: `"<امروز به تاریخ میلادی> 20:30"`. تاریخ امروزِ تهران را با `TZ=Asia/Tehran date +%F` بگیر.
  - `image`: `{path, alt, title, caption, description}`
  - `meta` (اختیاری): اگر در inventory دیدی سایت از Rank Math یا Yoast استفاده می‌کند، Meta Title و Meta Description را با کلیدهای همان افزونه بگذار.
- `hero.png`: تصویر شاخص با این دستور:
  `NODE_PATH=$(npm root -g) node content/tools/hero_image.js "<عنوان کوتاه>" "<نام Pillar>" content/articles/<slug>/hero.png`
  سپس با Read تصویر را ببین و مطمئن شو متن کامل و خوانا است.

## ۶. کنترل کیفیت

۲۰ سؤال CONTENT QUALITY CONTROL و REALITY CHECK را اجرا کن و جواب‌ها را در `package.md` بنویس. اگر پاسخ یک مورد مهم «نه» بود، مقاله را اصلاح کن. اگر بعد از دو دور اصلاح هنوز رد می‌شود، منتشر نکن: وضعیت را `REVIEW` ثبت کن و دلیلش را گزارش کن.

## ۷. انتشار

1. `python3 content/tools/wp_publish.py publish content/articles/<slug>/post.json --dry-run`
2. `python3 content/tools/wp_publish.py publish content/articles/<slug>/post.json`
3. خروجی (id، status، link) را در `package.md` و `database.csv` ثبت کن. وضعیت را `PUBLISHED` بگذار؛ اگر status برابر future بود، در Notes بنویس «scheduled 20:30 Tehran».

## ۸. ثبت و گزارش

- `inventory.md` و `database.csv` را به‌روز کن و Next Opportunities را با وضعیت `IDEA` به دیتابیس اضافه کن.
- گزارش کوتاه `content/reports/<YYYY-MM-DD>-nightly.md` بنویس: چه منتشر شد، لینک آن، چرا این موضوع انتخاب شد، و ریسک‌ها.
- روزهای جمعه، Content Opportunity Report هفتگی (TOP 10) را هم در `content/reports/` بساز.
- همه تغییرات را commit کن و روی همان برنچ push کن.
