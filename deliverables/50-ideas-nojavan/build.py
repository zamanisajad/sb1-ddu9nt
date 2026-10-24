# ساخت فایل HTML راهنمای «۵۰ ایده برای جذب نوجوان‌ها» از ideas.txt
# اجرا: python3 build.py && node pdf.js
import html, re

FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
def fa(n): return str(n).translate(FA)
def esc(s): return html.escape(s, quote=False)

cats, ideas = [], []
for block in open("ideas.txt", encoding="utf-8").read().split("\n"):
    line = block.rstrip()
    if line.startswith("@cat|"):
        _, key, name, desc = line.split("|", 3)
        cats.append({"key": key, "name": name, "desc": desc, "ideas": []})
    elif line.startswith("#|"):
        idea = {"title": line[2:], "steps": [], "foreign": None, "safe": None, "convert": None, "meta": "", "why": ""}
        cats[-1]["ideas"].append(idea); ideas.append(idea)
    elif line.startswith("- "):
        ideas[-1]["steps"].append(line[2:])
    elif "|" in line:
        k, v = line.split("|", 1)
        if k == "foreign":
            text, url = v.rsplit("|", 1); ideas[-1]["foreign"] = (text, url)
        else:
            ideas[-1][k] = v
assert len(ideas) == 50, len(ideas)
for i, idea in enumerate(ideas, 1): idea["n"] = i

SOURCES = [
    ("سازمان جهانی بهداشت، برگهٔ اطلاعات فعالیت بدنی", "https://www.who.int/news-room/fact-sheets/detail/physical-activity"),
    ("NIQ و World Data Lab، گزارش Spend Z (۲۰۲۴)", "https://nielseniq.com/global/en/news-center/2024/niq-and-world-data-lab-unveil-spend-z-report"),
    ("Pew Research Center، نوجوانان، شبکه‌های اجتماعی و فناوری (۲۰۲۴)", "https://www.pewresearch.org/internet/2024/12/12/teens-social-media-and-technology-2024/"),
    ("Aspen Institute Project Play، بچه‌ها بیشتر ورزش‌ها را تا ۱۱ سالگی رها می‌کنند", "https://projectplay.org/news/kids-quit-most-sports-by-age-11"),
    ("junior parkrun", "https://www.parkrun.com/about/join-us/junior-parkrun/"),
    ("The Daily Mile", "https://thedailymile.co.uk/?p=191"),
    ("Heart Foundation استرالیا، Jump Rope for Heart", "https://heartfoundation.org.au/how-you-can-help/jump-rope-for-heart"),
    ("This Girl Can، Studio You", "https://www.thisgirlcan.co.uk/campaign-hub/studio-you"),
]

