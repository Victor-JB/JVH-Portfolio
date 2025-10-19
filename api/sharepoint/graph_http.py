import os, asyncio, random, time
import httpx
from typing import Optional
from email.utils import parsedate_to_datetime

from .graph_auth import get_access_token
from .schemas import GraphRequest

GRAPH_BASE = os.getenv("GRAPH_BASE", "https://graph.microsoft.com/v1.0")


def _should_retry(resp: Optional[httpx.Response], err: Optional[Exception]) -> bool:
    if err is not None:
        return isinstance(
            err,
            (
                httpx.ConnectError,
                httpx.ReadError,
                httpx.RemoteProtocolError,
                httpx.ReadTimeout,
                httpx.ConnectTimeout,
                httpx.PoolTimeout,
                httpx.NetworkError,
            ),
        )
    if resp is None:
        return False
    return resp.status_code in (408, 429, 500, 502, 503, 504)


def _retry_after_delay(resp: Optional[httpx.Response], attempt: int) -> float:
    if resp is not None:
        ra = resp.headers.get("Retry-After")
        if ra:
            try:
                return max(0.0, float(ra))
            except ValueError:
                try:
                    dt = parsedate_to_datetime(ra)
                    return max(0.0, dt.timestamp() - time.time())
                except Exception:
                    pass
    base = min(0.5 * (2**attempt), 5.0)
    return base + random.uniform(0, 0.25)


async def graph_http(req: GraphRequest) -> httpx.Response:
    assert req.endpoint.startswith("/"), "endpoint must start with '/'"
    url = f"{GRAPH_BASE}{req.endpoint}"

    token = await get_access_token()
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if req.extra_headers:
        headers.update(req.extra_headers)

    timeout = httpx.Timeout(req.timeout_ms / 1000.0)
    attempts = req.max_retries + 1
    refreshed = False

    async with httpx.AsyncClient(timeout=timeout) as client:
        last_resp: Optional[httpx.Response] = None
        last_err: Optional[Exception] = None

        for attempt in range(attempts):
            last_err = None
            try:
                last_resp = await client.request(
                    req.method,
                    url,
                    params=req.params,
                    json=req.json,
                    data=req.data,
                    headers=headers,
                )

                if last_resp.status_code == 401 and not refreshed:
                    token = await get_access_token(force=True)
                    headers["Authorization"] = f"Bearer {token}"
                    refreshed = True
                    await asyncio.sleep(0.2)
                    continue

                if _should_retry(last_resp, None) and attempt < attempts - 1:
                    await asyncio.sleep(_retry_after_delay(last_resp, attempt))
                    continue

                if req.raise_for_status:
                    last_resp.raise_for_status()
                return last_resp

            except Exception as e:
                last_err = e
                if attempt < attempts - 1 and _should_retry(None, e):
                    await asyncio.sleep(_retry_after_delay(None, attempt))
                    continue

        if last_err:
            raise last_err
        if req.raise_for_status and last_resp is not None:
            last_resp.raise_for_status()
        return last_resp
