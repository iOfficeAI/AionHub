import os
import requests
import time
import argparse
from urllib.parse import urlparse
import hmac
import hashlib
import datetime

# Volcengine configuration
ACCESS_KEY_ID = os.environ.get("VOLCENGINE_ACCESS_KEY_ID")
SECRET_ACCESS_KEY = os.environ.get("VOLCENGINE_SECRET_ACCESS_KEY")
REGION = os.environ.get("VOLCENGINE_REGION", "cn-beijing")
API_HOST = "open.volcengineapi.com"

def sign_request(method, uri, query_params, body):
    """Sign request using Volcengine HMAC-SHA256 signing"""
    now = datetime.datetime.utcnow()
    x_date = now.strftime("%Y%m%dT%H%M%SZ")

    credential_scope = f"{x_date[:8]}/{REGION}/openapi/request"

    # Sort query parameters
    sorted_query = sorted(query_params.items())
    canonical_query = "&".join([f"{k}={v}" for k, v in sorted_query])

    # Create canonical request
    canonical_request = f"{method}\n{uri}\n{canonical_query}\n\nhost:{API_HOST}\nx-date:{x_date}\n\n"
    canonical_request += "content-sha256=" + hashlib.sha256(body.encode('utf-8')).hexdigest()

    # Calculate signature
    string_to_sign = f"HMAC-SHA256\n{x_date}\n{credential_scope}\n" + hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()

    k_date = hmac.new(SECRET_ACCESS_KEY.encode('utf-8'), x_date[:8].encode('utf-8'), hashlib.sha256).digest()
    k_region = hmac.new(k_date, REGION.encode('utf-8'), hashlib.sha256).digest()
    k_service = hmac.new(k_region, b"openapi", hashlib.sha256).digest()
    k_signing = hmac.new(k_service, b"request", hashlib.sha256).digest()
    signature = hmac.new(k_signing, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

    authorization = f"HMAC-SHA256 Credential={ACCESS_KEY_ID}/{credential_scope}, SignedHeaders=host;x-date, Signature={signature}"

    return {
        "X-Date": x_date,
        "Authorization": authorization,
        "Content-Type": "application/json"
    }

def create_digital_human(image_url):
    """Create digital human from image"""
    method = "POST"
    uri = "/api/v1/digital_human/create"
    query_params = {
        "Action": "CreateDigitalHuman",
        "Version": "2023-12-01"
    }

    payload = {
        "image_url": image_url,
        "name": f"digital_human_{int(time.time())}"
    }

    body = str(payload).replace("'", '"')
    headers = sign_request(method, uri, query_params, body)

    url = f"https://{API_HOST}{uri}"
    response = requests.post(url, params=query_params, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()

    if "Result" not in data:
        raise Exception(f"Failed to create digital human: {data}")

    return data["Result"]["digital_human_id"]

def start_generation(image_url=None, digital_human_id=None, text="", voice_id="default"):
    """Start video generation task"""
    method = "POST"
    uri = "/api/v1/digital_human/start_generation"
    query_params = {
        "Action": "StartDigitalHumanGeneration",
        "Version": "2023-12-01"
    }

    payload = {
        "text": text,
        "speaker_id": voice_id,
        "add_subtitle": True
    }

    if digital_human_id:
        payload["digital_human_id"] = digital_human_id
    else:
        payload["image_url"] = image_url

    body = str(payload).replace("'", '"')
    headers = sign_request(method, uri, query_params, body)

    url = f"https://{API_HOST}{uri}"
    response = requests.post(url, params=query_params, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()

    return data["Result"]["task_id"]

def get_generation_result(task_id):
    """Get generation task result"""
    method = "GET"
    uri = "/api/v1/digital_human/get_generation_result"
    query_params = {
        "Action": "GetDigitalHumanGenerationResult",
        "Version": "2023-12-01",
        "TaskId": task_id
    }

    body = ""
    headers = sign_request(method, uri, query_params, body)

    url = f"https://{API_HOST}{uri}"
    response = requests.get(url, params=query_params, headers=headers)
    response.raise_for_status()
    data = response.json()

    return data["Result"]

def upload_image(image_path):
    """Upload local image to get a public URL"""
    # TODO: Implement actual image upload to Volcengine or your storage
    print(f"Uploading image: {image_path}")
    return image_path

def download_file(url, output_path):
    """Download file from URL"""
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

def main():
    parser = argparse.ArgumentParser(description="Generate digital human voiceover video using Volcengine API")
    parser.add_argument("--image", required=True, help="Input image path or URL")
    parser.add_argument("--text", required=True, help="Voiceover text content")
    parser.add_argument("--output", required=True, help="Output video path")
    parser.add_argument("--digital-human", action="store_true", help="Enable AI digital human conversion before generation")
    parser.add_argument("--voice-id", default="default", help="Voice ID for AI配音")

    args = parser.parse_args()

    if not ACCESS_KEY_ID or not SECRET_ACCESS_KEY:
        raise ValueError("VOLCENGINE_ACCESS_KEY_ID and VOLCENGINE_SECRET_ACCESS_KEY environment variables must be set")

    # Check if input is local file
    if not urlparse(args.image).scheme:
        image_url = upload_image(args.image)
    else:
        image_url = args.image

    digital_human_id = None
    if args.digital_human:
        print("Creating AI digital human from image...")
        digital_human_id = create_digital_human(image_url)
        print(f"Created digital human: {digital_human_id}")

    print("Starting video generation...")
    task_id = start_generation(
        image_url=image_url,
        digital_human_id=digital_human_id,
        text=args.text,
        voice_id=args.voice_id
    )
    print(f"Task ID: {task_id}")

    # Wait for completion
    print("Waiting for generation to complete...")
    for i in range(60):  # 5 minute timeout, 5s interval = 60 tries
        result = get_generation_result(task_id)
        if result["Status"] == "Success":
            break
        elif result["Status"] == "Failed":
            raise Exception("Video generation failed")
        time.sleep(5)
    else:
        raise TimeoutError("Generation timed out after 5 minutes")

    # Download video
    print(f"Downloading video to {args.output}")
    download_file(result["VideoUrl"], args.output)

    # Add subtitles if available
    if "SubtitleUrl" in result:
        subtitle_path = "temp_subtitles.srt"
        download_file(result["SubtitleUrl"], subtitle_path)

        from add_subtitles import add_subtitles_to_video
        temp_output = "temp_output.mp4"
        add_subtitles_to_video(args.output, subtitle_path, temp_output)
        os.replace(temp_output, args.output)

        os.remove(subtitle_path)

    print(f"Video generation completed successfully! Output saved to {args.output}")

if __name__ == "__main__":
    main()
