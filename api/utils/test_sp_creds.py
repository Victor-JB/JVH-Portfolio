import os, sys, asyncio

from typing import Optional, Dict, Any, List
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv()

# Add the parent directory to the system path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

# Assuming graph_http and GraphRequest are in your existing code
from sharepoint.graph_http import graph_http, GraphRequest

GRAPH_BASE = os.getenv("GRAPH_BASE", "https://graph.microsoft.com/v1.0")


async def get_sharepoint_site_info(
    tenant_name: str, site_path: str
) -> Optional[Dict[str, Any]]:
    """
    Fetches the site ID and other details for a given SharePoint site using its path.

    Args:
        tenant_name: The name of your tenant (e.g., 'piabgroup').
        site_path: The server-relative path to your site (e.g., 'sites/Joulin-USSharePoint2').

    Returns:
        A dictionary with site information, or None if the site is not found or an error occurs.
    """
    # Construct the endpoint to find the site by its server-relative URL
    # URL-encode the path to handle special characters, but only the path segment
    encoded_site_path = quote(f"/{site_path}")
    endpoint = f"/sites/{tenant_name}.sharepoint.com:{encoded_site_path}"

    print(f"Querying for site info at endpoint: {endpoint}")
    req = GraphRequest(
        method="GET",
        endpoint=endpoint,
        timeout_ms=6000,
        max_retries=3,
        raise_for_status=False,
    )

    try:
        response = await graph_http(req)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error finding SharePoint site: {e}")
        return None


async def list_site_drives(site_id: str) -> List[Dict[str, Any]]:
    """
    Lists all document libraries (drives) for a given SharePoint site ID.

    Args:
        site_id: The unique ID of the SharePoint site.

    Returns:
        A list of dictionaries, each representing a drive.
    """
    endpoint = f"/sites/{site_id}/drives"
    print(f"Querying for drives at endpoint: {endpoint}")
    req = GraphRequest(
        method="GET",
        endpoint=endpoint,
        timeout_ms=6000,
        max_retries=3,
        raise_for_status=False,
    )

    try:
        response = await graph_http(req)
        response.raise_for_status()
        data = response.json()
        return data.get("value", [])
    except Exception as e:
        print(f"Error listing drives for site {site_id}: {e}")
        return []


async def find_drive_id_by_name(
    drives: List[Dict[str, Any]], drive_name: str
) -> Optional[str]:
    """
    Finds the ID of a specific drive by its name.
    """
    for drive in drives:
        if drive.get("name", "").lower() == drive_name.lower():
            return drive.get("id")
    return None


async def get_drive_immediate_folders(
    drive_id: str, folder_path: str
) -> List[Dict[str, Any]]:
    """
    Fetches the immediate child folders within a specific folder path in a drive.

    Args:
        drive_id: The unique ID of the drive.
        folder_path: The server-relative path to the folder (e.g., 'Multimedia').

    Returns:
        A list of dictionaries, each representing an immediate child folder.
    """
    # URL-encode the path segment to handle special characters like spaces
    encoded_folder_path = quote(folder_path)

    # Construct the endpoint to list children of the specified path, filtering for folders only
    endpoint = f"/drives/{drive_id}/root:/{encoded_folder_path}:/children"
    params = {"$filter": "folder ne null"}

    print(f"Querying for immediate folders at endpoint: {endpoint} with filter")
    req = GraphRequest(
        method="GET",
        endpoint=endpoint,
        params=params,
        timeout_ms=6000,
        max_retries=3,
        raise_for_status=False,
    )

    try:
        response = await graph_http(req)
        response.raise_for_status()
        data = response.json()
        return data.get("value", [])
    except Exception as e:
        print(f"Error fetching immediate folders: {e}")
        return []


async def main():
    """Main function to demonstrate fetching site, drive IDs, and immediate folders."""
    # --- Configuration ---
    tenant_name = "[your tenent]"
    site_path = "sites/[put your site]"
    target_drive_name = "[your drive]"
    target_folder_path = "[your folder path]"  # The folder you want to inspect

    # --- Step 1: Get the SharePoint site ID ---
    site_info = await get_sharepoint_site_info(tenant_name, site_path)
    if not site_info:
        print("Could not retrieve site information. Exiting.")
        return
    site_id = site_info.get("id")

    # --- Step 2: List all drives for the site and find the target drive ---
    drives = await list_site_drives(site_id)
    if not drives:
        print("No drives found for this site.")
        return
    target_drive_id = await find_drive_id_by_name(drives, target_drive_name)
    if not target_drive_id:
        print(f"Could not find a drive named '{target_drive_name}'. Exiting.")
        return

    # --- Step 3: Get immediate folders within the target folder ---
    print("\n" + "-" * 50)
    print(f"Fetching immediate folders inside '{target_folder_path}'...")
    immediate_folders = await get_drive_immediate_folders(
        target_drive_id, target_folder_path
    )

    if immediate_folders:
        print(f"\nImmediate child folders found in '{target_folder_path}':")
        for folder in immediate_folders:
            print(f"  - Name: {folder.get('name')}")
    else:
        print(
            f"\nNo immediate folders found in '{target_folder_path}' or an error occurred."
        )


if __name__ == "__main__":
    asyncio.run(main())
