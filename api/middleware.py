# api/middleware.py
"""
Middleware configuration for the FastAPI application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from .config import FORCE_HTTPS


def setup_middleware(app: FastAPI) -> None:
    """
    Configure all middleware for the FastAPI application.

    Args:
        app: FastAPI application instance
    """
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
        allow_credentials=True,  # Important for Authorization header
    )

    # Compression middleware
    app.add_middleware(GZipMiddleware, minimum_size=1_000)

    # HTTPS redirect (only if explicitly requested)
    if FORCE_HTTPS:
        app.add_middleware(HTTPSRedirectMiddleware)