INTRO = """
<h2 class="sec">چرا نوجوان‌ها و نسل زد؟</h2>
<p class="lead">جمعه ۸ آبان روز نوجوان است و چهارشنبه ۱۳ آبان روز دانش‌آموز. خیلی از مربی‌ها این دو روز را با یک استوری تبریک رد می‌کنند؛ ولی همین دو مناسبت، فرصت خوبی است تا با یک برنامهٔ واقعی، بین نوجوان‌ها و خانواده‌هایشان شناخته شوید. این راهنما ۵۰ ایدهٔ قابل اجرا در ایران را با مراحل قدم‌به‌قدم کنار هم گذاشته است.</p>

<div class="why-grid">
<div class="why"><div class="why-h">۱. نیاز واقعی است</div>
<p>طبق سازمان جهانی بهداشت، <b>۸۱٪ نوجوانان ۱۱ تا ۱۷ ساله</b> در جهان به اندازهٔ توصیه‌شده فعالیت بدنی ندارند؛ این عدد برای دختران ۸۵٪ و برای پسران ۷۸٪ است. همان منبع می‌گوید فعالیت بدنی برای نوجوان‌ها به آمادگی جسمانی، سلامت قلب و استخوان، سلامت روان و کارکرد شناختی کمک می‌کند. یعنی مربی‌ای که نوجوان‌ها را به ورزش برمی‌گرداند، هم بازار دارد و هم کار مهمی انجام می‌دهد.</p></div>

<div class="why"><div class="why-h">۲. وزن اقتصادی نسل زد</div>
<p>گزارش «Spend Z» شرکت NIQ و World Data Lab نسل زد را متولدان ۱۹۹۷ تا ۲۰۱۲ تعریف می‌کند؛ حدود <b>۲۵٪ جمعیت جهان</b> (حدود ۲ میلیارد نفر). این گزارش پیش‌بینی می‌کند قدرت خرید این نسل تا سال ۲۰۳۰ به حدود <b>۱۲ تریلیون دلار</b> برسد. این عددها جهانی‌اند، نه مخصوص ایران؛ اما پیامشان روشن است: نوجوان امروز، مشتری اصلی چند سال آینده است. در مورد مربی، این یعنی نوجوانی که از ۱۴ سالگی با شما تمرین را شروع کند، می‌تواند سال‌ها شاگرد شما بماند و خانواده و دوستانش را هم بیاورد.</p></div>

<div class="why"><div class="why-h">۳. ترندها دست آن‌هاست</div>
<p>طبق نظرسنجی ۲۰۲۴ مرکز Pew (نوجوانان ۱۳ تا ۱۷ سالهٔ آمریکا)، حدود ۹ نفر از ۱۰ نوجوان از یوتیوب و حدود ۶ نفر از ۱۰ از تیک‌تاک و اینستاگرام استفاده می‌کنند و نزدیک به نیمی می‌گویند «تقریباً همیشه» آنلاین‌اند. گزارش NIQ هم می‌گوید نسل زد خریدش را آنلاین شروع می‌کند، از شبکه‌های اجتماعی تأثیر زیادی می‌گیرد، نظر خریداران دیگر برایش مهم‌ترین عامل است و به رابطهٔ واقعی با برندها و اینفلوئنسرها اهمیت می‌دهد. آمار ایران ممکن است فرق داشته باشد، ولی الگو آشناست: تجربه‌ای که ارزش استوری کردن داشته باشد، خودش تبلیغ شما می‌شود.</p></div>

<div class="why"><div class="why-h">۴. نوجوان چرا می‌ماند و چرا می‌رود</div>
<p>گزارش نظرسنجی Aspen Institute Project Play (آمریکا) نشان می‌دهد بچه‌ها به‌طور میانگین حدود ۱۱ سالگی ورزش را رها می‌کنند و رایج‌ترین دلیل (۳۶٪ موارد) این است که دیگر لذت نمی‌برند یا علاقه‌شان را از دست داده‌اند. مهم‌ترین خواستهٔ والدین هم «لذت بردن فرزند» بوده است. درس عملی برای مربی: <b>لذت، دوستان و پیشرفت قابل دیدن</b>؛ سه چیزی که همهٔ ایده‌های این راهنما رویشان ساخته شده‌اند.</p></div>
</div>

<h2 class="sec">چطور از این راهنما استفاده کنید</h2>
<ul class="how">
<li><b>یک ایده انتخاب کنید، نه ده تا.</b> برای ۸ و ۱۳ آبان یک ایدهٔ ساده که امسال اجرا می‌کنید، بهتر از ده ایدهٔ نیمه‌کاره است. ایده‌هایی که برچسب «مناسب ۸ آبان» یا «مناسب ۱۳ آبان» دارند، با آماده‌سازی کوتاه اجرا می‌شوند.</li>
<li><b>دسته‌بندی:</b> الف) مربی تک‌نفره · ب) همکاری چند مربی · ج) باشگاه‌ها · د) مدرسه و خانواده · ه) آنلاین و شبکه‌های اجتماعی.</li>
<li><b>هر ایده</b> شامل این‌هاست: چرا جواب می‌دهد، مراحل اجرا، چطور شرکت‌کننده را به شاگرد تبدیل کنید، و در صورت وجود یک نمونهٔ خارجی و نکتهٔ ایمنی.</li>
<li><b>قیمت‌ها را خودتان تعیین کنید.</b> این راهنما عمداً قیمت پیشنهاد نمی‌دهد چون شرایط هر شهر و هر باشگاه فرق دارد.</li>
</ul>
"""

