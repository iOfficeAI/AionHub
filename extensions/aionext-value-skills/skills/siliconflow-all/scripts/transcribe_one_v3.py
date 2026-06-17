"""v3: 拉 ASR 桶，按"支持 verbose_json 时间戳"优先逐个试"""
import os, sys, json, time, subprocess, urllib.request

API = "https://api.siliconflow.cn/v1/models"
TRANSCRIBE = "https://api.siliconflow.cn/v1/audio/transcriptions"
KEY = os.environ["SILICONFLOW_API_KEY"]
ASR_KW = ["asr","whisper","sensevoice","paraformer","telespeech","stt","transcribe","audio-to-text"]

def list_models():
    return json.loads(urllib.request.urlopen(urllib.request.Request(API, headers={"Authorization": f"Bearer {KEY}"}), timeout=30).read())["data"]

def pick_asr(models):
    bucket = [m["id"] for m in models if any(k in m["id"].lower() for k in ASR_KW)]
    bucket = [m for m in bucket if not m.startswith("Pro/") and not m.startswith("LoRA/")]
    return bucket  # 全部返回，让调用方逐个试

def ffmpeg_to_wav(src, dst):
    r = subprocess.run(["ffmpeg","-y","-i",src,"-vn","-ac","1","-ar","16000","-c:a","pcm_s16le","-loglevel","error",dst], capture_output=True)
    if r.returncode != 0: print("ffmpeg err:", r.stderr.decode("utf-8",errors="ignore")[:300])
    return os.path.exists(dst) and os.path.getsize(dst) > 1024

