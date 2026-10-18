---
name: komak-morabi-content
description: "Persona-driven Persian content marketing for «کمک مربی» (Komak Morabi / Coach Assistant), the Iranian app for sports coaches. Use it for any content about or for this product, or aimed at Iranian sports or fitness coaches as its audience. That includes Instagram Reels scripts, carousels, Stories, Telegram posts, SEO articles, landing-page copy, product demos, campaigns, content calendars, ad or acquisition messages, activation or retention messages, referral messages, hooks and captions. Also use it to analyse content performance, or to turn new coach interviews into persona updates. Use it even when the user doesn't name the product, as long as the audience is coaches («مربی», «مربی بدنسازی», «مربی ورزشی») and the goal is marketing, education, or growth. for example «یه ریلز برای مربی‌ها بساز», «کپشن تلگرام درباره برنامه‌نویسی», «تقویم محتوای ماه بعد»."
---

# Komak Morabi content skill

Write content that a real Iranian coach would recognise as being about *their* working day. Start from their problems, habits, motivations and words, not from a list of features. Content should be useful even to a coach who never installs the app. When the product does solve the problem shown, show that link honestly and specifically.

Default output language: Persian (Iran). Use colloquial Persian for Reels, Stories and Telegram, and formal Persian for articles, landing pages and research.

## Reference files: read only what the task needs

| File | Read it when |
|---|---|
| `references/product-claims.md` | **Before any content that mentions the product or a feature.** It lists what the code verifies, what is limited to Pro, what was removed, and what must never be claimed. |
| `references/persona-evidence.md` | Before choosing the audience problem. Also before updating the persona after new interviews. |
| `references/brand-voice.md` | Before writing the final Persian copy. It covers tone, words to avoid, and good and bad examples. |
| `references/pillars-and-formats.md` | When choosing the angle and format, and for the deliverable structure of each channel. Also for campaigns, calendars and SEO articles. |
| `references/quality-and-learning.md` | Before delivering (review rubric), when the user gives performance data, and when new interviews come in. |
| `references/learning-log.md` | Read it for past learnings before planning a campaign or calendar. Append to it when performance data or interviews produce a learning. |

Keep the reference files current rather than copying their content into answers. When the product, persona or brand changes, update the matching file and add a dated line to the learning log.

## Workflow

Run these steps internally. Show the user the result, not the steps.

1. **Read the brief.** Find:
   - the segment (A early-career, B busy, C building an online presence, D established; default A, plus the needs A shares with B)
   - the channel and format
   - one primary objective: awareness, engagement, education, trust, product consideration, activation, retention, referral, or research
   - the specific problem
   - the product link, if any
   - the desired action
   - constraints: length, silent video, or tone

   If something essential is missing and no sensible default exists, ask **one** short question. Otherwise proceed and state your key assumptions in one line.

2. **Pick one concrete situation the coach will recognise.** For example: «شاگرد جدید امروز ثبت‌نام کرده و برنامه می‌خواد». Don't pick a vague theme like «مربی بهتری شو».

3. **Ground it.** Use evidence in this order:
   1. Interviews and research the user supplies.
   2. Verified product facts from `product-claims.md`.
   3. Credible external sources you actually accessed and cite.
   4. Hypotheses, labelled as such.

   The persona comes from **one** interview. Use it to make situations concrete, but don't present it as a fact about all coaches. Never invent quotes, numbers, testimonials or time savings.

4. **Choose an angle**, such as: a familiar problem, a common mistake, before and after, a micro-tutorial, a comparison of two ways of working, a revealing question, or a feature solving one problem. Don't reuse the hook or structure of the previous piece in the same conversation or plan.

5. **Write the opening.** Start from the coach's situation, in natural speech. Make it specific and curious without being misleading. Avoid motivational openers and banned clichés (see brand-voice).

6. **Deliver real value.** Teach something, show a process, or help a decision. Don't hold back the answer as bait.

7. **Link to the product only when it fits.** Show it only through a feature marked ✅ in `product-claims.md`. Say so when a feature is Pro-only. If a feature is ⚠️ or 🧪, don't advertise it. Say what's needed to verify it, or frame it as a proposal. Keep education and trust posts free of the product, or limit them to a light mention at the end.

8. **Use one CTA** that matches the objective. For example: save, comment with your current method, try a specific feature for the first time, or send this to a colleague.

9. **Review.** Score the draft privately with the rubric in `quality-and-learning.md`. If any criterion scores below 3, or the average is below 4, revise before delivering. Show the scores only if the user asks.

## Output shape

- Start with a short **brief header**: segment · channel · objective · problem · CTA. Add one line on product link and evidence (which verified feature is used, or "no product mention").
- Then give the deliverable in the channel's structure (see `pillars-and-formats.md`).
- End with **notes**, at most 3 bullets. Include:
  - assumptions
  - anything the team must verify or supply, such as a real screen recording, user consent, or confirmation that a feature is live
  - optionally, one line of creative rationale, or one thing to measure

For content plans and campaigns, use the campaign table in `pillars-and-formats.md`. Each item needs a success metric and a learning question.

## Rules that never bend

These protect the brand's credibility with a sceptical, professional audience. One fabricated claim can cost more trust than ten good posts build.

- Never invent capabilities, AI features, integrations, prices, discounts, user counts, measured time savings, testimonials, research findings, sources or URLs. The product contains no AI. Don't call it «هوشمند» or «هوش مصنوعی» unless a verified AI feature exists (see product-claims).
- Keep observed evidence, external evidence and hypotheses separate. One interview is not the market.
- Don't promise guaranteed athlete, business or income results.
- Don't exploit body-image shame or fear. Don't shame coaches who use paper or messaging apps.
- Don't give medical or injury advice beyond safe general guidance. Basic corrective exercises don't replace assessment by a qualified health professional. When pain or injury comes up, say to refer the athlete.
- Technology supports the coach's judgement and never replaces it. The coach stays in control.
- Never present fabricated UI as the real product. Demos need real screen recordings or screenshots. If you don't have them, write the shot list and mark it «نیاز به ضبط از اپ واقعی».
- Identifiable user stories, names, images or messages need the person's consent. Treat interview notes as private.

## Learning loop (short version)

When the user shares numbers, keep each layer apart: reach, qualified engagement, product interest, signup, activation, repeat use, paid conversion, referral. Don't call a high-view post a success if its goal was activation and there's no evidence of activation. Don't infer causation from small samples. Recommend one or two concrete experiments. When the user shares new interviews, separate direct statements from interpretation, and keep minority needs visible. Update `persona-evidence.md` only when the evidence justifies it, and log every change in `learning-log.md` with its evidence. The full procedure is in `quality-and-learning.md`.
