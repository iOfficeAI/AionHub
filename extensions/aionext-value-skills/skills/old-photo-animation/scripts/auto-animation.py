import os
import argparse
import random
from urllib.parse import urlparse

# Reference default texts
DEFAULT_TEXTS = {
    "portrait": [
        "这张珍贵的照片记录了那段难忘的岁月，时光流转，回忆永远清晰。",
        "岁月带走了青春年华，却带不走心中那份永恒的记忆。",
        "每一道皱纹都藏着故事，每一个笑容都温暖人心，这就是我们最珍贵的回忆。"
    ],
    "group": [
        "这是我们曾经在一起的证明，岁月流逝，友情永不褪色。",
        "多年前的相聚，定格成永远的画面，感谢缘分让我们相遇。",
        "一张张熟悉的笑脸，拼凑出那段最美的时光，怀念我们一起走过的日子。"
    ],
    "landscape": [
        "这就是记忆中的故乡美景，时光改变了很多，但这份美丽永远留在心中。",
        "多年前的这片风景，依旧在记忆中闪耀，这就是时光的礼物。"
    ],
    "child": [
        "童年的天真烂漫，都定格在这张照片里，那是最无忧无虑的时光。",
        "小时候的样子真好，纯真的笑容，对世界充满好奇，这就是最美的模样。"
    ],
    "wedding": [
        "这一刻的幸福，永远定格在镜头里，成为一生中最美好的回忆。",
        "从这一天开始，我们携手走过，这份爱，时光会记得。"
    ]
}

def auto_select_text(image_path=None, scene=None):
    """
    Automatically select appropriate text based on scene.
    If scene is not provided, select a general text.
    """
    if scene and scene in DEFAULT_TEXTS:
        return random.choice(DEFAULT_TEXTS[scene])
    else:
        # Default to portrait if unknown
        return random.choice(DEFAULT_TEXTS["portrait"])

def run_restoration(input_photo, output_restored, platform="liudong", upscale=2):
    """Run old photo restoration using selected platform"""
    if platform == "liudong":
        script_path = os.path.join(
            os.environ.get("CODEX_HOME", "~/.codex"),
            "skills/old-photo-restoration/scripts/restoration-liudong.py"
        )
    else:
        script_path = os.path.join(
            os.environ.get("CODEX_HOME", "~/.codex"),
            "skills/old-photo-restoration/scripts/restoration-volcengine.py"
        )

    # Import and run the restoration script
    import sys
    sys.path.insert(0, os.path.dirname(script_path))

    # We call it via subprocess for better isolation
    import subprocess
    cmd = [
        "python", script_path,
        "--input", input_photo,
        "--output", output_restored,
        "--upscale", str(upscale)
    ]

    print(f"Running restoration: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        raise Exception(f"Restoration failed with exit code {result.returncode}")

    return output_restored

def generate_voiceover(restored_image, text, output_video, platform="liudong", digital_human=False):
    """Generate voiceover video using selected platform"""
    if platform == "liudong":
        script_path = os.path.join(
            os.environ.get("CODEX_HOME", "~/.codex"),
            "skills/digital-human-voiceover/scripts/digital-human-liudong.py"
        )
    else:
        script_path = os.path.join(
            os.environ.get("CODEX_HOME", "~/.codex"),
            "skills/digital-human-voiceover/scripts/digital-human-volcengine.py"
        )

    import subprocess
    cmd = [
        "python", script_path,
        "--image", restored_image,
        "--text", text,
        "--output", output_video
    ]

    if digital_human:
        cmd.append("--digital-human")

    print(f"Generating voiceover: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        raise Exception(f"Voiceover generation failed with exit code {result.returncode}")

    return output_video

def main():
    parser = argparse.ArgumentParser(description="Automatically animate old photo with voiceover")
    parser.add_argument("--input", required=True, help="Input old photo path")
    parser.add_argument("--output-video", required=True, help="Output animated video path")
    parser.add_argument("--output-restored", help="Output path for restored photo (optional)")
    parser.add_argument("--platform", default="liudong", choices=["liudong", "volcengine"], help="Processing platform (default: liudong)")
    parser.add_argument("--scene", choices=["portrait", "group", "landscape", "child", "wedding"], help="Scene type for automatic text selection")
    parser.add_argument("--text", help="Custom text (overrides automatic selection)")

    args = parser.parse_args()

    # Step 1: Restore the photo
    if args.output_restored:
        output_restored = args.output_restored
    else:
        # Create temporary output for restored photo
        base_name = os.path.splitext(args.input)[0]
        output_restored = f"{base_name}_restored.jpg"

    print(f"Step 1/3: Restoring old photo using {args.platform}...")
    run_restoration(args.input, output_restored, platform=args.platform)

    # Step 2: Select text
    if args.text:
        selected_text = args.text
    else:
        print(f"Step 2/3: Automatically selecting text for {args.scene if args.scene else 'unknown scene'}...")
        selected_text = auto_select_text(scene=args.scene)

    print(f"Selected text: {selected_text}")

    # Step 3: Generate voiceover video (real person direct voiceover per requirements)
    print(f"Step 3/3: Generating voiceover video using {args.platform}...")
    generate_voiceover(
        output_restored,
        selected_text,
        args.output_video,
        platform=args.platform,
        digital_human=False  # Requirement says use real person direct voiceover
    )

    print()
    print("Complete!")
    print(f"  - Restored photo: {output_restored}")
    print(f"  - Final video: {args.output_video}")

if __name__ == "__main__":
    main()
