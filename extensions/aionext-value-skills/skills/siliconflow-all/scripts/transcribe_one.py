"""硅基流动 ASR 转录 - 一次一个文件。动态拉清单，不写死模型。"""
import os, shutil, sys, json, time, subprocess, urllib.request, urllib.error

API = "https://api.siliconflow.cn/v1/models"
TRANSCRIBE = "https://api.siliconflow.cn/v1/audio/transcriptions"
KEY = os.environ.get("SILICONFLOW_API_KEY")
if not KEY:
    sys.exit("ERROR: SILICONFLOW_API_KEY not set")

ASR_KW = ["asr","whisper","sensevoice","paraformer","telespeech","audiosense","stt","transcribe","audio-to-text"]

def http_get_json(url, headers=None, data=None, method="GET", timeout=120):
    headers = headers or {}
    data = data.encode("utf-8") if isinstance(data, str) else data
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def list_models():
    h = {"Authorization": f"Bearer {KEY}"}
    return http_get_json(API, headers=h)["data"]

def pick_asr(models, prefer_chinese=True):
    bucket = [m["id"] for m in models if any(k in m["id"].lower() for k in ASR_KW)]
    bucket = [m for m in bucket if not m.startswith("Pro/") and not m.startswith("LoRA/")]
    if not bucket: return None
    if prefer_chinese:
        zh = [m for m in bucket if any(z in m.lower() for z in ["zh","chinese","cn","paraformer","sensevoice"])]
        if zh: return zh[0]
    return bucket[0]

def ffmpeg_to_wav(src, dst):
    ff = shutil.which("ffmpeg") or "ffmpeg"
    cmd = [ff, "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
           "-c:a", "pcm_s16le", "-loglevel", "error", dst]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        print("ffmpeg stderr:", r.stderr.decode("utf-8", errors="ignore")[:500])
    return os.path.exists(dst) and os.path.getsize(dst) > 1024

def transcribe(wav_path, model_id, response_format="srt"):
    boundary = "----PythonBoundary" + str(int(time.time()))
    with open(wav_path, "rb") as f:
        file_data = f.read()
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
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.read().decode("utf-8", errors="ignore")

def main():
    src = sys.argv[1]
    base = os.path.splitext(src)[0]
    wav  = base + ".__tmp.wav"
    srt  = base + ".srt"
    jsf  = base + ".json"
    print(f"[1/4] list models ...", flush=True)
    models = list_models()
    model_id = pick_asr(models, prefer_chinese=True)
    if not model_id:
        sys.exit("ERROR: no ASR model in /v1/models")
    print(f"     -> picked: {model_id}", flush=True)
    print(f"[2/4] ffmpeg -> wav ...", flush=True)
    if not ffmpeg_to_wav(src, wav):
        sys.exit("ERROR: ffmpeg failed")
    print(f"     -> {os.path.getsize(wav)/1e6:.1f} MB", flush=True)
    print(f"[3/4] ASR (srt) ...", flush=True)
    t0 = time.time()
    srt_text = transcribe(wav, model_id, "srt")
    with open(srt, "w", encoding="utf-8") as f: f.write(srt_text)
    print(f"     -> {len(srt_text)} chars in {time.time()-t0:.1f}s", flush=True)
    print(f"[4/4] ASR (verbose_json) ...", flush=True)
    t0 = time.time()
    js_text = transcribe(wav, model_id, "verbose_json")
    with open(jsf, "w", encoding="utf-8") as f: f.write(js_text)
    print(f"     -> {len(js_text)} chars in {time.time()-t0:.1f}s", flush=True)
    try: os.remove(wav)
    except: pass
    print(f"\nDONE: model={model_id}  srt={srt}  json={jsf}")

if __name__ == "__main__":
    main()