SAFETY = """
<h2 class="sec">قبل از هر کاری: چک‌لیست ایمنی و اعتماد</h2>
<p>کار با زیر ۱۸ ساله‌ها مسئولیت بیشتری دارد. رعایت این موارد، علاوه بر ایمنی، به والدین نشان می‌دهد با یک مربی حرفه‌ای طرف‌اند.</p>
<div class="check">
<div>☐ <b>رضایت‌نامهٔ کتبی ولی</b> برای شرکت در برنامه، به همراه شمارهٔ تماس اضطراری.</div>
<div>☐ <b>رضایت جداگانه برای عکس و فیلم.</b> بدون آن، چهرهٔ نوجوان را منتشر نکنید و او را تگ نکنید.</div>
<div>☐ <b>پرسش‌نامهٔ کوتاه سلامت:</b> بیماری، آسیب قبلی، داروی خاص. در صورت تردید، تأیید پزشک بگیرید.</div>
<div>☐ <b>شدت متناسب با سن:</b> تکنیک قبل از وزنه. رکوردگیری با حرکات وزن بدن یا مهارتی؛ نه تست وزنهٔ حداکثری در رویداد عمومی.</div>
<div>☐ <b>نسبت مربی به نوجوان</b> را از قبل تعیین کنید و برای گروه‌های بزرگ کمک‌مربی یا داوطلب بزرگسال داشته باشید.</div>
<div>☐ <b>آب، جعبهٔ کمک‌های اولیه</b> و یک نفر آشنا به کمک‌های اولیه در محل.</div>
<div>☐ <b>ضوابط محلی:</b> مجوز پارک یا شهرداری برای رویداد عمومی، قوانین باشگاه، ضوابط مربوط به مربی هم‌جنس و فضای خصوصی، و بیمهٔ ورزشی شرکت‌کننده‌ها.</div>
<div>☐ <b>بدون مقایسهٔ بدن:</b> وزن و ظاهر را عمومی اندازه نگیرید و مقایسه نکنید. پیشرفت را با عملکرد نشان دهید.</div>
<div>☐ <b>درد و آسیب:</b> تشخیص ندهید؛ به پزشک یا فیزیوتراپیست ارجاع دهید.</div>
<div>☐ <b>ارتباط حرفه‌ای:</b> پیام‌ها و هماهنگی‌ها ترجیحاً با ولی یا در گروه‌هایی که ولی هم حضور دارد.</div>
</div>
"""

PLAN = """
<h2 class="sec">برنامهٔ ۶ روزه تا جمعه ۸ آبان</h2>
<table class="plan">
<tr><th>روز</th><th>کار</th></tr>
<tr><td>شنبه ۲ آبان</td><td>یک ایده انتخاب کنید (پیشنهاد برای شروع: ۱، ۲، ۷، ۱۳ یا ۲۹). مکان و ساعت را قطعی کنید.</td></tr>
<tr><td>یکشنبه ۳ آبان</td><td>فرم ثبت‌نام و رضایت‌نامهٔ ولی را آماده کنید. اگر با مربی‌های دیگر کار می‌کنید، نقش‌ها و هزینه‌ها را تقسیم کنید.</td></tr>
<tr><td>دوشنبه ۴ آبان</td><td>اطلاع‌رسانی: استوری، پیام به والدین شاگردهای فعلی، گروه‌های محله، و اگر ممکن است مدرسه‌های نزدیک.</td></tr>
<tr><td>سه‌شنبه ۵ آبان</td><td>وسایل را آماده کنید: مخروط، طناب، کارت رکورد یا گواهی، آب و جعبهٔ کمک‌های اولیه.</td></tr>
<tr><td>چهارشنبه ۶ آبان</td><td>یادآوری به ثبت‌نام‌شده‌ها، تمرین اجرای برنامه با داوطلب‌ها، آماده کردن پیشنهاد ادامه (جلسهٔ آزمایشی یا دوره).</td></tr>
<tr><td>پنجشنبه ۷ آبان</td><td>چک نهایی مکان و فهرست شرکت‌کننده‌ها. یک استوری «فردا می‌بینیمتون».</td></tr>
<tr><td>جمعه ۸ آبان</td><td>اجرا. با اجازهٔ والدین عکس بگیرید و همان روز از شرکت‌کننده‌ها تشکر کنید.</td></tr>
<tr><td>تا ۱۳ آبان</td><td>پیگیری ظرف ۴۸ ساعت، و یک برنامهٔ کوچک‌تر برای روز دانش‌آموز (مثلاً ایدهٔ ۵، ۳۱، ۴۲ یا ۴۷).</td></tr>
</table>
"""

