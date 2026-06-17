import os
import requests
import argparse
from urllib.parse import urlparse

LIUDONG_API_BASE = os.environ.get("LIUDONG_API_BASE", "https://api.liudongai.com/v1")
ACCESS_TOKEN = os.environ.get("LIUDONG_ACCESS_TOKEN")

def upload_image(image_path):
    """Upload local image"""
    # TODO: Implement actual upload
    print(f"Uploading image: {image_path}")
    return image_path

def restore_old_photo(image_url, upscale=2, face_enhance=True):
    """Restore old photo using Liudong API"""
    if not ACCESS_TOKEN:
        raise ValueError("LIUDONG_ACCESS_TOKEN environment variable is not set")

    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "image_url": image_url,
        "upscale": upscale,
        "face_enhance": face_enhance
    }

    response = requests.post(f"{LIUDONG_API_BASE}/image/restoration", json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()

    if data.get("code") != 0:
        raise Exception(f"API error: {data.get('message', 'Unknown error')}")

    return data["data"]["restored_image_url"]

def download_image(url, output_path):
    """Download restored image"""
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

def main():
    parser = argparse.ArgumentParser(description="Restore old photo using Liudong AI")
    parser.add_argument("--input", required=True, help="Input old photo path or URL")
    parser.add_argument("--output", required=True, help="Output restored image path")
    parser.add_argument("--upscale", type=int, default=2, help="Upscale factor (default 2)")
    parser.add_argument("--no-face-enhance", action="store_true", help="Disable face enhancement")

    args = parser.parse_args()

    if not urlparse(args.input).scheme:
        image_url = upload_image(args.input)
    else:
        image_url = args.input

    print("Starting old photo restoration...")
    restored_url = restore_old_photo(
        image_url,
        upscale=args.upscale,
        face_enhance=not args.no_face_enhance
    )

    print("Downloading restored image...")
    download_image(restored_url, args.output)

    print(f"Restoration completed! Restored image saved to {args.output}")

if __name__ == "__main__":
    main()
