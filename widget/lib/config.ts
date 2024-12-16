const isProd = process.env.NODE_ENV === "production";

export const API_BASE_URL = isProd
  ? "https://api.lescommuns.fr" // Replace with your actual production URL
  : "http://localhost:3000";
