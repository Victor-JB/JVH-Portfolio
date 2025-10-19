# api/main.py
"""
QC Vision API - Main Application

TODO:
- [ ] Add support for GroundedSAM
"""

import os
import logging
import uvicorn
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles

# Import configuration and setup modules
from .config import (
    APP_VERSION,
    APP_MODE,
    APP_LOGGER,
    HOST,
    PORT,
    WORKERS,
    STATIC_DIR,
    CADDY_DATA_DIR,
    get_uvicorn_config,
)
from .auth import add_auth_to_router
from .middleware import setup_middleware
from .internal_logging.setup import setup_logging, SERVER_LOGS_DIR

# Setup logging first
setup_logging()
app_logger = logging.getLogger(APP_LOGGER)

# Import routers
from .genius import router as genius_router
from .sharepoint import router as sharepoint_router
from .log_endpoints import router as logging_router
from .vision import router as vision_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup/shutdown events"""
    # Startup
    pid = os.getpid()
    app_logger.info(f"QC Photos App API starting (PID: {pid})")
    app_logger.info(f"Static files served from: {STATIC_DIR}")
    app_logger.info(f"Server logs saved to: {SERVER_LOGS_DIR}")
    app_logger.info(f"API Auth Bearer Enabled")

    if WORKERS > 1:
        app_logger.info(f"Running with {WORKERS} workers")
    else:
        app_logger.info("Running in single worker mode")

    yield  # Server runs

    # Shutdown
    app_logger.info(f"QC Photos App API shutting down (PID: {pid})")


# Create FastAPI app
app = FastAPI(
    title="Joulin Photos Tool",
    description="Joulin Vacuum Handling Backend REST API for internal QC/shipping product photos automation app",
    version=APP_VERSION,
    lifespan=lifespan,
)

# Setup middleware
setup_middleware(app)

# Include routers with authentication
app.include_router(add_auth_to_router(genius_router))
app.include_router(add_auth_to_router(vision_router))
app.include_router(add_auth_to_router(logging_router))
app.include_router(add_auth_to_router(sharepoint_router))


# ========== PUBLIC ENDPOINTS (No Auth Required) ==========
@app.get("/api/health")
async def health_check():
    """Main API health check - PUBLIC (no auth required)"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": app.version,
        "process_id": os.getpid(),
        "services": {"vision": "active", "logging": "active", "genius_proxy": "active"},
        "directories": {"static": str(STATIC_DIR), "logs": str(SERVER_LOGS_DIR)},
        "auth": "enabled",
    }


@app.get("/api/crt")
async def get_ca_certificate():
    """Endpoint to download Caddy's internal CA certificate - PUBLIC"""
    app_logger.info("[/api/crt] User requested internal CA cert")
    try:
        ca_cert_path = (
            CADDY_DATA_DIR / "caddy" / "pki" / "authorities" / "local" / "root.crt"
        )

        if not ca_cert_path.exists():
            return {
                "error": "CA certificate not found. Make sure Caddy has generated internal certificates."
            }

        with open(ca_cert_path, "rb") as f:
            cert_content = f.read()

        app_logger.info("[/api/crt] Successfully read cert... ready to send to user...")

        return Response(
            content=cert_content,
            media_type="application/x-x509-ca-cert",
            headers={
                "Content-Disposition": "attachment; filename=caddy-internal-ca.crt"
            },
        )
    except Exception as e:
        app_logger.error(f"Error serving CA certificate: {e}")
        return {"error": "Failed to retrieve CA certificate"}


# Mount static files (last to avoid route conflicts)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


# ========== MAIN ENTRY POINT ==========
if __name__ == "__main__":
    app_logger.info(f"Preparing to start app in {APP_MODE} mode @ {HOST}:{PORT}\n\n")

    uvicorn_options = get_uvicorn_config()

    if APP_MODE == "prod":
        app_logger.info(f"Production mode: Starting {WORKERS} worker(s)")
    else:
        app_logger.info("Development mode: Single worker with SSL")

    # Start the server (blocks until shutdown)
    uvicorn.run("api.main:app", **uvicorn_options)
