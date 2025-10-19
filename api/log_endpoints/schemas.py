from pydantic import BaseModel
from typing import List, Optional


class DeviceInfo(BaseModel):
    type: str
    model: str


class SessionLogs(BaseModel):
    sessionId: str
    orderId: str
    device: DeviceInfo
    appVersion: str
    logs: List[str]
    timestamp: str
    startTime: Optional[int] = None
