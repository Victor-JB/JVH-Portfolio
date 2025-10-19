import os, time
import httpx

TENANT_ID = os.getenv("ENTRA_TENANT_ID", "")
CLIENT_ID = os.getenv("ENTRA_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("ENTRA_CLIENT_SECRET", "")
SCOPE = os.getenv("GRAPH_SCOPE", "https://graph.microsoft.com/.default")

_TOKEN = {"access_token": None, "exp": 0}


async def get_access_token(force: bool = False) -> str:
    if not force and _TOKEN["access_token"] and (_TOKEN["exp"] - time.time() > 60):
        return _TOKEN["access_token"]

    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    form = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": SCOPE,
    }
    async with httpx.AsyncClient(timeout=6.0) as client:
        r = await client.post(url, data=form)
        r.raise_for_status()
        t = r.json()

    _TOKEN["access_token"] = t["access_token"]
    _TOKEN["exp"] = time.time() + int(t.get("expires_in", 3600))
    return _TOKEN["access_token"]
