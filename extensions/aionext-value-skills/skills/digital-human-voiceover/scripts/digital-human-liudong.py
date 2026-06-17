import os
import requests
import time
import argparse
from urllib.parse import urlparse

LIUDONG_API_BASE = os.environ.get("LIUDONG_API_BASE", "https://api.liudongai.com/v1")
ACCESS_TOKEN = os.environ.get("LIUDONG_ACCESS_TOKEN")

def upload_image(image_path):
    """Upload local image to get a public URL"""
    # For demonstration, this step should be implemented based on actual storage requirements
    # In production, you would upload to your own storage or Liudong's storage
    print(f"Uploading image: {image_path}")
    # TODO: Implement actual image upload
    # For now, assume image is already accessible via URL
    return image_path  # Replace with actual returned URL

def generate_digital_human_video(image_url, text, enable_digital_human=False, voice_id="default"):
    """Start digital human video generation task"""
    if not ACCESS_TOKEN:
        raise ValueError("LIUDONG_ACCESS_TOKEN environment variable is not set")

    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    if enable_digital_human:
        endpoint = f"{LIUDONG_API_BASE}/digital-human/create-and-generate"
    else:
        endpoint = f"{LIUDONG_API_BASE}/digital-human/generate"

    payload = {
        "image_url": image_url,
        "text": text,
        "voice_id": voice_id,
        "with_subtitles": True
    }

    response = requests.post(endpoint, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()

    if data.get("code") != 0:
        raise Exception(f"API error: {data.get('message', 'Unknown error')}")

    return data["data"]["task_id"]

def wait_for_completion(task_id, poll_interval=5, timeout=300):
    """Wait for task to complete and return video URL"""
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}"
    }

    start_time = time.time()
    while time.time() - start_time < timeout:
        response = requests.get(f"{LIUDONG_API_BASE}/task/{task_id}", headers=headers)
        response.raise_for_status()
        data = response.json()

        if data.get("code") != 0:
            raise Exception(f"API error: {data.get('message', 'Unknown error')}")

        status = data["data"]["status"]
        if status == "success":
            return (
                data["data"]["video_url"],
                data["data"].get("subtitle_url")
            )
        elif status == "failed":
            raise Exception("Task generation failed")

        print(f"Task still processing, checking again in {poll_interval} seconds...")
        time.sleep(poll_interval)

    raise TimeoutError(f"Task timed out after {timeout} seconds")

def download_file(url, output_path):
    """Download file from URL to local path"""
    response = requests.get(url, stream=True)
    response.raise_for_status()

    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

    return output_path

def main():
    parser = argparse.ArgumentParser(description="Generate digital human voiceover video using Liudong API")
    parser.add_argument("--image", required=True, help="Input image path or URL")
    parser.add_argument("--text", required=True, help="Voiceover text content")
    parser.add_argument("--output", required=True, help="Output video path")
    parser.add_argument("--digital-human", action="store_true", help="Enable AI digital human conversion before generation")
    parser.add_argument("--voice-id", default="default", help="Voice ID for AI配音")

    args = parser.parse_args()

    # Check if input is local file, upload it if needed
    if not urlparse(args.image).scheme:
        # Local file, need to upload
        image_url = upload_image(args.image)
    else:
        image_url = args.image

    # Start generation task
    print(f"Starting video generation, digital human: {args.digital_human}")
    task_id = generate_digital_human_video(
        image_url,
        args.text,
        enable_digital_human=args.digital_human,
        voice_id=args.voice_id
    )

    # Wait for completion
    print(f"Waiting for task {task_id} to complete...")
    video_url, subtitle_url = wait_for_completion(task_id)

    # Download video
    print(f"Downloading generated video to {args.output}")
    download_file(video_url, args.output)

    # Add subtitles if we have them
    if subtitle_url:
        subtitle_path = "temp_subtitles.srt"
        download_file(subtitle_url, subtitle_path)

        # Embed subtitles into video
        from add_subtitles import add_subtitles_to_video
        temp_output = "temp_output.mp4"
        add_subtitles_to_video(args.output, subtitle_path, temp_output)
        os.replace(temp_output, args.output)

        # Clean up
        os.remove(subtitle_path)

    print(f"Video generation completed successfully! Output saved to {args.output}")

if __name__ == "__main__":
    main()
