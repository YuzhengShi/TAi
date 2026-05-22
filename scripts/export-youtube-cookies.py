#!/usr/bin/env python3
"""Export YouTube cookies from Chrome and upload to S3.

Reads Chrome's cookie database on Windows (copies it to bypass lock),
decrypts with DPAPI, exports in Netscape format, and uploads to S3.

Requirements: pip install pycryptodomex boto3
Usage: python scripts/export-youtube-cookies.py

Works while Chrome is running (copies the DB file first).
"""

import base64
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

try:
    import boto3
    from Cryptodome.Cipher import AES
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install pycryptodomex boto3")
    sys.exit(1)

S3_BUCKET = "tai-backups-prod"
S3_KEY = "youtube-cookies.txt"
AWS_REGION = "us-west-2"

CHROME_USER_DATA = Path(os.environ["LOCALAPPDATA"]) / "Google" / "Chrome" / "User Data"
COOKIE_DB = CHROME_USER_DATA / "Default" / "Network" / "Cookies"
LOCAL_STATE = CHROME_USER_DATA / "Local State"


def get_encryption_key():
    """Get Chrome's AES encryption key via Windows DPAPI."""
    import ctypes
    import ctypes.wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", ctypes.wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_char)),
        ]

    with open(LOCAL_STATE, "r", encoding="utf-8") as f:
        local_state = json.load(f)

    encrypted_key = base64.b64decode(local_state["os_crypt"]["encrypted_key"])
    # Remove "DPAPI" prefix (first 5 bytes)
    encrypted_key = encrypted_key[5:]

    # Decrypt with DPAPI
    blob_in = DATA_BLOB(len(encrypted_key), ctypes.create_string_buffer(encrypted_key, len(encrypted_key)))
    blob_out = DATA_BLOB()

    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)
    ):
        raise RuntimeError("CryptUnprotectData failed — are you running as the correct user?")

    key = ctypes.string_at(blob_out.pbData, blob_out.cbData)
    ctypes.windll.kernel32.LocalFree(blob_out.pbData)
    return key


def decrypt_cookie_value(encrypted_value: bytes, key: bytes) -> str:
    """Decrypt a Chrome cookie value using AES-256-GCM."""
    if encrypted_value[:3] == b"v10" or encrypted_value[:3] == b"v20":
        # v10/v20: AES-256-GCM with 12-byte nonce
        nonce = encrypted_value[3:15]
        ciphertext = encrypted_value[15:-16]
        tag = encrypted_value[-16:]
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        return cipher.decrypt_and_verify(ciphertext, tag).decode("utf-8")
    else:
        # Old DPAPI-encrypted value (fallback)
        import ctypes
        import ctypes.wintypes

        class DATA_BLOB(ctypes.Structure):
            _fields_ = [
                ("cbData", ctypes.wintypes.DWORD),
                ("pbData", ctypes.POINTER(ctypes.c_char)),
            ]

        blob_in = DATA_BLOB(len(encrypted_value), ctypes.create_string_buffer(encrypted_value, len(encrypted_value)))
        blob_out = DATA_BLOB()
        if ctypes.windll.crypt32.CryptUnprotectData(
            ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)
        ):
            result = ctypes.string_at(blob_out.pbData, blob_out.cbData)
            ctypes.windll.kernel32.LocalFree(blob_out.pbData)
            return result.decode("utf-8")
        return ""


def export_cookies():
    """Extract .youtube.com cookies from Chrome's SQLite DB."""
    if not COOKIE_DB.exists():
        print(f"Chrome cookie DB not found at: {COOKIE_DB}")
        sys.exit(1)

    print("Getting Chrome encryption key...")
    key = get_encryption_key()

    # Copy DB to temp (Chrome locks the original)
    tmp = Path(tempfile.gettempdir()) / "chrome_cookies_copy"
    shutil.copy2(COOKIE_DB, tmp)

    print("Reading cookies for .youtube.com ...")
    conn = sqlite3.connect(str(tmp))
    cursor = conn.cursor()
    cursor.execute(
        "SELECT host_key, path, is_secure, expires_utc, name, encrypted_value "
        "FROM cookies WHERE host_key LIKE '%youtube.com'"
    )
    rows = cursor.fetchall()
    conn.close()
    tmp.unlink()

    if not rows:
        print("No YouTube cookies found in Chrome.")
        print("Make sure you're logged into youtube.com in Chrome.")
        sys.exit(1)

    print(f"Found {len(rows)} cookies")

    lines = ["# Netscape HTTP Cookie File", "# https://curl.se/docs/http-cookies.html", ""]
    for host_key, path, is_secure, expires_utc, name, encrypted_value in rows:
        value = decrypt_cookie_value(encrypted_value, key) if encrypted_value else ""
        secure = "TRUE" if is_secure else "FALSE"
        domain_dot = "TRUE" if host_key.startswith(".") else "FALSE"
        # Chrome stores expires_utc as microseconds since 1601-01-01
        # Convert to Unix epoch (seconds since 1970-01-01)
        if expires_utc and expires_utc > 0:
            expires = str(int((expires_utc / 1_000_000) - 11644473600))
        else:
            expires = "0"
        lines.append(f"{host_key}\t{domain_dot}\t{path}\t{secure}\t{expires}\t{name}\t{value}")

    return "\n".join(lines) + "\n"


def upload_to_s3(content: str):
    """Upload cookie file to S3."""
    print(f"Uploading to s3://{S3_BUCKET}/{S3_KEY} ...")
    s3 = boto3.client("s3", region_name=AWS_REGION)
    s3.put_object(Bucket=S3_BUCKET, Key=S3_KEY, Body=content.encode())
    print("Done!")


def main():
    content = export_cookies()

    # Save locally as backup
    local_path = Path(tempfile.gettempdir()) / "youtube-cookies.txt"
    local_path.write_text(content)
    print(f"Saved local copy: {local_path}")

    upload_to_s3(content)
    print(f"\nYouTube cookies uploaded to S3. TAi can now fetch transcripts.")
    print("Re-run this script when cookies expire (typically weeks/months).")


if __name__ == "__main__":
    main()
