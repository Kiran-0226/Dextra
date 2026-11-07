import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runChat } from "./config/gemini.js";

dotenv.config();

const app = express();
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests without an Origin header (health checks / server-to-server).
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.status(200).send("Dextra backend is running");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "dextra-backend" });
});

app.post("/chat", async (req, res) => {
  try {
    const { prompt } = req.body ?? {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const text = await runChat(prompt.trim());
    return res.json({ text });
  } catch (error) {
    console.error("Chat request failed:", error);
    return res.status(500).json({
      error: "Dextra could not generate a response. Check the backend logs and Gemini API configuration.",
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Dextra backend listening on port ${PORT}`);
});
