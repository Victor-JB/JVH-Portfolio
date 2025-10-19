import os
import requests
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()

# Azure AD Application Details
TENANT_ID = os.getenv("ENTRA_TENANT_ID")
CLIENT_ID = os.getenv("ENTRA_CLIENT_ID")
CLIENT_SECRET = os.getenv("ENTRA_CLIENT_SECRET")
SHAREPOINT_SITE_URL = os.getenv("SHAREPOINT_SITE_URL")

# Microsoft Graph API Endpoints
GRAPH_API_URL = "https://graph.microsoft.com/v1.0"
TOKEN_URL = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"


def get_access_token():
    """Obtains an access token for Microsoft Graph API."""
    token_data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default",
    }
    response = requests.post(TOKEN_URL, data=token_data)
    response.raise_for_status()
    return response.json()["access_token"]


def format_site_url_for_graph(site_url):
    """
    Formats SharePoint URL for Microsoft Graph API.

    The Graph API expects this format:
    - Root site: hostname.sharepoint.com
    - Subsite: hostname.sharepoint.com:/sites/sitename:
    """
    # Remove protocol if present
    if site_url.startswith(("http://", "https://")):
        site_url = site_url.split("://", 1)[1]

    # Remove trailing slash if present
    site_url = site_url.rstrip("/")

    # Split into hostname and path
    parts = site_url.split("/", 1)
    hostname = parts[0]

    if len(parts) > 1 and parts[1]:
        # This is a subsite - format as hostname:/path:
        path = parts[1]
        return f"{hostname}:/{path}:"
    else:
        # This is a root site - just return hostname
        return hostname


def get_sharepoint_site_id(access_token, site_url):
    """Retrieves the ID of a SharePoint site."""
    headers = {"Authorization": f"Bearer {access_token}"}

    # Format the site URL correctly for Graph API
    formatted_url = format_site_url_for_graph(site_url)
    print(f"Formatted site URL: {formatted_url}")

    # For Graph API sites endpoint, we don't encode the colon characters
    # but we do need to encode other special characters
    site_endpoint = f"{GRAPH_API_URL}/sites/{formatted_url}"

    print(f"API Endpoint: {site_endpoint}")

    response = requests.get(site_endpoint, headers=headers)

    # Debug: Print response details
    print(f"Response Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Response Text: {response.text}")

    response.raise_for_status()
    return response.json().get("id")


def get_site_drives(access_token, site_id):
    """Retrieves the drives (document libraries) within a SharePoint site."""
    headers = {"Authorization": f"Bearer {access_token}"}
    drives_endpoint = f"{GRAPH_API_URL}/sites/{site_id}/drives"

    print(f"Drives endpoint: {drives_endpoint}")

    response = requests.get(drives_endpoint, headers=headers)

    # Debug: Print response details
    print(f"Drives Response Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Drives Response Text: {response.text}")

    response.raise_for_status()
    return response.json().get("value", [])


def get_site_by_display_name(access_token, site_name):
    """Alternative method: Search for site by display name."""
    headers = {"Authorization": f"Bearer {access_token}"}
    search_endpoint = f"{GRAPH_API_URL}/sites?search={quote(site_name)}"

    response = requests.get(search_endpoint, headers=headers)
    response.raise_for_status()

    sites = response.json().get("value", [])
    return sites


if __name__ == "__main__":
    try:
        token = get_access_token()
        print("✓ Access Token obtained successfully.")

        # Method 1: Try to get site by URL
        try:
            site_id = get_sharepoint_site_id(token, SHAREPOINT_SITE_URL)
            if site_id:
                print(f"✓ SharePoint Site ID: {site_id}")

                drives = get_site_drives(token, site_id)
                if drives:
                    print("\n📁 Drives (Document Libraries) in the site:")
                    for drive in drives:
                        print(f"  • Drive Name: {drive.get('name')}")
                        print(f"    Drive ID: {drive.get('id')}")
                        print(f"    Drive Type: {drive.get('driveType', 'Unknown')}")
                        print()
                else:
                    print("No drives found for this site.")
            else:
                print(f"Could not find Site ID for '{SHAREPOINT_SITE_URL}'.")

        except requests.exceptions.RequestException as e:
            if hasattr(e, "response") and e.response.status_code == 400:
                print(f"\n❌ 400 Error with URL method. Trying search method...")

                # Method 2: Search by site name (fallback)
                print("Trying alternative methods...")

                # Try different approaches
                approaches = [
                    ("Root site", SHAREPOINT_SITE_URL.split("/")[0]),
                    ("Search by name", SHAREPOINT_SITE_URL.split("/")[-1]),
                    ("List all sites", ""),
                ]

                for approach_name, search_term in approaches:
                    print(f"\n🔍 {approach_name}:")
                    try:
                        if search_term:
                            sites = get_site_by_display_name(token, search_term)
                        else:
                            # List all sites the user has access to
                            headers = {"Authorization": f"Bearer {token}"}
                            response = requests.get(
                                f"{GRAPH_API_URL}/sites", headers=headers
                            )
                            response.raise_for_status()
                            sites = response.json().get("value", [])

                        if sites:
                            print(f"Found {len(sites)} site(s):")
                            for i, site in enumerate(sites[:5]):  # Show first 5
                                print(f"  {i+1}. Name: {site.get('displayName')}")
                                print(f"     ID: {site.get('id')}")
                                print(f"     URL: {site.get('webUrl')}")
                                print(
                                    f"     Site Collection: {site.get('siteCollection', {}).get('hostname', 'N/A')}"
                                )
                                print()

                            if len(sites) > 5:
                                print(f"     ... and {len(sites) - 5} more sites")

                            break
                        else:
                            print(f"No sites found for: {search_term}")
                    except Exception as search_error:
                        print(f"Error in {approach_name}: {search_error}")
                        continue
            else:
                raise e

    except requests.exceptions.RequestException as e:
        print(f"❌ HTTP Error occurred: {e}")
        if hasattr(e, "response"):
            print(f"Response status: {e.response.status_code}")
            print(f"Response text: {e.response.text}")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
