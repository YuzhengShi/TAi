"""Amazon Polly TTS — reads text from stdin, writes OGG Opus audio to stdout."""
import boto3
import subprocess
import sys
import os

text = sys.stdin.read().strip()
if not text:
    print("Error: no text provided on stdin", file=sys.stderr)
    sys.exit(1)

# Polly limit: 3000 chars for standard text
if len(text) > 3000:
    text = text[:3000]

try:
    polly = boto3.client('polly', region_name=os.environ.get('AWS_REGION', 'us-west-2'))
    resp = polly.synthesize_speech(
        Text=text,
        OutputFormat='ogg_vorbis',
        Engine='neural',
        VoiceId='Joanna',
    )
    polly_audio = resp['AudioStream'].read()
except Exception as e:
    print(f"Polly error: {type(e).__name__}: {e}", file=sys.stderr)
    sys.exit(1)

# Convert OGG Vorbis → OGG Opus (WhatsApp requires Opus codec)
result = subprocess.run(
    ['ffmpeg', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '32k', '-f', 'ogg', 'pipe:1'],
    input=polly_audio,
    capture_output=True,
)
if result.returncode != 0:
    print(f"ffmpeg conversion failed: {result.stderr.decode()[:500]}", file=sys.stderr)
    sys.exit(1)

sys.stdout.buffer.write(result.stdout)
