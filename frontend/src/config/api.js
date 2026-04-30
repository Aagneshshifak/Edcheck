const API_URL =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    "http://16.112.195.241:5001";

console.log("Using API URL:", API_URL);

export default API_URL;
