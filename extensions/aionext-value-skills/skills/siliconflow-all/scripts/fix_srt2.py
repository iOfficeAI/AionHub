"""更智能的 srt 修复: 用相邻 start 推算 end"""
import os, sys, json, re
src = sys.argv[1]
base = os.path.splitext(src)[0]
j = json.load(open(src, "r", encoding="utf-8"))
segs = sorted([s for s in j["segments"] if s.get("text","").strip()], key=lambda x: x.get("start",0))
# 用 next start 推 end
fixed = []
for i, s in enumerate(segs):
    st = float(s.get("start", 0))
    if i+1 < len(segs):
        en = float(segs[i+1].get("start", st)) - 0.1
    else:
        en = st + 1.0  # 最后一段兜底
    if en <= st: en = st + 1.0
    fixed.append({"start": st, "end": en, "text": s.get("text","").strip()})

def sec_to_ts(t):
    if t<0: t=0
    h=int(t//3600); m=int((t%3600)//60); s=t-h*3600-m*60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int((s-int(s))*1000):03d}"
out=[]
for i, s in enumerate(fixed, 1):
    out.append(f"{i}\n{sec_to_ts(s['start'])} --> {sec_to_ts(s['end'])}\n{s['text']}\n")
with open(base+".srt", "w", encoding="utf-8") as f: f.write("\n".join(out))
print(f"fixed: {len(fixed)} segs -> {base}.srt")
print(f"first: {sec_to_ts(fixed[0]['start'])} -> {sec_to_ts(fixed[-1]['start'])}")
