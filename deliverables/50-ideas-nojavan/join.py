import os
from pypdf import PdfWriter
w = PdfWriter()
w.append("_cover.pdf"); w.append("_body.pdf")
w.add_metadata({"/Title": "۵۰ ایده برای جذب نوجوان‌ها و دانش‌آموزها"})
w.write("50-ideas-nojavan.pdf")
for f in ("_cover.pdf", "_body.pdf"): os.remove(f)
