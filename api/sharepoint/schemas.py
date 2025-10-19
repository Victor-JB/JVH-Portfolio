from typing import Any, Dict, Optional, Union, Literal, List
from pydantic import BaseModel, Field

HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE"]


# ================== General graph request for graph_http  =================== #
class GraphRequest(BaseModel):
    method: HttpMethod
    endpoint: str  # e.g. "/drives/{id}/root:/path"
    params: Optional[Dict[str, Union[str, int]]] = None
    json: Optional[Any] = None
    data: Optional[Union[bytes, Dict[str, Any]]] = None
    extra_headers: Optional[Dict[str, str]] = None
    timeout_ms: int = 6000
    max_retries: int = 3
    raise_for_status: bool = False


# ============================ Schemas for /check ============================ #
class FileEntry(BaseModel):
    id: Optional[str] = None
    name: str
    size: int = 0
    web_url: Optional[str] = Field(None, alias="webUrl")
    content_type: Optional[str] = None

    class Config:
        populate_by_name = True


class CheckResponse(BaseModel):
    ok: bool
    customer: str
    order_no: str
    order_folder_id: Optional[str] = None
    folder_exists: bool
    has_photos: bool
    photo_count: int
    files: List[FileEntry] = []


# =========================== Schemas for /upload ============================ #
class UploadedFile(BaseModel):
    id: Optional[str] = None
    name: str
    web_url: Optional[str] = Field(None, alias="webUrl")
    size: Optional[int] = 0
    content_type: Optional[str] = None

    class Config:
        populate_by_name = True


class UploadResponse(BaseModel):
    ok: bool
    customer: str
    order_no: str
    folderId: str
    created_customer: bool
    created_order: bool
    uploaded_count: int
    uploaded: list[UploadedFile] = []
