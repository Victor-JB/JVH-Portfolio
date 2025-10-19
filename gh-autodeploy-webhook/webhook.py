# webhook.py
import os, sys, hmac, hashlib, json, subprocess, threading
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import PlainTextResponse
import uvicorn

load_dotenv()

app = FastAPI()

GITHUB_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")
DEPLOY_SCRIPT = "restart-app.ps1"
BRANCH = "main"


def log(msg: str, level: str = "INFO"):
    """
    Simple stdout/stderr logger (shows up in NSSM log files).
    """
    output = sys.stderr if level == "ERROR" else sys.stdout
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Format the timestamp
    print(f"[{timestamp}] [{level}] {msg}", file=output, flush=True)


def stream_output(process: subprocess.Popen, script_name: str):
    """Read subprocess output line by line and log it."""
    try:
        # Read stdout
        for line in iter(process.stdout.readline, b""):
            if line:
                log(f"[{script_name}] {line.decode('utf-8').rstrip()}")

        # Wait for process to complete and get return code
        returncode = process.wait()

        if returncode == 0:
            log(f"[{script_name}] Script completed successfully (exit code: 0)\n\n")
        else:
            # Read any stderr output
            stderr_output = process.stderr.read().decode("utf-8").strip()
            if stderr_output:
                log(f"[{script_name}] STDERR: {stderr_output}", "ERROR")
            log(f"[{script_name}] Script failed (exit code: {returncode})\n\n", "ERROR")

    except Exception as e:
        log(f"[{script_name}] Error streaming output: {e}\n\n", "ERROR")


def verify_signature(body: bytes, signature_header: str) -> bool:
    if not signature_header or not signature_header.startswith("sha256="):
        log(f"[verify_signature] Missing or bad header: {signature_header}")
        return False
    their_sig = signature_header.split("=", 1)[1].strip()
    digest = hmac.new(GITHUB_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    ok = hmac.compare_digest(their_sig, digest)
    log(f"[verify_signature] Computed={digest}, Provided={their_sig}, Match={ok}")
    return ok


@app.post("/deploy", response_class=PlainTextResponse)
async def deploy(request: Request):
    # 1) Basic checks
    if not GITHUB_SECRET:
        raise HTTPException(
            status_code=500, detail="Server misconfigured (missing secret)."
        )

    log("== /deploy called ==")
    raw = await request.body()
    sig = request.headers.get("X-Hub-Signature-256", "")
    event = request.headers.get("X-GitHub-Event", "")

    log(f"[headers] Event={event}, Signature={sig[:15]}..., BodyLen={len(raw)}")

    if not verify_signature(raw, sig):
        log("❌ Signature verification failed", "ERROR")
        raise HTTPException(status_code=403, detail="Invalid signature")

    if event != "push":
        log(f"Ignored non-push event: {event}")
        return PlainTextResponse("Ignored: not a push event.", status_code=200)

    try:
        payload = json.loads(raw.decode("utf-8"))
        ref = payload.get("ref", "")
        log(f"[payload] ref={ref}")
    except Exception as e:
        log(f"❌ JSON decode failed: {e}", "ERROR")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if ref != f"refs/heads/{BRANCH}":
        log(f"Ignored: push to wrong branch ({ref})")
        return PlainTextResponse("Ignored: different branch.", status_code=200)

    try:
        log(f"Launching deploy script: {DEPLOY_SCRIPT}")

        # Start the PowerShell script with output capture
        process = subprocess.Popen(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                DEPLOY_SCRIPT,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,  # Use bytes
            bufsize=1,  # Line buffered
        )

        log(f"Deploy script started (PID: {process.pid})")

        # Start a thread to stream the output without blocking the response
        output_thread = threading.Thread(
            target=stream_output, args=(process, DEPLOY_SCRIPT), daemon=True
        )
        output_thread.start()

    except Exception as e:
        log(f"❌ Failed to start deploy script: {e}", "ERROR")
        raise HTTPException(status_code=500, detail=f"Failed to start deploy: {e}")

    return PlainTextResponse(f"Deploy started (PID: {process.pid}).", status_code=200)


@app.get("/health")
async def health():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "service": "webhook-listener"}


if __name__ == "__main__":
    log("Starting webhook server on 127.0.0.1:9000")
    uvicorn.run(app, host="127.0.0.1", port=9000)
