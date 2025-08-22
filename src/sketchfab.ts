import type { Asset } from './types';

const SKETCHFAB_CLIENT_ID = "YOUR_SKETCHFAB_CLIENT_ID"; // TODO: Replace with your actual Sketchfab Client ID
const SKETCHFAB_REDIRECT_URI = window.location.origin + "/redirect.html"; // TODO: Ensure redirect.html exists and handles the token

export function redirectToSketchfabLogin() {
    const authUrl = `https://sketchfab.com/oauth2/authorize/?response_type=token&client_id=${SKETCHFAB_CLIENT_ID}&redirect_uri=${SKETCHFAB_REDIRECT_URI}`;
    window.location.href = authUrl;
}

export function getAccessToken(): string | null {
    return localStorage.getItem('sketchfab_access_token');
}

export function logout() {
    localStorage.removeItem('sketchfab_access_token');
}

export async function getSketchfabModelDownloadUrl(uid: string): Promise<string> {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No Sketchfab access token available. Please log in.');
    }

    const url = `https://api.sketchfab.com/v3/models/${uid}/download`;
    const options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
        mode: 'cors' as RequestMode
    };

    const response = await fetch(url, options);
    if (response.status === 401) {
        logout(); // Clear expired token
        throw new Error('Sketchfab authentication expired. Please log in again.');
    }
    if (!response.ok) {
        throw new Error(`Failed to get Sketchfab download URL: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.gltf && data.gltf.url) {
        return data.gltf.url;
    } else {
        throw new Error('GLTF download URL not found in Sketchfab response.');
    }
}

export async function searchSketchfab(query: string): Promise<Asset[]> {
    const accessToken = getAccessToken();
    if (!accessToken) {
        // If no access token, return empty results. The UI will prompt for login.
        return [];
    }

    const url = `https://api.sketchfab.com/v3/models?q=${encodeURIComponent(query)}&type=models&per_page=20`;
    const options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
        mode: 'cors' as RequestMode
    };

    const response = await fetch(url, options);
    if (response.status === 401) {
        logout(); // Clear expired token
        throw new Error('Sketchfab authentication expired. Please log in again.');
    }
    if (!response.ok) {
        throw new Error(`Failed to search Sketchfab: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Map Sketchfab API response to our Asset interface
    return data.results.map((model: any) => ({
        id: model.uid,
        name: model.name,
        description: model.description,
        source: 'sketchfab',
        url: model.viewerUrl,
        thumbnailUrl: model.thumbnails.images.find((img: any) => img.width === 256)?.url || '',
        tags: model.tags.map((tag: any) => tag.name),
    }));
}
