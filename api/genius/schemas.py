import pydantic as p
from datetime import datetime


class Item(p.BaseModel):
    code: str
    family: str
    description: str
    qty: float
    eta: datetime


class SOResponse(p.BaseModel):
    client: str
    ship_date: datetime
    items: list[Item]
