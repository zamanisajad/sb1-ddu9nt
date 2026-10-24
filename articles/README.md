# Articles for masports.ir (owner publishes by hand)

These articles are for **masports.ir**, the site «گروه ورزشی ما», which serves people interested in sports businesses.

- **Schedule:** Saturday, Monday, Thursday and Friday, ready by **18:00 Tehran time**.
- **Who writes them:** a scheduled task in the owner's Claude conversation.
- **How they're written:** with the `komak-morabi-content` skill at `.claude/skills/komak-morabi-content/`.
- **Publishing (since 2026-10-18): manual, by the owner.** For each article:
  - the Markdown source (`articles/<date>-<slug>.md`) is committed
  - an HTML copy is rendered with `scripts/render_article_html.py`; it shows the SEO fields at the top, then the body for copy-paste
  - the HTML copy is sent to the owner in the conversation, with a short notice
- **Direct publishing is ON (2026-10-24):** add `wp: publish` to the front matter. On push, GitHub Actions posts the article, uploads `<file>.cover.png` as the featured image with `image_alt`, and makes it live at `publish_at`. Older articles without the flag are never sent.
- **Ad banner (owner request, 2026-10-24):** the HTML in `scripts/ad-banner.html` is inserted automatically in the middle of every article, before the H2 nearest the middle. Don't add it by hand.
- **Cover image:** if the owner supplies a `<file>.cover.webp` or `.cover.jpg`, it is used instead of the generated `.cover.png`. When the cover changes, the featured image on the site is replaced.
- **Review:** the owner reads each article before pasting it. The skill's evidence rules still apply in full.

## File format
File name: `articles/YYYY-MM-DD-<slug>.md`. The date is the publish date in Tehran.

```markdown
---
title: عنوان مقاله (حداکثر حدود ۶۰ نویسه، کلیدواژهٔ اصلی در ابتدا)
slug: نشانی-کوتاه-فارسی
excerpt: توضیح متا، ۱۲۰ تا ۱۵۵ نویسه، یک جملهٔ روشن دربارهٔ فایدهٔ مقاله
publish_at: 2026-10-20T18:00:00+03:30
categories: [کسب و کار]
tags: [مربی بدنسازی, برنامه تمرینی]
focus_keyword: کلمهٔ کلیدی اصلی (برای Rank Math)
keywords: [۶ تا ۱۰ عبارت جست‌وجوی مرتبط و طولانی]
image_alt: متن جایگزین تصویر شاخص، شامل کلمهٔ کلیدی اصلی
wp: publish
---
متن مقاله با Markdown (## و ### برای تیترها، فهرست، **پررنگ**)
```

- **Slug:** the site's existing posts use Persian slugs. Keep slugs to 3–6 words, joined by «-», with no spaces.
- **Categories:** use only existing ones, usually one per article. Unknown categories are skipped.

  | Category | Use it for |
  |---|---|
  | `کسب و کار` | coach business, career and workflow |
  | `زندگی سالم` | training knowledge and athlete habits |
  | `مارکتینگ` | social media and marketing for coaches |
  | `مهارت کاربردی` | practical tools and skills |

- **Tags:** 2–5 per article. Missing tags are created automatically.
- `publish_at` always ends in `+03:30`.
- **SEO keywords and Rank Math.** The owner checks every article in Rank Math. `python3 scripts/seo_check.py <file>` must print no FAIL before delivery. Its checks:
  - `focus_keyword`: one main search phrase, written the way people type it into Google (no ezafe «ٔ» and no «ۀ», because Rank Math matches it literally).
  - `keywords`: 6–10 related phrases, including long questions such as «چطور … بنویسیم». Use several of them naturally in the text, because Rank Math counts them too.
  - The **title** starts with the focus keyword, contains a number (for example «در ۷ قدم»), and is at most 60 characters.
  - The **meta description** (`excerpt`) contains the focus keyword and is 120–160 characters.
  - The **slug** contains every word of the focus keyword.
  - The focus keyword appears in the **first sentence**, in at least one **H2**, and in the summary. Its density is 0.75–2.5%, and focus plus related keywords together reach at least 1%. Keep it natural: rephrase sentences rather than stuffing.
  - At least one **internal link** to a masports.ir post: an earlier article in this series, or one of the existing posts listed below, whichever is most relevant.
  - At least one **external link** to a credible source you actually opened in this session, such as a standards body, federation, university, peer-reviewed journal, WHO, ACSM or NSCA. Never link a page you didn't open.
  - `image_alt` contains the focus keyword. Make the cover with `node scripts/make_cover.js <file>`, which produces a title card only and never a fake app screen.
  - No paragraph is longer than about 120 words.

