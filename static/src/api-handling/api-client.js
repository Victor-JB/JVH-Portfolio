import { API_TOKEN } from "../secrets-config.js";

/**
 * Helper function to make authenticated API calls
 * @param {string} endpoint - The API endpoint (e.g., '/api/sharepoint/upload')
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Response>} - The fetch response
 */
export async function authenticatedFetch(url, options = {}) {
	// Ensure headers object exists
	if (!options.headers) {
		options.headers = {};
	}

	// Add the Authorization header with Bearer token
	options.headers["Authorization"] = `Bearer ${API_TOKEN}`;

	// Make the request
	const response = await fetch(url, options);

	// Check for auth errors
	if (response.status === 401) {
		console.error("Authentication failed - check your API token");
		throw new Error("Unauthorized: Invalid or missing API token");
	}

	return response;
}
