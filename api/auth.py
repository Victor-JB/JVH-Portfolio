# api/auth.py
"""
Authentication configuration and dependencies for the API.
"""

import os
import secrets
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

app_logger = logging.getLogger(os.getenv("APP_LOGGER", "api"))

# Get token from environment or generate one
API_TOKEN = os.getenv("API_BEARER_TOKEN")

if not API_TOKEN:
    # Generate a secure random token
    API_TOKEN = secrets.token_urlsafe(32)
    error_msg = (
        f"\n\nAPI_BEARER_TOKEN not set in environment vars"
        f"Secure token has been generated to use:\n\n"
        f"{API_TOKEN}\n\n"
        f"Add this to your .env file:\n"
        f"API_BEARER_TOKEN={API_TOKEN}\n"
    )
    # Raise RuntimeError to force the user to set the token
    raise RuntimeError(error_msg)

# Create the security scheme
security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Dependency function to verify the bearer token.
    Returns the token if valid, raises 401 if not.
    """
    token = credentials.credentials
    if token != API_TOKEN:
        app_logger.warning(f"Invalid token attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


def add_auth_to_router(router):
    """
    Helper to add authentication to all routes in a router.

    Args:
        router: FastAPI router instance

    Returns:
        The same router with auth dependencies added
    """
    auth_dependency = Depends(verify_token)
    for route in router.routes:
        if hasattr(route, "dependencies"):
            if route.dependencies is None:
                route.dependencies = []
            route.dependencies.append(auth_dependency)
    return router
