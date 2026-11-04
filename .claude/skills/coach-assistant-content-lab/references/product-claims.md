# Product capabilities and claim rules

**Source:** the product codebase `zamanisajad/coach-helper`, branch `main`, commit `6c00522`, read on 2026-10-18. File paths below are in that repo.
**Limit:** this file describes what the code does. It does not prove a feature is released to every user. The web app (app.assistantcoach.ir) redeploys automatically from `main`. The Android app only updates after a new build is published. Before a campaign that leans on one feature, ask the team to confirm it is live on the platform you're promoting.

Status key:
- ✅ verified in code, safe to show. Still use a real screen recording.
- 🔒 verified, but **Pro subscription only**. Say so whenever you promote it.
- ⚠️ in code, but release or availability needs confirmation before you advertise it.
- 🧪 hypothesis or roadmap. Never present it as available.
- ⛔ never claim.

## Platforms and links
- ✅ Web app at **app.assistantcoach.ir**, installable as a home-screen app. Landing site at **assistantcoach.ir**. Android APK from the landing page.
- ⛔ Don't claim an iOS App Store, Google Play, Cafe Bazaar or Myket listing unless the team confirms one.

## For coaches: everyday workflow
- ✅ **Program builder in three steps: pick the athlete → write the program → send it** (`app/coach/exercises/index.tsx`, `app/coach/programs/builder.tsx`).
  - Training days, with any number of exercises per day.
  - Sets, reps and rest time per exercise. Timed exercises (duration in seconds) are supported.
  - Supersets: «سوپرست با حرکت بعدی», done back-to-back without rest.
  - An optional note for each exercise.
  - **The draft saves automatically.** The coach can leave and come back to it: «تغییرات خودکار ذخیره می‌شود».
  - **Review before sending** (`components/ProgramReview.tsx`). The athlete receives it in their app.
- ✅ **Templates.** Save a program as a template («ذخیره به‌عنوان الگو»), reuse it, edit it in the builder, or «ارسال سریع» it to an athlete (`app/coach/programs/templates.tsx`).
- ✅ **Optional nutrition plan inside the same program**: meals, calories, protein, carbs and fat (builder section «برنامهٔ تغذیه (اختیاری)»).
- ✅ **Exercise library with search and filters** by muscle, equipment and difficulty, plus a media preview of each exercise (`app/coach/exercises/library.tsx`).
  - ⛔ Don't state a size or number for the library. A large imported library (771 exercises) was **removed** in migration 0054 because it made the app heavy. The library now holds exercises added by the team and by coaches. Avoid «هزاران حرکت» and similar.
- 🔒 **Custom exercises** with name, muscle groups, equipment, difficulty, instructions, and an image or video (`app/coach/exercises/new.tsx`).
  - **Uploaded videos are reviewed by the team before they appear** (status `pending → approved`).
  - Size, length and count limits are set by the team and can change, so don't quote them.
  - This is what the interviewed coach valued: building their own library of demonstrations.
- ⚠️ **"Already used for this athlete" marker.** When a coach writes a program for a specific athlete, exercises from that athlete's earlier programs are tagged «قبلاً در برنامهٔ این شاگرد». A hint says «می‌توانی دوباره انتخابش کنی؛ این فقط یادآوری است» (`app/coach/programs/pick-exercise.tsx`, `useExerciseHistory`).
  - This matches the interviewed coach's suggestion.
  - It's in the code on `main`. **Confirm with the team that it's live** before promoting it.
  - Once confirmed, it makes a strong "you asked, we built it" trust story. Get the coach's consent before naming them.
- ✅ **Athlete file** (`app/coach/athletes/[id].tsx`):
  - program history: active, finished, draft and archived
  - nutrition plans
  - logged workouts
  - attendance count
  - weight and BMI charts
  - progress photos
  - «اشتراک‌گذاری پیشرفت»
  - «پیام به شاگرد»
- ✅ **Attendance check-in** from the coach home screen («ثبت حضور»), which suits in-person coaching.
- ✅ **Add an athlete by mobile number.** The athlete gets an SMS. If they already have an account, they must accept the link (`app/coach/athletes/new.tsx`).
- ✅ **Chat** with athletes: replies, edits, reactions. Voice messages can be recorded on web; native apps only play them.

