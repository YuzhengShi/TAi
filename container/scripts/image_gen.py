"""Amazon Nova Canvas -- reads prompt from stdin, writes PNG to stdout."""
import boto3
import json
import base64
import sys
import os

prompt = sys.stdin.read().strip()
if not prompt:
    print("Error: no prompt provided", file=sys.stderr)
    sys.exit(1)
if len(prompt) > 1024:
    prompt = prompt[:1024]  # Nova Canvas limit

model_id = 'amazon.nova-canvas-v1:0'  # 不加 us. 前缀
region = 'us-east-1'  # Nova Canvas 仅 us-east-1 可用

try:
    client = boto3.client('bedrock-runtime', region_name=region)
    body = json.dumps({
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {"text": prompt},
        "imageGenerationConfig": {
            "numberOfImages": 1,
            "width": 1024,
            "height": 1024,
            "cfgScale": 8.0,
        }
    })
    resp = client.invoke_model(modelId=model_id, body=body)
    result = json.loads(resp["body"].read())
    sys.stdout.buffer.write(base64.b64decode(result["images"][0]))
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}", file=sys.stderr)
    sys.exit(1)
