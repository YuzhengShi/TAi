"""
YouTube Transcript API Service
Fetches YouTube transcripts via residential IP.
"""

import os
import re
from fastapi import FastAPI, HTTPException, Header, Query
from pydantic import BaseModel
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import GenericProxyConfig
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

app = FastAPI(title="YouTube Transcript API", docs_url=None, redoc_url=None)

AUTH_TOKEN = os.getenv("PROXY_AUTH_TOKEN", "changeme")

# Optional: route through another proxy if needed
UPSTREAM_PROXY = os.getenv("UPSTREAM_PROXY", "")


def get_video_id(video_input: str) -> str:
    """Extract video ID from URL or return as-is if already an ID."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$'
    ]
    for pattern in patterns:
        match = re.search(pattern, video_input)
        if match:
            return match.group(1)
    raise ValueError(f"Could not extract video ID from: {video_input}")


def get_ytt_client() -> YouTubeTranscriptApi:
    """Get YouTubeTranscriptApi instance, optionally with proxy."""
    if UPSTREAM_PROXY:
        proxy_config = GenericProxyConfig(
            http_url=UPSTREAM_PROXY,
            https_url=UPSTREAM_PROXY
        )
        return YouTubeTranscriptApi(proxy_config=proxy_config)
    return YouTubeTranscriptApi()


def check_auth(token: str):
    """Validate auth token."""
    if token != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/transcript/{video_input:path}/text")
async def get_transcript_text(
    video_input: str,
    lang: str = Query("en", description="Language code"),
    x_proxy_token: str = Header(..., alias="X-Proxy-Token")
):
    """
    Get transcript as plain text (just the words, no timestamps).
    """
    check_auth(x_proxy_token)
    
    try:
        video_id = get_video_id(video_input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    ytt = get_ytt_client()
    
    try:
        transcript = ytt.fetch(video_id, languages=[lang])
        full_text = " ".join(seg.text for seg in transcript.snippets)
        
        return {
            "video_id": video_id,
            "language": transcript.language,
            "language_code": transcript.language_code,
            "text": full_text
        }
        
    except TranscriptsDisabled:
        raise HTTPException(status_code=404, detail="Transcripts are disabled for this video")
    except NoTranscriptFound:
        raise HTTPException(status_code=404, detail=f"No transcript found for language: {lang}")
    except VideoUnavailable:
        raise HTTPException(status_code=404, detail="Video unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching transcript: {str(e)}")


@app.get("/transcript/{video_input:path}")
async def get_transcript(
    video_input: str,
    lang: str = Query("en", description="Language code (e.g., 'en', 'es', 'de')"),
    x_proxy_token: str = Header(..., alias="X-Proxy-Token")
):
    """
    Get transcript for a YouTube video.
    
    - video_input: Video ID or full YouTube URL
    - lang: Preferred language code (will fall back to available languages)
    """
    check_auth(x_proxy_token)
    
    try:
        video_id = get_video_id(video_input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    ytt = get_ytt_client()
    
    try:
        transcript = ytt.fetch(video_id, languages=[lang])
        
        return {
            "video_id": video_id,
            "language": transcript.language,
            "language_code": transcript.language_code,
            "is_generated": transcript.is_generated,
            "segments": [
                {
                    "text": seg.text,
                    "start": seg.start,
                    "duration": seg.duration
                }
                for seg in transcript.snippets
            ]
        }
        
    except TranscriptsDisabled:
        raise HTTPException(status_code=404, detail="Transcripts are disabled for this video")
    except NoTranscriptFound:
        raise HTTPException(status_code=404, detail=f"No transcript found for language: {lang}")
    except VideoUnavailable:
        raise HTTPException(status_code=404, detail="Video unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching transcript: {str(e)}")


@app.get("/transcripts/{video_input:path}")
async def list_transcripts(
    video_input: str,
    x_proxy_token: str = Header(..., alias="X-Proxy-Token")
):
    """
    List all available transcripts for a YouTube video.
    
    - video_input: Video ID or full YouTube URL
    """
    check_auth(x_proxy_token)
    
    try:
        video_id = get_video_id(video_input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    ytt = get_ytt_client()
    
    try:
        transcript_list = ytt.list(video_id)
        
        return {
            "video_id": video_id,
            "transcripts": [
                {
                    "language": t.language,
                    "language_code": t.language_code,
                    "is_generated": t.is_generated,
                    "is_translatable": t.is_translatable
                }
                for t in transcript_list
            ]
        }
        
    except TranscriptsDisabled:
        raise HTTPException(status_code=404, detail="Transcripts are disabled for this video")
    except VideoUnavailable:
        raise HTTPException(status_code=404, detail="Video unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing transcripts: {str(e)}")