FOLLOW = """
<h2 class="sec">از رویداد تا شاگرد ثابت</h2>
<p>رویداد فقط شروع است. بیشتر نتیجه در ۴۸ ساعت بعد از آن ساخته می‌شود.</p>
<ol class="steps">
<li><b>ظرف ۲۴ تا ۴۸ ساعت</b> به والدین پیام تشکر بدهید، به همراه یک نکتهٔ شخصی دربارهٔ فرزندشان (مثلاً «تعادلش خیلی خوب بود»).</li>
<li><b>یک پیشنهاد مشخص و محدود</b> بدهید: جلسهٔ آزمایشی رایگان، یا ثبت‌نام دوره با مهلت واقعی (مثلاً تا ۱۳ آبان).</li>
<li><b>فهرست علاقه‌مندان</b> را با اجازه نگه دارید (نام، شمارهٔ ولی، علاقه) و برای رویداد بعدی خبرشان کنید.</li>
<li><b>نتیجه را بسنجید:</b> چند نفر آمدند، چند نفر جلسهٔ آزمایشی گرفتند، چند نفر ثبت‌نام کردند. دفعهٔ بعد ایده‌ای را تکرار کنید که بیشترین ثبت‌نام را داشته، نه بیشترین بازدید را.</li>
</ol>
<div class="app">
<div class="app-h">اگر با «کمک مربی» کار می‌کنید</div>
<p>بعد از ثبت‌نام، می‌توانید شاگرد را با شمارهٔ موبایلش اضافه کنید، برنامهٔ تمرینی را در اپ بنویسید و برایش بفرستید تا حرکت‌ها را با توضیح اجرا ببیند، برنامه‌ای را که برای یک گروه نوشته‌اید به‌عنوان الگو ذخیره کنید و برای نفرات بعدی سریع بفرستید، و برای پیشنهاد ویژهٔ رویداد کد تخفیف با بازهٔ زمانی بسازید. برای جلسه‌های حضوری هم ثبت حضور دارد. app.assistantcoach.ir</p>
</div>
"""

def chip(t): return f'<span class="chip">{esc(t)}</span>'

def idea_html(i):
    meta = " ".join(chip(m.strip()) for m in i["meta"].split("·"))
    occ = ""
    steps = "".join(f"<li>{esc(s)}</li>" for s in i["steps"])
    out = [f'<div class="idea" id="i{i["n"]}"><div class="ih"><span class="num">{fa(i["n"])}</span><h3>{esc(i["title"])}</h3></div>',
           f'<div class="meta">{meta}</div>', f'<p class="why1"><b>چرا جواب می‌دهد:</b> {esc(i["why"])}</p>',
           f'<div class="lbl">مراحل اجرا</div><ol class="st">{steps}</ol>']
    if i["convert"]: out.append(f'<div class="box conv"><b>تبدیل به شاگرد:</b> {esc(i["convert"])}</div>')
    if i["foreign"]:
        t, u = i["foreign"]
        out.append(f'<div class="box frn"><b>نمونهٔ خارجی:</b> {esc(t)} <a href="{u}">{esc(u.split("//")[1].split("/")[0])}</a></div>')
    if i["safe"]: out.append(f'<div class="box safe"><b>ایمنی:</b> {esc(i["safe"])}</div>')
    out.append("</div>")
    return "".join(out)

toc_rows = []
for c in cats:
    for i in c["ideas"]:
        m = [x.strip() for x in i["meta"].split("·")]
        cost = next((x.replace("هزینه:", "").strip() for x in m if x.startswith("هزینه")), "")
        occ = "، ".join(x.replace("مناسب", "").strip() for x in m if x.startswith("مناسب"))
        toc_rows.append(f'<tr><td class="n">{fa(i["n"])}</td><td><a href="#i{i["n"]}">{esc(i["title"])}</a></td><td>{c["key"]}</td><td>{esc(cost)}</td><td>{esc(occ)}</td></tr>')

body = []
for c in cats:
    body.append(f'<div class="cat"><div class="cat-k">{c["key"]}</div><div><h2>{esc(c["name"])}</h2><p>{esc(c["desc"])}</p></div></div>')
    body += [idea_html(i) for i in c["ideas"]]