## For coaches: business
- ✅ Athletes can **request a program online** from a coach's sales plans. Flow: intake form → coach accepts or rejects with a reason → online payment → coach builds and sends the program.
- ✅ **Discount codes**, a **wallet** and **payout requests**. The platform takes a commission, configurable by the team. ⛔ Don't quote a percentage.
- ✅ **Public coach listing** in the athletes' coach directory. Coaches can get a **blue verification badge** through identity verification, and a «مربی ویژه» upgrade puts them higher in the list. 🔒 Being listed is a Pro benefit.
- 🔒 **Birthday SMS** to athletes (`components/BirthdaySmsSection.tsx`).
- ✅ **Invite coaches** with an invite code. Rewards for coaches you invite are tracked (`app/coach/profile/invite.tsx`). ⛔ Don't state reward amounts.
- ✅ In-app **tutorial tour** («آموزش اپ»), and support tickets.

## Free vs Pro
- Free: a limited number of programs. The limit is set by the team and was 3 in the original settings. ⛔ Don't quote the number unless the team confirms the current value.
- 🔒 Pro, as listed in the app (`app/coach/subscription.tsx`): «افزودن شاگرد نامحدود», «افزودن حرکت‌های دلخواه شما», «نمایش در فهرست مربیان». Also birthday SMS.
- ⛔ **Prices, discounts and trial periods are never written into content.** The team sets them in the admin panel and they change. If a piece needs a price, put a placeholder: «[قیمت — از تیم بپرسید]».

## For athletes (useful context for coach content)
- ✅ The athlete gets the program in the app, with exercise media and «نحوهٔ اجرای حرکت».
- ✅ A **guided workout session** with rest timers, supersets run round by round, resume later, and a rating after the session.
- ✅ Logging weight and height, a BMI view, and the nutrition plan.

## AI and «هوشمند»
- ⛔ **The code has no AI or machine-learning feature.** A search for AI or LLM terms across the app, library and server functions found nothing.
- ⛔ Don't write «هوش مصنوعی», «AI», or «برنامه را خودکار می‌نویسد».
- The landing page tagline is «دستیار هوشمند مربیان و ورزشکاران» (`landing/content.json`). This conflicts with the brand rule. Prefer «دستیار دیجیتال مربیان ورزشی». If asked, point out the mismatch to the team rather than repeating it.

## Things you may not invent
Never invent user counts, measured time savings («۸۰٪ سریع‌تر»), testimonials, ratings, partner gyms, integrations, scientific claims, or guaranteed outcomes.

When copy needs a number, either:
- ask for real data, or
- use a placeholder with a note, for example «[تعداد کاربران — داده واقعی لازم است]».

Safe, honest benefit phrasing:
- «پیش‌نویس خودکار ذخیره می‌شود»
- «برنامهٔ قبلی را به‌عنوان الگو نگه دار و برای شاگرد بعدی ویرایشش کن»
- «حرکت‌ها و ویدیوهای خودت یک‌جا»

## Existing marketing assets (in this content repo)
- `deliverables/coach-helper-promo.mp4`: a 19-second, 1080×1350 promo. Its source is in `deliverables/promo-video-source/`. It uses real app screenshots (`coach-home`, `builder`, `athlete-file`, `athlete-progress`) from `landing/public/l/` in the product repo.
  - Captions: «اپلیکیشن کمک مربی / دستیار دیجیتال مربیان ورزشی»، «همه‌چیز در یک جا»، «برنامه بنویس، نه جدول»، «با یک نگاه ببین»، «مدیریت کمتر، مربیگری بیشتر».
- `deliverables/exercise-demo-goblet-squat.mp4` and `.gif`: an exercise preview loop.
- `deliverables/coach-helper-install-qr.png`: a QR code for installing the web app.

Reuse these assets for demos instead of describing UI that nobody has seen.

## How to update this file
When the product changes, re-check the code or the release notes. Then update the status markers and the commit and date at the top, and add a line to `learning-log.md`.
