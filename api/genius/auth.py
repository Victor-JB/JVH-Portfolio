# genius_auth.py
"""
Minimal Genius ERP auth helper.
- Logs in once and caches Bearer token
- Adds Authorization header to all Genius requests
- On 401, re-logs in once and retries
- Reuses a single AsyncClient (fast connection pooling)

Required env vars:
  GENIUS_HOST           e.g., "https://genius.company.com" (no trailing slash)
  GENIUS_COMPANY_CODE   e.g., "ABC"
  GENIUS_USERNAME       e.g., "api_user"
  GENIUS_PASSWORD       e.g., "supersecret"
"""

import os
import logging
from typing import Optional
import anyio
import httpx

# ---- Minimal required configuration via env ----
GENIUS_HOST = os.getenv("GENIUS_HOST")
GENIUS_COMPANY_CODE = os.getenv("GENIUS_COMPANY_CODE")
GENIUS_USERNAME = os.getenv("GENIUS_USERNAME")
GENIUS_PASSWORD = os.getenv("GENIUS_PASSWORD")

# logger = logging.getLogger(os.getenv("APP_LOGGER"))


class _GeniusAuth:
    """
    Minimal token manager + request wrapper.
    """

    def __init__(self) -> None:
        self._base_url = GENIUS_HOST.rstrip("/")
        self._company = GENIUS_COMPANY_CODE
        self._username = GENIUS_USERNAME
        self._password = GENIUS_PASSWORD

        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(4.0),
            headers={"Accept": "application/json"},
        )
        self._token: Optional[str] = None
        self._login_lock = anyio.Lock()

    async def _login(self) -> str:
        """
        POST /api/auth with minimal payload. Token is returned in 'Result'.
        """
        payload = {
            "CompanyCode": self._company,
            "Username": self._username,
            "Password": self._password,
        }

        resp = await self._client.post("/api/auth", json=payload)
        if resp.status_code != 200:
            raise httpx.HTTPStatusError(
                "Genius login failed", request=resp.request, response=resp
            )
        data = resp.json()
        token = data.get("Result")
        if not token or not isinstance(token, str):
            raise RuntimeError("Genius login succeeded but no token found in 'Result'.")
        self._token = token
        # set header on the shared client
        self._client.headers["Authorization"] = f"Bearer {token}"
        return token

    async def _ensure_token(self) -> None:
        if self._token:
            # Header should already be present; keep it cheap.
            return
        async with self._login_lock:
            if not self._token:
                await self._login()

    async def request(self, method: str, path: str, **kwargs) -> httpx.Response:
        """
        Authorized request against Genius API.
        Retries once on 401 by re-logging in.
        """
        await self._ensure_token()
        resp = await self._client.request(method, path, **kwargs)
        if resp.status_code != 401:
            return resp

        # Retry once with a fresh login (coalesced under lock)
        async with self._login_lock:
            # Clear and re-login
            self._token = None
            self._client.headers.pop("Authorization", None)
            await self._login()
        return await self._client.request(method, path, **kwargs)

    async def aclose(self) -> None:
        await self._client.aclose()


# Singleton used by importers
_auth = _GeniusAuth()


# ---- Minimal helpers you can import in your routes/services ----
async def genius_get(path: str, **kwargs) -> httpx.Response:
    return await _auth.request("GET", path, **kwargs)


async def genius_post(path: str, **kwargs) -> httpx.Response:
    return await _auth.request("POST", path, **kwargs)


async def genius_put(path: str, **kwargs) -> httpx.Response:
    return await _auth.request("PUT", path, **kwargs)


async def genius_delete(path: str, **kwargs) -> httpx.Response:
    return await _auth.request("DELETE", path, **kwargs)


async def genius_close_client() -> None:
    """
    Optional: call from your FastAPI shutdown event to close the HTTP client.
    """
    await _auth.aclose()