src = "".join(f'<li>{esc(t)}: <a href="{u}">{esc(u)}</a></li>' for t, u in SOURCES)

page = f"""<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>۵۰ ایده برای جذب نوجوان‌ها</title>
<style>
@font-face{{font-family:CT;src:url(CoachTitle.ttf)}}@font-face{{font-family:CB;src:url(CoachBody.ttf)}}
@page{{size:A4;margin:0}}
html.cv body{{padding:0}} html.cv body>*:not(.cover){{display:none!important}} html.cv .cover{{display:flex}}
.bg{{position:fixed;inset:0;width:210mm;height:297mm;background:url(theme-bg.webp) center/cover;z-index:-2}}
.veil{{position:fixed;inset:0;width:210mm;height:297mm;background:rgba(255,255,255,.45);z-index:-1}}
*{{box-sizing:border-box}} ol{{list-style-type:persian}}
body{{font-family:CB;color:#2a2421;font-size:11.5pt;line-height:1.85;margin:0;padding:16mm 15mm 18mm;-webkit-box-decoration-break:clone;box-decoration-break:clone;background:transparent}}
a{{color:#C9551C;text-decoration:none;word-break:break-all}}
h2,h3,.cover h1{{font-family:CT;font-weight:normal}}
.cover{{display:none;height:297mm;overflow:hidden;background:url(theme-bg.webp) center/cover;flex-direction:column;justify-content:flex-start;align-items:center;text-align:center;page-break-after:always;padding:38mm 25mm 0}}
.cover img{{width:34mm;margin-bottom:8mm}}
.cover .tag{{font-size:12pt;color:#C9551C;background:rgba(255,255,255,.85);box-shadow:0 2mm 6mm -3mm rgba(140,63,25,.3);border-radius:99px;padding:2mm 6mm;margin-bottom:8mm}}
.cover h1{{font-size:40pt;line-height:1.4;margin:0 0 4mm;color:#1F1A17}}
.cover h1 b{{color:#F47B3B;font-weight:normal}}
.cover .sub{{font-size:14pt;color:#4A423D;max-width:150mm}}
.cover .cats{{margin-top:12mm;display:flex;flex-wrap:wrap;gap:3mm;justify-content:center}}
.cover .cats span{{background:#fff;border-radius:99px;padding:1.5mm 5mm;font-size:11pt;box-shadow:0 2mm 6mm -3mm rgba(140,63,25,.35)}}
.cover .brand{{margin-top:auto;margin-bottom:6mm;background:rgba(255,255,255,.8);border-radius:99px;padding:1.5mm 6mm;font-size:12pt;color:#6b605a}}
.sec{{font-size:20pt;color:#1F1A17;border-right:2.2mm solid #F47B3B;padding-right:4mm;margin:9mm 0 4mm}}
.lead{{font-size:12.5pt}}
.why-grid{{display:grid;grid-template-columns:1fr 1fr;gap:4mm}}
.why{{background:rgba(255,255,255,.82);box-shadow:0 3mm 8mm -5mm rgba(140,63,25,.35);border-radius:4mm;padding:4mm 5mm;break-inside:avoid}}
.why-h{{font-family:CT;font-size:14pt;color:#C9551C}}
.why p{{margin:1mm 0 0;font-size:10.5pt}}
.how li{{margin-bottom:1.5mm}}
.check div{{padding:2mm 4mm;border-radius:3mm;background:rgba(255,255,255,.82);box-shadow:0 2mm 5mm -4mm rgba(140,63,25,.3);margin-bottom:2mm;break-inside:avoid}}
table{{width:100%;border-collapse:collapse;font-size:10pt}}
table th{{background:#F2956A;color:#fff;font-weight:bold;padding:2mm;text-align:right}}
table td{{padding:1.2mm 2mm;border-bottom:.3mm solid #eee;vertical-align:top;background:rgba(255,255,255,.8)}}
table tr:nth-child(even) td{{background:rgba(253,236,224,.85)}}
td.n{{font-family:CT;color:#C9551C;width:9mm;text-align:center}}
.plan td:first-child{{white-space:nowrap;font-weight:bold;width:32mm}}
.toc{{page-break-before:always}}
.cat{{page-break-before:always;display:flex;gap:5mm;align-items:center;background:linear-gradient(135deg,rgba(244,123,59,.92),rgba(246,170,120,.88));color:#fff;box-shadow:0 4mm 10mm -6mm rgba(140,63,25,.5);border-radius:5mm;padding:6mm 7mm;margin-bottom:5mm}}
.cat-k{{font-family:CT;font-size:38pt;width:18mm;height:18mm;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;flex:none}}
.cat h2{{margin:0;font-size:22pt}} .cat p{{margin:1mm 0 0;font-size:11pt}}
.idea{{background:rgba(255,255,255,.86);box-shadow:0 3mm 9mm -6mm rgba(140,63,25,.4);border-radius:4mm;padding:4mm 5mm 3mm;margin-bottom:5mm;break-inside:avoid}}
.ih{{display:flex;gap:3mm;align-items:center}}
.num{{font-family:CT;font-size:15pt;color:#fff;background:#F47B3B;min-width:10mm;height:10mm;border-radius:50%;display:flex;align-items:center;justify-content:center}}
.idea h3{{margin:0;font-size:15.5pt;color:#1F1A17}}
.meta{{margin:2mm 0}}
.chip{{display:inline-block;font-size:9pt;background:#FBEDE3;border-radius:99px;padding:.3mm 3mm;margin:0 0 1mm 1.5mm;color:#4A423D}}
.why1{{margin:1mm 0 2mm}}
.lbl{{font-weight:bold;color:#C9551C;margin-bottom:.5mm}}
.st{{margin:0 0 2mm;padding-right:6mm}} .st li{{margin-bottom:.8mm}}
.box{{border-radius:3mm;padding:2mm 4mm;margin-top:2mm;font-size:10.5pt}}
.conv{{background:rgba(253,226,206,.75)}} .frn{{background:rgba(232,240,250,.9)}} .safe{{background:rgba(252,232,232,.9)}}
.steps li{{margin-bottom:2mm}}
.app{{background:rgba(255,255,255,.85);box-shadow:0 3mm 8mm -5mm rgba(140,63,25,.35);border-radius:4mm;padding:4mm 5mm;margin-top:5mm;break-inside:avoid}}
.app-h{{font-family:CT;font-size:14pt}}
.src{{font-size:9.5pt}} .src li{{margin-bottom:1mm}}
.note{{font-size:9.5pt;color:#6b605a}}
</style></head><body><div class="bg"></div><div class="veil"></div>
<div class="cover"><img src="logo-mark.png"><div class="tag">ویژهٔ روز نوجوان (۸ آبان) و روز دانش‌آموز (۱۳ آبان)</div>
<h1><b>۵۰ ایده</b> برای جذب<br>نوجوان‌ها و دانش‌آموزها</h1>
<div class="sub">راهنمای عملی و قدم‌به‌قدم برای مربی‌های تک‌نفره، گروه‌های چند مربی، باشگاه‌ها، مدرسه‌ها و فضای آنلاین</div>
<div class="cats"><span>الف) مربی تک‌نفره</span><span>ب) همکاری چند مربی</span><span>ج) باشگاه‌ها</span><span>د) مدرسه و خانواده</span><span>ه) آنلاین</span></div>
<div class="brand">کمک مربی · مدیریت کمتر، مربیگری بیشتر · assistantcoach.ir</div></div>
{INTRO}
{SAFETY}
{PLAN}
<div class="toc"><h2 class="sec">فهرست ۵۰ ایده</h2>
<table><tr><th>#</th><th>ایده</th><th>دسته</th><th>هزینه</th><th>مناسب</th></tr>{''.join(toc_rows)}</table></div>
{''.join(body)}
{FOLLOW}
<h2 class="sec">منابع</h2>
<p class="note">عددهای مقدمه از این منابع است. بیشتر آن‌ها آمار جهانی یا آمریکایی‌اند و ممکن است با وضعیت ایران فرق داشته باشند. نمونه‌های خارجی از صفحهٔ رسمی خود برنامه‌ها نقل شده‌اند.</p>
<ol class="src">{src}</ol>
</body></html>"""
open("50-ideas-nojavan.html", "w", encoding="utf-8").write(page)
print("ok", len(ideas))
