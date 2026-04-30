// Safely read VITE_API_URL — works even if import.meta.env is undefined
// (can happen in certain bundler edge cases or older WebViews)
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

// Final fallback — replace this with your Render backend URL once deployed
if (!API_URL) {
    API_URL = "https://edcheck.onrender.com";
}

console.log("Using API URL:", API_URL);

export default API_URL;
