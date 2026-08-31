import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

p = r"C:\Users\Roshini\Downloads\SUKI CRM.docx"
with zipfile.ZipFile(p) as z:
    xml = z.read("word/document.xml").decode("utf-8")
    root = ET.fromstring(xml)
    texts = []
    for t in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"):
        if t.text:
            texts.append(t.text)
    out = "\n".join(texts)
    out_path = Path(r"C:\Users\Roshini\AppData\Local\Temp\suki_req.txt")
    out_path.write_text(out, encoding="utf-8")
    print(out[:5000])
