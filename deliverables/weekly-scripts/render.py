import markdown, sys
md=open(sys.argv[1],encoding='utf-8').read()
body=markdown.markdown(md,extensions=['tables'])
html=f"""<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><style>
@font-face{{font-family:CT;src:url(../50-ideas-nojavan/CoachTitle.ttf)}}@font-face{{font-family:CB;src:url(../50-ideas-nojavan/CoachBody.ttf)}}
@page{{size:A4;margin:0}}
.bg{{position:fixed;inset:0;width:210mm;height:297mm;background:url(../50-ideas-nojavan/theme-bg.webp) center/cover;z-index:-2}}
.veil{{position:fixed;inset:0;width:210mm;height:297mm;background:rgba(255,255,255,.55);z-index:-1}}
body{{font-family:CB;color:#2a2421;font-size:10.5pt;line-height:1.8;margin:0;padding:14mm 13mm 16mm;-webkit-box-decoration-break:clone;box-decoration-break:clone}}
h1{{font-family:CT;font-weight:normal;font-size:24pt;color:#1F1A17;margin:0 0 4mm}}
h2{{font-family:CT;font-weight:normal;font-size:19pt;color:#1F1A17;border-right:2mm solid #F47B3B;padding-right:4mm;margin:6mm 0 3mm;page-break-before:always}}
h1+p+p+hr+h2{{page-break-before:avoid}}
table{{width:100%;border-collapse:collapse;font-size:9.3pt;margin:3mm 0;background:rgba(255,255,255,.85);border-radius:3mm;overflow:hidden}}
th{{background:#F2956A;color:#fff;padding:1.6mm;text-align:right}}
td{{padding:1.4mm 1.8mm;border-bottom:.3mm solid #eee;vertical-align:top}}
tr:nth-child(even) td{{background:rgba(253,236,224,.7)}}
ul{{background:rgba(255,255,255,.8);border-radius:3mm;padding:2mm 8mm 2mm 4mm}}
hr{{border:0}}
strong{{color:#C9551C}}
</style></head><body><div class="bg"></div><div class="veil"></div>{body}</body></html>"""
open(sys.argv[2],'w',encoding='utf-8').write(html)
