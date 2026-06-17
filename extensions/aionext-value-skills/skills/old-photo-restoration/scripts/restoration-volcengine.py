import os
import requests
import argparse
from urllib.parse import urlparse
import hmac
import hashlib
import datetime

ACCESS_KEY_ID = os.environ.get("VOLCENGINE_ACCESS_KEY_ID")
SECRET_ACCESS_KEY = os.environ.get("VOLCENGINE_SECRET_ACCESS_KEY")
REGION = os.environ.get("VOLCENGINE_REGION", "cn-beijing")
API_HOST = "open.volcengineapi.com"

def sign_request(method, uri, query_params, body):
    """Volcengine request signing"""
    now = datetime.datetime.utcnow()
    x_date = now.strftime("%Y%m%dT%H%M%SZ")
    credential_scope = f"{x_date[:8]}/{REGION}/openapi/request"

    sorted_query = sorted(query_params.items())
    canonical_query = "&".join([f"{k}={v}" for k, v in sorted_query])

    canonical_request = f"{method}\n{uri}\n{canonical_query}\n\nhost:{API_HOST}\nx-date:{x_date}\n\n"
    canonical_request += "content-sha256=" + hashlib.sha256(body.encode('utf-8')).hexdigest()

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

def restore_old_photo(image_url, upscale=2, repair_scratch=True, colorize=True):
    """Restore old photo using Volcengine image enhance API"""
    method = "POST"
    uri = "/api/v1/image/enhance"
    query_params = {
        "Action": "ImageEnhance",
        "Version": "2023-12-01"
    }

    payload = {
        "image_url": image_url,
        "upscale": upscale,
        "repair_scratch": repair_scratch,
        "colorize": colorize
    }

    body = str(payload).replace("'", '"')
    headers = sign_request(method, uri, query_params, body)

    url = f"https://{API_HOST}{uri}"
    response = requests.post(url, params=query_params, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()

    return data["Result"]["result_image_url"]

def upload_image(image_path):
    """Upload local image"""
    # TODO: Implement actual upload
    return image_path

def download_image(url, output_path):
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

def main():
    parser = argparse.ArgumentParser(description="Restore old photo using Volcengine API")
    parser.add_argument("--input", required=True, help="Input old photo path or URL")
    parser.add_argument("--output", required=True, help="Output restored image path")
    parser.add_argument("--upscale", type=int, default=2, help="Upscale factor")
    parser.add_argument("--no-repair", action="store_true", help="Disable scratch repair")
    parser.add_argument("--no-colorize", action="store_true", help="Disable colorization for black and white photos")

    args = parser.parse_args()

    if not ACCESS_KEY_ID or not SECRET_ACCESS_KEY:
        raise ValueError("VOLCENGINE_ACCESS_KEY_ID and VOLCENGINE_SECRET_ACCESS_KEY must be set")

    if not urlparse(args.input).scheme:
        image_url = upload_image(args.input)
    else:
        image_url = args.input

    print("Starting old photo restoration...")
    restored_url = restore_old_photo(
        image_url,
        upscale=args.upscale,
        repair_scratch=not args.no_repair,
        colorize=not args.no_colorize
    )

    download_image(restored_url, args.output)
    print(f"Restoration completed! Restored image saved to {args.output}")

if __name__ == "__main__":
    main()
