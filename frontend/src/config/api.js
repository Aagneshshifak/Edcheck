// Safely read VITE_API_URL injected by Vite at build time.
// Set VITE_API_URL in Vercel environment variables to your GCP backend URL.
let API_URL;

try {
    API_URL =
        (typeof import.meta !== "undefined" &&
            import.meta.env &&
            import.meta.env.VITE_API_URL) ||
        null;
} catch (_) {
    API_URL = null;
}

if (!API_URL) {
    // Fallback: update this to your GCP backend URL
    API_URL = "https://edcheck.onrender.com";
    console.warn("VITE_API_URL not set — using fallback:", API_URL);
}

console.log("Using API URL:", API_URL);

export default API_URL;
