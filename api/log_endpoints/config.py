from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SESSION_LOGS_DIR = BASE_DIR / "logs/client"
SESSION_LOGS_DIR.mkdir(parents=True, exist_ok=True)
