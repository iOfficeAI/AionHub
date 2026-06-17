"""修复 srt: 按 start 排序 + 修复 end<start 情况 + 平移"""
import os, sys, json, re

src = sys.argv[1]
base = os.path.splitext(src)[0]
j = json.load(open(src, "r", encoding="utf-8"))
segs = j["segments"]
# 1) 修复 end < start: 视为 (start, start+1) 或丢弃
fixed = []
for s in segs:
    st = float(s.get("start", 0))
    en = float(s.get("end", st+1))
    txt = s.get("text", "").strip()
    if not txt: continue
    if en < st: en = st + 1.0
    fixed.append({"start": st, "end": en, "text": txt})
# 2) 按 start 排序
fixed.sort(key=lambda x: x["start"])
# 3) 写 srt
def sec_to_ts(t):
    if t<0: t=0
    h=int(t//3600); m=int((t%3600)//60); s=t-h*3600-m*60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int((s-int(s))*1000):03d}"
out=[]
for i, s in enumerate(fixed, 1):
    out.append(f"{i}\n{sec_to_ts(s['start'])} --> {sec_to_ts(s['end'])}\n{s['text']}\n")
with open(base+".srt", "w", encoding="utf-8") as f: f.write("\n".join(out))
print(f"fixed: {len(fixed)} segs -> {base}.srt")
