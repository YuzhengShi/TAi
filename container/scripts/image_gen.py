"""Stability Stable Image Core -- reads prompt from stdin, writes PNG to stdout."""
import boto3
import json
import base64
import sys
import os

prompt = sys.stdin.read().strip()
if not prompt:
    print("Error: no prompt provided", file=sys.stderr)
    sys.exit(1)
if len(prompt) > 10000:
    prompt = prompt[:10000]

model_id = 'stability.stable-image-core-v1:1'
region = os.environ.get('AWS_REGION', 'us-west-2')

try:
    client = boto3.client('bedrock-runtime', region_name=region)
    body = json.dumps({
        "prompt": prompt,
        "output_format": "png",
        "aspect_ratio": "1:1",
    })
    resp = client.invoke_model(modelId=model_id, body=body)
    result = json.loads(resp["body"].read())
    sys.stdout.buffer.write(base64.b64decode(result["images"][0]))
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}", file=sys.stderr)
    sys.exit(1)
