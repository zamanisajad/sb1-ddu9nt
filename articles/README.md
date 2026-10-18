# Articles for masports.ir (automatic publishing)

Every Markdown file in this folder (except this README) is published to **masports.ir** by
`.github/workflows/publish-articles.yml` as soon as it's pushed. The site is «گروه ورزشی ما», which serves people interested in sports businesses.

- **Schedule:** Saturday, Monday, Thursday and Friday, **18:00 Tehran time**.
- **Who writes them:** a scheduled Claude task, about two hours before publish time.
- **How they're written:** with the `komak-morabi-content` skill at `.claude/skills/komak-morabi-content/`.
- **Review:** the owner chose direct publishing with no manual review step. That makes the skill's evidence rules the only safeguard. Follow them strictly.

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
- **Images:** none are uploaded automatically. Don't reference images that don't exist.

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
- **Automated mode:** skip the skill's "propose an outline and get approval" step, because the owner pre-approved one-pass writing. Still run the quality rubric privately, and revise until no criterion scores below 3 and the average is 4 or higher.

## Existing posts on masports.ir (as of 2026-10-18, don't duplicate)
- افزایش تعداد شاگردان مربی بدنسازی؛ ۷ راهکار عملی (کسب و کار)
- مدیر باشگاه موفق؛ چرا فقط مربی خوب بودن دیگر کافی نیست؟ (کسب و کار)
- راهنمای ساخت رزومه مربی ورزشی (کسب و کار)
- ترندهای فیتنس ۲۰۲۶ برای مربیان ورزشی ایران (کسب و کار)
- ۶ مرحلهٔ عملی برای ساخت عادت ورزشی پایدار (زندگی سالم)
- ۲۵ راهکار علمی برای تغییر رفتار ورزشی مخصوص مربیان (زندگی سالم)
- ۷ محرک اصلی زندگی سالم (زندگی سالم)
- Older posts: Instagram, SEO, design and marketing.

## Topic backlog
Take the first unused topic. Once a topic is used, mark it `[x]` in the same commit as its article. When the list runs out, add 8 new topics with the same mix, then continue.

- [ ] چطور برنامهٔ تمرینی شاگرد جدید را سریع‌تر بنویسیم، بدون افت کیفیت (کسب و کار · workflow)
- [ ] کتابخانهٔ حرکات شخصی مربی: از کجا شروع کنیم و چطور مرتبش کنیم (مهارت کاربردی · education)
- [ ] توضیح اجرای حرکت به شاگرد مبتدی: نشانه‌های کلامی کوتاه و اشتباه‌های رایج مربی‌ها (زندگی سالم · knowledge)
- [ ] الگوی برنامه (تمپلیت) بسازیم یا هر بار از صفر بنویسیم؟ مرز بین الگو و شخصی‌سازی (کسب و کار · workflow, light product mention allowed)
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
