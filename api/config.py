# api/config.py
"""
Configuration and settings for the API.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# App configuration
APP_VERSION = os.getenv("APP_VERSION")
APP_MODE = os.getenv("APP_MODE")
HOST = os.getenv("HOST")
PORT = int(os.getenv("PORT"))
WORKERS = int(os.getenv("WORKERS", 1))

# SSL/HTTPS configuration
FORCE_HTTPS = os.getenv("FORCE_HTTPS", "0") == "1"
CERT_FILE = os.getenv("CERT_FILE")
KEY_FILE = os.getenv("KEY_FILE")

# Proxy configuration
FORWARDED_ALLOW_IPS = os.getenv("FORWARDED_ALLOW_IPS", "127.0.0.1")

_missing = [
    k
    for k, v in {
        "APP_VERSION": APP_VERSION,
        "HOST": APP_MODE,
        "PORT": PORT,
        "WORKERS": WORKERS,
    }.items()
    if not v
]
if _missing:
    raise RuntimeError(f"Missing required env vars: {', '.join(_missing)}")

# Directory setup
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
CADDY_DATA_DIR = BASE_DIR / "caddy-data"

# Create directories if they don't exist
STATIC_DIR.mkdir(exist_ok=True)

# Logger name
APP_LOGGER = os.getenv("APP_LOGGER", "api")


def get_uvicorn_config():
    """
    Get Uvicorn server configuration based on environment.

    Returns:
        dict: Uvicorn configuration options
    """
    uvicorn_options = {
        "host": HOST,
        "port": PORT,
        "log_level": "info",
        "timeout_keep_alive": 30,
        "log_config": None,
    }

    if APP_MODE == "prod":
        # Production configuration (behind Caddy reverse proxy)
        uvicorn_options.update(
            {
                "workers": WORKERS,
                "proxy_headers": True,
                "forwarded_allow_ips": FORWARDED_ALLOW_IPS,
            }
        )
    else:
        # Development/testing configuration (manual SSL)
        uvicorn_options.update(
            {
                "ssl_certfile": CERT_FILE,
                "ssl_keyfile": KEY_FILE,
            }
        )

    return uvicorn_options
