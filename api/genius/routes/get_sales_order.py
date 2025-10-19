import os
import logging
from collections import OrderedDict
from fastapi import APIRouter, HTTPException

from ..auth import genius_get
from ..schemas import Item, SOResponse

# Setup logging
logger = logging.getLogger(os.getenv("APP_LOGGER"))

router = APIRouter()


# ---------------------------------------------------------------------------- #
def _to_item(ln):
    return Item(
        code=ln["ItemCode"],
        family=ln["FamilyCode"],
        description=ln.get("ItemDescription1", "").strip(),
        qty=ln.get("QtyOrderedBase", 0),
        eta=ln.get("DateDelivery"),
    )


# ---------------------------------------------------------------------------- #
def validate_items(lines):
    """
    1. remove 'tariff' surcharge rows (code or desc contains 'TARIFF')
    2. keep the first line per ItemCode (deduplicate)
    """
    dedup = OrderedDict()
    for ln in lines:
        code = ln["ItemCode"]
        desc = (ln.get("ItemDescription1") or "").upper()

        if "TARIFF" in code.upper() or "TARIFF" in desc:
            continue  # skip fees / surcharges

        if "CCPROCFEE" in code.upper() or "Credit Card" in desc:
            continue

        if code not in dedup:  # first occurrence wins
            dedup[code] = ln

    return list(dedup.values())


# ---------------------------------------------------------------------------- #
@router.get("/sales-order/{order_no}", response_model=SOResponse)
async def sales_order(order_no: str):

    items_res = await genius_get(
        "/api/data/fetch/salesOrderDetailEntity",
        params={"filter": f"SalesOrderHeaderCode={order_no}"},
    )

    if items_res.status_code != 200:
        logger.warning(
            f"Genius call for order {order_no} failed with status {items_res.status_code}"
        )
        raise HTTPException(items_res.status_code, items_res.text)

    try:
        raw_items = items_res.json()
        lines = validate_items(raw_items.get("Result", []))
    except Exception as e:
        logger.error(
            f"Failed to validate order body for order {order_no} with err:\n {e}"
        )
        raise HTTPException(500, f"Failed to validate order body for order {order_no}")

    if not lines:
        logger.warning(f"Genius 404: Order {order_no} not found in Genius")
        raise HTTPException(404, f"Order {order_no} not found in Genius")

    cust_name_res = await genius_get(
        "/api/data/fetch/salesOrderHeaderEntity",
        params={"filter": f"Code={order_no}"},
    )

    if cust_name_res.status_code != 200:
        logger.warning(
            f"Genius call for customer name with order {order_no} failed with status {cust_name_res.status_code}"
        )
        raise HTTPException(items_res.status_code, items_res.text)

    raw_customer = cust_name_res.json()
    if len(raw_customer["Result"]) == 0:
        logger.warning(f"Genius 404: Customer for order {order_no} not found in Genius")
        raise HTTPException(404, f"No customer name found for {order_no}")

    try:
        customer_name = raw_customer["Result"][0]["BillToCustomerName"]
    except Exception as e:
        logger.error(
            f"Failed to parse client name for order {order_no} with err:\n {e}"
        )
        raise HTTPException(500, f"Failed to parse client name for order {order_no}")

    try:
        items = [_to_item(ln) for ln in lines]
        earliest_eta = min(x.eta for x in items)
        return SOResponse(client=customer_name, ship_date=earliest_eta, items=items)
    except Exception as e:
        logger.error(
            f"Failed to parse client name for order {order_no} with err:\n {e}"
        )
        raise HTTPException(500, f"Failed to parse client name for order {order_no}")


# ---------------------------------------------------------------------------- #
@router.get("/health")
async def genius_health():
    """Genius API system health check"""
    return {
        "status": "healthy",
        # TODO: actually get test api ping and if 200 then report healthy...
    }