## Editorial rules (on top of the skill)
- **Audience:** Iranian sports and fitness coaches. Write in formal Persian, using «شما» or a neutral voice. The article should be useful without the app.
- **Length and structure:**
  - about 1,200–2,000 words
  - an intro that names a concrete problem in its first 2–3 sentences
  - 4–7 H2 sections with practical steps or examples
  - a short summary at the end
  - one CTA
- **Product mentions:** «کمک مربی» appears in at most about 1 in 3 articles, and then only through features marked ✅ or 🔒 in `references/product-claims.md`, flagging Pro where relevant. In the other articles, leave the product out, or give it one neutral line at most.
- **Banned:**
  - invented numbers, studies, quotes or testimonials
  - prices
  - AI claims
  - medical advice beyond general safety
  - claims of a guaranteed result («از ۱۰ به ۵۰ شاگرد»)
- **Sources:** cite a source only if you actually opened it during this session, and give its real link. With no accessible source, write from practical coaching knowledge and cite nothing. Never fabricate.
- **Overlap:** don't duplicate articles in this folder or the site's existing posts listed below. Choose a different angle or a narrower subtopic.
- **Scheduled mode:** skip the skill's "propose an outline and get approval" step, because the owner pre-approved one-pass writing. Still run the quality rubric privately, and revise until no criterion scores below 3 and the average is 4 or higher.

