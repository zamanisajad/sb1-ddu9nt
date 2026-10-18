import re,json,sys,glob,os
ws=sys.argv[1]
checks=[
 ("No AI / «هوشمند» claim (outside 'avoid' notes)", lambda t: not re.search(r'(هوش مصنوعی|هوشمند|\bAI\b)(?![^\n]*(نگو|ننوشت|نیست|ندارد|نداره|ممنوع|avoid|no AI|بدون))',t)),
 ("No invented percentage / time-saving number", lambda t: not re.search(r'[0-9۰-۹]+\s*(٪|%|درصد)',t)),
 ("No price in Toman", lambda t: not re.search(r'[0-9۰-۹][0-9۰-۹,٬]*\s*(هزار\s*)?تومان',t)),
 ("No hype words", lambda t: not re.search(r'انقلابی|بی‌نظیر|بی نظیر|جادویی|تضمینی|معجزه',t)),
 ("No banned opener «تا حالا به این فکر کردی»", lambda t: 'تا حالا به این فکر' not in t),
 ("No library-size claim", lambda t: not re.search(r'(هزاران|[0-9۰-۹]{3,}\+?)\s*حرکت',t)),
 ("No invented time-saving claim (X minutes/seconds/hours)", lambda t: not re.search(r'به چند دقیقه|ساعت فقط|کمتر از\s*[0-9۰-۹]+\s*(ثانیه|دقیقه)|در\s*[0-9۰-۹]+\s*ثانیه\s*(برنامه|بساز)',t)),
 ("No unverified feature claims (AI suggestions, sport-specific session builder, WhatsApp/Eitaa export, 'ready library')", lambda t: not re.search(r'کتابخانه آماده|پیشنهاد آمادهٔ تمرین|ارسال در واتساپ|اسلایدر|رشته‌ات چیه',t)),
 ("States an objective (هدف/objective)", lambda t: bool(re.search(r'هدف|Objective|objective',t))),
]
rows=[]
for f in sorted(glob.glob(ws+'/*/*/outputs/answer.md')):
  t=open(f).read(); exp=[]
  for name,fn in checks:
    ok=fn(t); exp.append({"text":name,"passed":bool(ok),"evidence":"regex check on answer.md"})
  run=os.path.dirname(os.path.dirname(f))
  json.dump({"expectations":exp,"summary":{"passed":sum(e['passed'] for e in exp),"failed":sum(not e['passed'] for e in exp),"total":len(exp),"pass_rate":sum(e['passed'] for e in exp)/len(exp)}},open(run+'/grading.json','w'),ensure_ascii=False,indent=1)
  print(run.split('iteration-1/')[1], sum(e['passed'] for e in exp),'/',len(exp), [e['text'][:30] for e in exp if not e['passed']])
