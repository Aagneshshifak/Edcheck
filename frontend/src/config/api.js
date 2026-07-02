let API_URL;

if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    // When running the frontend locally, connect to the local backend
    API_URL = "http://localhost:5001";
} else {
    // When running the frontend in production (Vercel), connect to the Render backend
    API_URL = "https://edcheck.onrender.com";
}

// Optional: allow explicit override via environment variable if needed
if (process.env.REACT_APP_BASE_URL && process.env.REACT_APP_BASE_URL !== "http://localhost:5001") {
    API_URL = process.env.REACT_APP_BASE_URL;
}

console.log("Using API URL:", API_URL);

export default API_URL;
