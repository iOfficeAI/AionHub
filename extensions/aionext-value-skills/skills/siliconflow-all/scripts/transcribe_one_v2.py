"""v2: 用 verbose_json 拿字级时间戳，本地拼 srt"""
import os, sys, json, time, subprocess, urllib.request

API = "https://api.siliconflow.cn/v1/models"
TRANSCRIBE = "https://api.siliconflow.cn/v1/audio/transcriptions"
KEY = os.environ["SILICONFLOW_API_KEY"]
ASR_KW = ["asr","whisper","sensevoice","paraformer","telespeech","stt","transcribe","audio-to-text"]

def http_get_json(url, headers=None, data=None, method="GET", timeout=120):
    headers = headers or {}
    if isinstance(data, str): data = data.encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def list_models():
    return http_get_json(API, headers={"Authorization": f"Bearer {KEY}"})["data"]

def pick_asr(models):
    bucket = [m["id"] for m in models if any(k in m["id"].lower() for k in ASR_KW)]
    bucket = [m for m in bucket if not m.startswith("Pro/") and not m.startswith("LoRA/")]
    if not bucket: return None
    zh = [m for m in bucket if any(z in m.lower() for z in ["zh","chinese","cn","paraformer","sensevoice"])]
    return (zh or bucket)[0]

def ffmpeg_to_wav(src, dst):
    cmd = ["ffmpeg","-y","-i",src,"-vn","-ac","1","-ar","16000","-c:a","pcm_s16le","-loglevel","error",dst]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        print("ffmpeg err:", r.stderr.decode("utf-8",errors="ignore")[:300])
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

def verbose_json_to_srt(j):
    """SenseVoice verbose_json 通常形如:
       {"task":"transcribe","language":"zh","text":"...","segments":[{"start":0.0,"end":3.0,"text":"..."}, ...]}
       或 OpenAI 风格 words-level。兼容两种。"""
    segments = j.get("segments") or j.get("words") or []
    if segments and isinstance(segments[0], dict) and "text" in segments[0] and ("start" in segments[0] or "start_time" in segments[0]):
        out=[]
        for i, s in enumerate(segments, 1):
            st = s.get("start") if s.get("start") is not None else s.get("start_time", 0)
            en = s.get("end") if s.get("end") is not None else s.get("end_time", st+1)
            out.append(f"{i}\n{sec_to_ts(st)} --> {sec_to_ts(en)}\n{s.get('text','').strip()}\n")
        return "\n".join(out)
    # fallback: 按标点切，时间均分（拿不到时间戳时凑合用）
    import re
    txt = j.get("text","")
    parts = re.findall(r"[^。！？!?\.\!\?]+[。！？!?\.\!\?]+|[^。！？!?\.\!\?]+$", txt)
    parts = [p.strip() for p in parts if p.strip()] or [txt]
    dur = j.get("duration") or 1
    n = len(parts)
    out=[]
    for i, p in enumerate(parts, 1):
        st = dur*i/n - (dur/n*0.9)
        en = dur*i/n
        out.append(f"{i}\n{sec_to_ts(st)} --> {sec_to_ts(en)}\n{p}\n")
    return "\n".join(out)

def main():
    src = sys.argv[1]
    base = os.path.splitext(src)[0]
    wav  = base + ".__tmp.wav"
    srt  = base + ".srt"
    js   = base + ".json"
    txt  = base + ".txt"

    print(f"[1/5] list models ...", flush=True)
    models = list_models()
    model_id = pick_asr(models)
    if not model_id: sys.exit("ERROR: no ASR model in /v1/models")
    print(f"     -> picked: {model_id}", flush=True)

    print(f"[2/5] ffmpeg -> wav ...", flush=True)
    if not ffmpeg_to_wav(src, wav): sys.exit("ERROR: ffmpeg failed")
    sz = os.path.getsize(wav)
    print(f"     -> {sz/1e6:.1f} MB", flush=True)
    if sz > 24*1024*1024:
        print("     WARN: > 24MB，硅基流动可能拒绝，需要切片", flush=True)

    print(f"[3/5] ASR verbose_json ...", flush=True)
    t0=time.time()
    raw = transcribe(wav, model_id, "verbose_json")
    with open(js, "w", encoding="utf-8") as f: f.write(raw)
    try:
        j = json.loads(raw)
    except Exception as e:
        print(f"     WARN: parse json err: {e}", flush=True)
        j = {"text": raw, "duration": 0}
    print(f"     -> {len(raw)} chars in {time.time()-t0:.1f}s, text={len(j.get('text',''))} chars", flush=True)

    print(f"[4/5] build srt ...", flush=True)
    srt_text = verbose_json_to_srt(j)
    with open(srt, "w", encoding="utf-8") as f: f.write(srt_text)
    with open(txt, "w", encoding="utf-8") as f: f.write(j.get("text",""))
    seg_count = srt_text.count("\n\n")
    print(f"     -> {seg_count} segments", flush=True)

    try: os.remove(wav)
    except: pass
    print(f"\nDONE: model={model_id}  srt={srt}  json={js}  txt={txt}")

if __name__ == "__main__":
    main()
