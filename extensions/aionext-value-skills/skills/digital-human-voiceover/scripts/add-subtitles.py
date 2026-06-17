import argparse
import os
import subprocess

def add_subtitles_to_video(video_path, srt_path, output_path):
    """
    使用ffmpeg将字幕嵌入视频文件
    """
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"subtitles={srt_path}",
        "-c:a", "copy",
        output_path,
        "-y"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error adding subtitles: {result.stderr}")
        return False
    return True

def generate_srt_from_text(text, output_path):
    """
    根据文案生成简单的SRT字幕文件
    """
    # 将文本按句子分割
    sentences = [s.strip() for s in text.split('.') if s.strip()]
    srt_content = ""
    start_time = 0
    duration_per_sentence = 3  # 每个句子显示3秒

    for i, sentence in enumerate(sentences, 1):
        start = format_srt_time(start_time)
        end = format_srt_time(start_time + duration_per_sentence)
        srt_content += f"{i}\n{start} --> {end}\n{sentence}\n\n"
        start_time += duration_per_sentence

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(srt_content)

    return output_path

def format_srt_time(seconds):
    """
    格式化秒数为SRT时间格式: HH:MM:SS,mmm
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add subtitles to a video file")
    parser.add_argument("--video", required=True, help="Input video path")
    parser.add_argument("--text", help="Text content to generate subtitles from")
    parser.add_argument("--srt", help="Existing SRT file path")
    parser.add_argument("--output", required=True, help="Output video path")

    args = parser.parse_args()

    if args.text:
        # Generate SRT from text
        srt_path = "temp_subtitles.srt"
        generate_srt_from_text(args.text, srt_path)
    elif args.srt:
        srt_path = args.srt
    else:
        print("Either --text or --srt must be provided")
        exit(1)

    success = add_subtitles_to_video(args.video, srt_path, args.output)

    if success:
        print(f"Subtitles added successfully, output saved to {args.output}")
    else:
        exit(1)
