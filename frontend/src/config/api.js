// CRA (react-scripts) exposes env vars prefixed with REACT_APP_ via process.env.
// Set REACT_APP_BASE_URL in your .env file or deployment environment variables.
// e.g. for local dev:  REACT_APP_BASE_URL=http://localhost:5001
// e.g. for production: REACT_APP_BASE_URL=https://edcheck.onrender.com
let API_URL = process.env.REACT_APP_BASE_URL || null;

if (!API_URL) {
    // Fallback for production deployments where env var is not set
    API_URL = "https://edcheck.onrender.com";
    console.warn("REACT_APP_BASE_URL not set — using fallback:", API_URL);
}

console.log("Using API URL:", API_URL);

export default API_URL;