def transcribe(wav_path, model_id, response_format="verbose_json"):
    boundary = "----PyB" + str(int(time.time()*1000))
    with open(wav_path,"rb") as f: file_data = f.read()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="model"\r\n\r\n{model_id}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="response_format"\r\n\r\n{response_format}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="language"\r\n\r\nzh\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(wav_path)}"\r\n'
        f"Content-Type: audio/wav\r\n\r\n"
    ).encode("utf-8") + file_data + f"\r\n--{boundary}--\r\n".encode("utf-8")
    req = urllib.request.Request(TRANSCRIBE, data=body, method="POST", headers={
        "Authorization": f"Bearer {KEY}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    })
    with urllib.request.urlopen(req, timeout=1800) as r:
        return r.read().decode("utf-8", errors="ignore")

def sec_to_ts(t):
    if t<0: t=0
    h=int(t//3600); m=int((t%3600)//60); s=t-h*3600-m*60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int((s-int(s))*1000):03d}"

def has_timeinfo(j):
    """判断 verbose_json 是否包含 segments/words/时间信息"""
    if isinstance(j, dict):
        if j.get("segments") and len(j["segments"])>0: return True
        if j.get("words") and len(j["words"])>0: return True
    return False

def verbose_json_to_srt(j):
    if has_timeinfo(j):
        segs = j.get("segments") or j.get("words")
        out=[]
        for i, s in enumerate(segs, 1):
            st = s.get("start") if s.get("start") is not None else s.get("start_time", 0)
            en = s.get("end") if s.get("end") is not None else s.get("end_time", st+1)
            txt = s.get("text","").strip()
            if not txt: continue
            out.append(f"{i}\n{sec_to_ts(st)} --> {sec_to_ts(en)}\n{txt}\n")
        return "\n".join(out)
    # fallback: 按标点切，无时间戳时塞同一占位时间
    import re
    txt = j.get("text","")
    parts = re.findall(r"[^。！？!?\.\!\?]+[。！？!?\.\!\?]+|[^。！？!?\.\!\?]+$", txt)
    parts = [p.strip() for p in parts if p.strip()] or [txt]
    out=[]
    for i, p in enumerate(parts, 1):
        st = (i-1)*1.0; en = i*1.0
        out.append(f"{i}\n{sec_to_ts(st)} --> {sec_to_ts(en)}\n{p}\n")
    return "\n".join(out)

def main():
    src = sys.argv[1]
    base = os.path.splitext(src)[0]
    wav  = base + ".__tmp.wav"

    print(f"[1] list models ...", flush=True)
    models = list_models()
    asr_bucket = pick_asr(models)
    print(f"    ASR bucket: {asr_bucket}", flush=True)

    print(f"[2] ffmpeg -> wav ...", flush=True)
    if not ffmpeg_to_wav(src, wav): sys.exit("ERROR: ffmpeg failed")
    sz = os.path.getsize(wav)
    print(f"    -> {sz/1e6:.1f} MB", flush=True)

    # 切片逻辑：如果 > 24MB，siliconflow 拒绝。先 ffmpeg 切成 20MB 段
    chunks = []
    if sz > 24*1024*1024:
        # 用 ffmpeg 切 wav：每 20 分钟一段
        seg_sec = 20*60
        dur_cmd = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",wav], capture_output=True, text=True)
        dur = float(dur_cmd.stdout.strip())
        n = max(1, int(dur/seg_sec)+1)
        print(f"    -> 切 {n} 段，每段 {seg_sec}s", flush=True)
        for i in range(n):
            start = i*seg_sec
            chunk_wav = f"{wav}.{i:03d}.wav"
            r = subprocess.run(["ffmpeg","-y","-i",wav,"-ss",str(start),"-t",str(seg_sec),"-c","copy","-loglevel","error",chunk_wav], capture_output=True)
            if os.path.exists(chunk_wav) and os.path.getsize(chunk_wav)>1024:
                chunks.append((start, chunk_wav))
        # 删原 wav
        os.remove(wav)
    else:
        chunks = [(0, wav)]

    # 逐模型逐段试，挑一个有 segments 的
    chosen = None
    all_segs = []  # [(start_offset, segments_list_from_response), ...]
    # 第一段：尝试 ASR 桶所有模型，挑一个能返回时间戳的
    first_start, first_wav = chunks[0]
    for model_id in asr_bucket:
        print(f"[3] try {model_id} on first chunk ...", flush=True)
        t0=time.time()
        try:
            raw = transcribe(first_wav, model_id, "verbose_json")
        except Exception as e:
            print(f"    ERR: {e}", flush=True); continue
        try: j = json.loads(raw)
        except: j = {"text": raw}
        has = has_timeinfo(j)
        print(f"    -> {len(raw)} chars in {time.time()-t0:.1f}s, has_timeinfo={has}, text={len(j.get('text',''))} chars", flush=True)
        if has:
            chosen = model_id
            segs = j.get("segments") or j.get("words")
            for s in segs:
                if "start" in s: s["start"] = s["start"] + first_start
                if "start_time" in s: s["start_time"] = s["start_time"] + first_start
            all_segs.extend(segs)
            break
        else:
            all_segs.append({"_only_text": True, "text": j.get("text",""), "_offset": first_start})

    # 剩余段：继续用已选模型
    if chosen:
        for start_off, wav_seg in chunks[1:]:
            print(f"[4] ASR {chosen} on {os.path.basename(wav_seg)} ...", flush=True)
            t0=time.time()
            try:
                raw = transcribe(wav_seg, chosen, "verbose_json")
            except Exception as e:
                print(f"    ERR: {e}", flush=True); continue
            try: j = json.loads(raw)
            except: j = {"text": raw}
            if has_timeinfo(j):
                segs = j.get("segments") or j.get("words")
                for s in segs:
                    if "start" in s: s["start"] = s["start"] + start_off
                    if "start_time" in s: s["start_time"] = s["start_time"] + start_off
                all_segs.extend(segs)
            else:
                all_segs.append({"_only_text": True, "text": j.get("text",""), "_offset": start_off})
            print(f"    -> {time.time()-t0:.1f}s done", flush=True)

    # 合并
    if all_segs and not all_segs[0].get("_only_text"):
        # 全是 segments/words
        out = []
        for i, s in enumerate(all_segs, 1):
            st = s.get("start") or s.get("start_time", 0)
            en = s.get("end") or s.get("end_time", st+1)
            txt = s.get("text","").strip()
            if not txt: continue
            out.append(f"{i}\n{sec_to_ts(st)} --> {sec_to_ts(en)}\n{txt}\n")
        srt_text = "\n".join(out)
    else:
        # 全 text 没时间戳，按标点切，时间均分（用视频总时长）
        all_text = "".join(s["text"] for s in all_segs if s.get("text"))
        import re
        parts = re.findall(r"[^。！？!?\.\!\?]+[。！？!?\.\!\?]+|[^。！？!?\.\!\?]+$", all_text)
        parts = [p.strip() for p in parts if p.strip()] or [all_text]
        n = len(parts)
        # 用 wav 总时长
        dur_cmd = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",wav+".000.wav" if chunks and chunks[0][1]!=wav else wav], capture_output=True, text=True)
        # 用原 wav 文件路径
        full_wav = wav if (len(chunks)==1 and chunks[0][1]==wav) else None
        if full_wav:
            dur_cmd = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",full_wav], capture_output=True, text=True)
        else:
            dur_cmd = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",chunks[0][1]], capture_output=True, text=True)
        try: dur = float(dur_cmd.stdout.strip())
        except: dur = n*3
        per = dur/n
        out=[]
        for i, p in enumerate(parts, 1):
            st = (i-1)*per; en = i*per
            out.append(f"{i}\n{sec_to_ts(st)} --> {sec_to_ts(en)}\n{p}\n")
        srt_text = "\n".join(out)

    with open(base+".srt", "w", encoding="utf-8") as f: f.write(srt_text)
    with open(base+".txt", "w", encoding="utf-8") as f: f.write("\n".join(s["text"] for s in all_segs if s.get("text")) or "")
    # 写 raw json
    with open(base+".json", "w", encoding="utf-8") as f:
        json.dump({"model": chosen, "segments": all_segs}, f, ensure_ascii=False, indent=2)

    # 清理切片
    for _, c in chunks:
        if c != wav:
            try: os.remove(c)
            except: pass
    try:
        if os.path.exists(wav): os.remove(wav)
    except: pass

    seg_count = srt_text.count("\n\n")
    print(f"\nDONE: model={chosen}  segs={seg_count}  srt={base}.srt  txt={base}.txt  json={base}.json")

if __name__ == "__main__":
    main()
