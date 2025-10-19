from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SP_UPLOAD_SESSION_DIR = BASE_DIR / "logs/server"
SP_UPLOAD_SESSION_DIR.mkdir(parents=True, exist_ok=True)
