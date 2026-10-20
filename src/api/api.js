import axios from "axios";

// Make sure this matches the port your Flask app.py is running on
const API_BASE_URL = "http://127.0.0.1:5000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s - video analysis can take a few seconds
});

export const checkBackendStatus = async () => {
  const response = await api.get("/");
  return response.data;
};

export const uploadVideo = async (file) => {
  const formData = new FormData();
  formData.append("video", file);

  const response = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export default api;