## Existing posts on masports.ir (as of 2026-10-18; don't duplicate them, and use them for internal links)
- [افزایش تعداد شاگردان مربی بدنسازی؛ ۷ راهکار عملی](https://masports.ir/%d8%a7%d9%81%d8%b2%d8%a7%db%8c%d8%b4-%d8%aa%d8%b9%d8%af%d8%a7%d8%af-%d8%b4%d8%a7%da%af%d8%b1%d8%af%d8%a7%d9%86-%d9%85%d8%b1%d8%a8%db%8c-%d8%a8%d8%af%d9%86%d8%b3%d8%a7%d8%b2%db%8c%d8%9b-%db%b7-%d8%b1/) (کسب و کار)
- [مدیر باشگاه موفق؛ چرا فقط مربی خوب بودن دیگر کافی نیست؟](https://masports.ir/%d9%85%d8%af%db%8c%d8%b1-%d8%a8%d8%a7%d8%b4%da%af%d8%a7%d9%87-%d9%85%d9%88%d9%81%d9%82%d8%9b-%da%86%d8%b1%d8%a7-%d9%81%d9%82%d8%b7-%d9%85%d8%b1%d8%a8%db%8c-%d8%ae%d9%88%d8%a8-%d8%a8%d9%88%d8%af%d9%86/) (کسب و کار)
- [راهنمای ساخت رزومه مربی ورزشی](https://masports.ir/%d8%b1%d8%a7%d9%87%d9%86%d9%85%d8%a7%db%8c-%d8%b3%d8%a7%d8%ae%d8%aa-%d8%b1%d8%b2%d9%88%d9%85%d9%87-%d9%85%d8%b1%d8%a8%db%8c-%d9%88%d8%b1%d8%b2%d8%b4%db%8c/) (کسب و کار)
- [ترندهای فیتنس ۲۰۲۶ برای مربیان ورزشی ایران](https://masports.ir/%d8%aa%d8%b1%d9%86%d8%af%d9%87%d8%a7%db%8c-%d9%81%db%8c%d8%aa%d9%86%d8%b3-%db%b2%db%b0%db%b2%db%b6/) (کسب و کار)
- [۶ مرحلهٔ عملی برای ساخت عادت ورزشی پایدار](https://masports.ir/%d8%b3%d8%a7%d8%ae%d8%aa-%d8%b9%d8%a7%d8%af%d8%aa-%d9%88%d8%b1%d8%b2%d8%b4%db%8c-%d9%be%d8%a7%db%8c%d8%af%d8%a7%d8%b1/) (زندگی سالم)
- [۲۵ راهکار علمی برای تغییر رفتار ورزشی مخصوص مربیان](https://masports.ir/%db%b2%db%b5-%d8%b1%d8%a7%d9%87%da%a9%d8%a7%d8%b1-%d8%b9%d9%84%d9%85%db%8c-%d8%aa%d8%ba%db%8c%db%8c%d8%b1-%d8%b1%d9%81%d8%aa%d8%a7%d8%b1-%d9%88%d8%b1%d8%b2%d8%b4%db%8c/) (زندگی سالم)
- [۷ محرک اصلی زندگی سالم](https://masports.ir/7-%d9%85%d8%ad%d8%b1%da%a9-%d8%a7%d8%b5%d9%84%db%8c-%d8%b2%d9%86%d8%af%da%af%db%8c-%d8%b3%d8%a7%d9%84%d9%85/) (زندگی سالم)
- Articles in this series are linked at `https://masports.ir/<slug>/`, which assumes the owner kept the suggested slug.
- Older posts cover Instagram, SEO, design and marketing.

## Topic backlog
Take the first unused topic. Once a topic is used, mark it `[x]` in the same commit as its article. When the list runs out, add 8 new topics with the same mix, then continue.

- [x] چطور برنامهٔ تمرینی شاگرد جدید را سریع‌تر بنویسیم، بدون افت کیفیت (کسب و کار · workflow)
- [x] کتابخانهٔ حرکات شخصی مربی: از کجا شروع کنیم و چطور مرتبش کنیم (مهارت کاربردی · education)
- [x] توضیح اجرای حرکت به شاگرد مبتدی: نشانه‌های کلامی کوتاه و اشتباه‌های رایج مربی‌ها (زندگی سالم · knowledge)
- [x] الگوی برنامه (تمپلیت) بسازیم یا هر بار از صفر بنویسیم؟ مرز بین الگو و شخصی‌سازی (کسب و کار · workflow, light product mention allowed)
- [ ] تکرار حرکت در برنامه‌های پشت‌سرهم: کِی مفید است و کِی باید عوضش کرد (زندگی سالم · knowledge)
- [ ] مربی تازه‌کار و شبکهٔ حرفه‌ای: یاد گرفتن از همکاران بدون رقابت ناسالم (کسب و کار · career)
- [ ] محتوای اینستاگرام برای مربی پرمشغله: روال هفتگی ۳۰ دقیقه‌ای (مارکتینگ · business)
- [ ] پروندهٔ شاگرد: چه اطلاعاتی را ثبت کنیم تا برنامهٔ بعدی بهتر شود (کسب و کار · workflow)
- [ ] از کاغذ به ابزار دیجیتال: گذار آرام برای مربی حضوری، بدون به‌هم ریختن کار (مهارت کاربردی · tools, light product mention allowed)
- [ ] شاگرد درد دارد: مرز کار مربی و زمان ارجاع به متخصص (زندگی سالم · knowledge/safety)
- [ ] معرفی و ارجاع: چطور شاگرد راضی، شاگرد بعدی را می‌آورد (کسب و کار · business)
- [ ] سوپرست، استراحت بین ست و زمان جلسه: نوشتن برنامه برای شاگردی که وقت کم دارد (زندگی سالم · knowledge)
- [ ] تحویل برنامه در همان روز ثبت‌نام: چرا شروع خوب، ماندگاری شاگرد را بیشتر می‌کند (کسب و کار · trust, light product mention allowed)
- [ ] ویدیوی آموزشی حرکت با گوشی: نور، زاویه و طول مناسب برای شاگرد (مهارت کاربردی · education)
- [ ] پیام‌رسان یا اپ؟ مدیریت ارتباط با شاگرد بدون غرق شدن در چت (کسب و کار · workflow)
- [ ] برنامه‌ریزی هفتگی مربی: جدا کردن زمان مربیگری، برنامه‌نویسی و یادگیری (کسب و کار · career)
