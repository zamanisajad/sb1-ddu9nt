# Validation — iteration 1 (2026-10-18)

## What was run
- **Format check:** skill-creator `quick_validate`.
  - The first run failed: an unquoted colon in `description` broke the YAML. After the fix it reported "Skill is valid!".
- **Pickup check:** after the commit, the Claude Code session listed `komak-morabi-content` among its available skills, with its description.
- **Behaviour test:** 3 prompts from the brief, each run by a separate Claude subagent in two ways:
  - **with the skill:** it read SKILL.md and the references
  - **baseline:** the same prompt, told only that «کمک مربی» is an Iranian coach app, with no skill or files
- **Automatic checks:** 9 per output, from `grade.py`. They look for:
  - AI or «هوشمند» claims
  - percentages
  - prices
  - hype words
  - the banned opener
  - library-size claims
  - invented time savings
  - unverified features
  - a stated objective
- **Manual review:** by the assistant that wrote the skill. The owner has not reviewed it yet.

The subagents ran in Claude Code, not in the claude.ai Skills runtime. They loaded the skill by reading its files when instructed. Automatic triggering was not tested.

## Results (`iteration-1-benchmark.md`)
| | With skill | Baseline |
|---|---|---|
| Automatic checks passed | 27/27 (100%) | 20/27 (74%) |
| Mean time / tokens | 60 s / 69k | 37 s / 51k |

Baseline failures:
- Reel: «از یک ساعت به چند دقیقه», «۱۰ ساعت فقط تایپ», «کتابخانه آماده».
- Telegram: «۵۰۰ حرکت», and no stated objective.
- Activation: «هوشمند»-style framing, «کمتر از ۹۰ ثانیه», and invented features: a sport picker, AI-style exercise suggestions, a WhatsApp/Eitaa export, and a slider UI.

## Manual review against the brief's criteria
| Criterion | Reel | Telegram | Activation |
|---|---|---|---|
| Intended persona | ✅ Segment A, in-person, paper or messaging app | ✅ repeated technique explanations (from the interview) | ✅ A plus B, a new athlete, interruptions at the gym |
| Natural Persian | ✅ colloquial, concrete scenes | ✅ conversational, a real technique cue (RDL hip hinge) | ✅ |
| No generic marketing language | ✅ no hype, «کاغذ هم جواب می‌ده» | ✅ | ✅ «برنامه‌نویسی با اپ. مربیگری با خودت.» |
| No invented capabilities | ✅ only templates and draft autosave (✅ in the code) | ✅ no product. Notes Pro and team review for custom videos. | ✅ builder, autosave, review, send. Flags that the free plan is limited without quoting a number. |
| Clear objective and one CTA | ✅ education → save | ✅ education → film 3 exercises this week | ✅ activation → send a first real program |
| Useful, not just promotion | ✅ a 3-step method that works without the app | ✅ 5 steps plus a safety note | ✅ a 3-step first-program routine that works without the app |

Observations:
- Each output flags that its evidence comes from a single interview, asks for real screen recordings, adds an injury-referral note, and proposes a funnel-correct metric. For activation, that metric is a first program sent within 7 days, not views.
- The activation output chose Reels as its channel without asking, and stated that as an assumption. That's acceptable under the skill's "state assumptions" rule.
- Cost: the skill adds about 20 s and 18k tokens per request, from reading the reference files.

## Open items for iteration 2
- The owner reviews `review-iteration-1.html`. Open it in a browser, leave notes, and click "Submit All Reviews" to download `feedback.json`.
- Test triggering in claude.ai with near-miss prompts. Examples: a coach asking for an actual workout program, which is not marketing; or general Instagram tips for a gym owner.
- Test segment D and a performance-data analysis prompt.
