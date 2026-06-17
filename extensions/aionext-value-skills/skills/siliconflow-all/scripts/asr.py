"""v4: 4 段并发 + 模型预热 + 修时间戳"""
import os, sys, json, time, subprocess, urllib.request, concurrent.futures, threading

API = "https://api.siliconflow.cn/v1/models"
TRANSCRIBE = "https://api.siliconflow.cn/v1/audio/transcriptions"
KEY = os.environ["SILICONFLOW_API_KEY"]
ASR_KW = ["asr","whisper","sensevoice","paraformer","telespeech","stt","transcribe","audio-to-text"]

def list_models():
    return json.loads(urllib.request.urlopen(urllib.request.Request(API, headers={"Authorization": f"Bearer {KEY}"}), timeout=30).read())["data"]

def pick_asr(models):
    bucket = [m["id"] for m in models if any(k in m["id"].lower() for k in ASR_KW)]
    bucket = [m for m in bucket if not m.startswith("Pro/") and not m.startswith("LoRA/")]
    return bucket

def ffmpeg_to_wav(src, dst):
    r = subprocess.run(["ffmpeg","-y","-i",src,"-vn","-ac","1","-ar","16000","-c:a","pcm_s16le","-loglevel","error",dst], capture_output=True)
    return os.path.exists(dst) and os.path.getsize(dst) > 1024

def ffmpeg_cut(src_wav, dst_wav, start_sec, dur_sec):
    r = subprocess.run(["ffmpeg","-y","-i",src_wav,"-ss",str(start_sec),"-t",str(dur_sec),"-c","copy","-loglevel","error",dst_wav], capture_output=True)
    return os.path.exists(dst_wav) and os.path.getsize(dst_wav) > 1024

def transcribe(wav_path, model_id, response_format="verbose_json"):
    boundary = "----PyB" + str(int(time.time()*1000)) + str(threading.get_ident() % 1000)
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

def has_timeinfo(j):
    if isinstance(j, dict):
        if j.get("segments") and len(j["segments"])>0: return True
        if j.get("words") and len(j["words"])>0: return True
    return False

def make_silence_wav(path, dur_sec=3, sr=16000):
    """生成 3 秒静音 wav，预热用"""
    subprocess.run(["ffmpeg","-y","-f","lavfi","-i",f"anullsrc=channel_layout=mono:sample_rate={sr}","-t",str(dur_sec),"-c:a","pcm_s16le","-loglevel","error",path], capture_output=True)

def main():
    src = sys.argv[1]
    concurrency = int(os.environ.get("ASR_CONCURRENCY", "4"))
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

    # 切片：每段 max(20 分钟, 总时长/concurrency)，按 concurrency 段
    dur_cmd = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",wav], capture_output=True, text=True)
    dur = float(dur_cmd.stdout.strip())
    n = max(1, min(concurrency, max(1, int(dur/600)+1)))  # 至少 10 分钟一段
    seg_sec = dur / n
    print(f"    -> 切 {n} 段，每段 {seg_sec:.0f}s，concurrency={concurrency}", flush=True)
    chunks = []
    for i in range(n):
        start = i * seg_sec
        chunk_wav = f"{wav}.{i:03d}.wav"
        if ffmpeg_cut(wav, chunk_wav, start, seg_sec):
            chunks.append((start, chunk_wav))
    os.remove(wav)
    if not chunks: sys.exit("ERROR: cut failed")

    # 预热：发一个 3 秒静音 wav
    chosen = asr_bucket[0]
    warm = base + ".__warm.wav"
    make_silence_wav(warm, 3)
    print(f"[3] warmup with {chosen} ...", flush=True)
    t0 = time.time()
    try:
        transcribe(warm, chosen, "json")
    except Exception as e:
        print(f"    warmup err: {e}", flush=True)
    print(f"    warmup {time.time()-t0:.1f}s", flush=True)
    try: os.remove(warm)
    except: pass

    # 并发转录
    print(f"[4] parallel ASR ({concurrency} workers) ...", flush=True)
    t_all = time.time()
    results = [None] * len(chunks)
    def work(i, item):
        start_off, wav_seg = item
        t0 = time.time()
        try:
            raw = transcribe(wav_seg, chosen, "verbose_json")
        except Exception as e:
            return i, {"_err": str(e)}
        try: j = json.loads(raw)
        except: j = {"text": raw}
        # 偏移
        if has_timeinfo(j):
            segs = j.get("segments") or j.get("words")
            for s in segs:
                if "start" in s: s["start"] = s["start"] + start_off
                if "start_time" in s: s["start_time"] = s["start_time"] + start_off
        print(f"    [{i+1}/{len(chunks)}] {time.time()-t0:.1f}s segs={len(j.get('segments') or j.get('words') or [])} has_timeinfo={has_timeinfo(j)}", flush=True)
        return i, j

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as ex:
        futs = [ex.submit(work, i, c) for i, c in enumerate(chunks)]
        for f in concurrent.futures.as_completed(futs):
            i, j = f.result()
            results[i] = j
    print(f"    total parallel: {time.time()-t_all:.1f}s", flush=True)

    # 合并
    all_segs, all_text = [], []
    for j in results:
        if not j: continue
        if has_timeinfo(j):
            all_segs.extend(j.get("segments") or j.get("words"))
        all_text.append(j.get("text",""))
    # 写 srt
    fixed = []
    if all_segs:
        segs = sorted([s for s in all_segs if s.get("text","").strip()], key=lambda x: x.get("start",0))
        for i, s in enumerate(segs):
            st = float(s.get("start", 0))
            if i+1 < len(segs): en = float(segs[i+1].get("start", st)) - 0.1
            else: en = st + 1.0
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
    with open(base+".txt", "w", encoding="utf-8") as f: f.write("\n".join(t for t in all_text if t))
    with open(base+".json", "w", encoding="utf-8") as f:
        json.dump({"model": chosen, "segments": fixed, "raw_text": "".join(all_text)}, f, ensure_ascii=False, indent=2)

    # 清理切片
    for _, c in chunks:
        try: os.remove(c)
        except: pass

    print(f"\nDONE: model={chosen}  segs={len(fixed)}  srt={base}.srt  txt={base}.txt  json={base}.json")
    print(f"total: {time.time()-t_all:.1f}s")

if __name__ == "__main__":
    main()
