"""Quick R2 connectivity test — run with: python test_r2.py"""
import sys
import os

# Load .env manually so we don't need the full FastAPI stack
from pathlib import Path
env_path = Path(__file__).parent.parent / ".env"
for line in env_path.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ[k.strip()] = v.strip().strip('"')  # always override

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

account_id = os.environ["R2_ACCOUNT_ID"]
access_key = os.environ["R2_ACCESS_KEY_ID"]
secret_key = os.environ["R2_SECRET_ACCESS_KEY"]
bucket     = os.environ["R2_BUCKET"]
public_url = os.environ["R2_PUBLIC_URL"]

print(f"Account    : {account_id}")
print(f"Access Key : {access_key[:8]}...{access_key[-4:]}")  # partial for safety
print(f"Bucket     : {bucket}")
print(f"Pub URL    : {public_url}")
print()

client = boto3.client(
    "s3",
    endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

# 1. Upload a test object
key = "test/r2-check.txt"
payload = b"suplr r2 test ok"
print(f"Uploading {key} ...", end=" ", flush=True)
client.put_object(Bucket=bucket, Key=key, Body=payload, ContentType="text/plain")
print("ok")

# 2. Verify it exists
print(f"head_object  ...", end=" ", flush=True)
client.head_object(Bucket=bucket, Key=key)
print("ok")

# 3. Public URL reachable?
import urllib.request
url = f"{public_url}/{key}"
print(f"GET {url} ...", end=" ", flush=True)
try:
    with urllib.request.urlopen(url, timeout=8) as r:
        body = r.read()
    if body == payload:
        print("ok — content matches")
    else:
        print(f"WARNING: unexpected body: {body!r}")
except Exception as e:
    print(f"FAIL ({e})\n  → Make sure 'Public Development URL' is ENABLED on the bucket in the Cloudflare dashboard")

# 4. Cleanup
client.delete_object(Bucket=bucket, Key=key)
print("\nAll R2 checks passed.")
