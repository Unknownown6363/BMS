require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve static files from 'public' folder

// ThingSpeak Configuration
const THINGSPEAK_CHANNEL_ID = process.env.THINGSPEAK_CHANNEL_ID;
const THINGSPEAK_READ_API_KEY = process.env.THINGSPEAK_READ_API_KEY;
const THINGSPEAK_WRITE_API_KEY = process.env.THINGSPEAK_WRITE_API_KEY;

// Validate environment variables
if (
  !THINGSPEAK_CHANNEL_ID ||
  !THINGSPEAK_READ_API_KEY ||
  !THINGSPEAK_WRITE_API_KEY
) {
  console.error("❌ Error: Missing ThingSpeak credentials in .env file");
  process.exit(1);
}

// API Routes

/**
 * GET /api/data
 * Fetches the latest battery data from ThingSpeak
 */
app.get("/api/data", async (req, res) => {
  try {
    const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json`;
    const params = {
      api_key: THINGSPEAK_READ_API_KEY,
      results: 1, // Get only the latest entry
    };

    const response = await axios.get(url, { params });

    if (
      response.data &&
      response.data.feeds &&
      response.data.feeds.length > 0
    ) {
      const latestData = response.data.feeds[0];

      // Parse the data from ThingSpeak fields
      const batteryData = {
        voltage: parseFloat(latestData.field1) || 0,
        current: parseFloat(latestData.field2) || 0,
        power: parseFloat(latestData.field3) || 0,
        temperature: parseFloat(latestData.field4) || 0,
        soc: parseFloat(latestData.field5) || 0,
        soh: parseFloat(latestData.field6) || 0,
        motorState: parseInt(latestData.field7) || 0,
        chargingState: parseInt(latestData.field8) || 0,
        timestamp: latestData.created_at,
      };

      // Calculate estimated range (simple placeholder formula)
      // Range = SOC * 100 (can be modified later)
      batteryData.estimatedRange = ((batteryData.soc * 100) / 100).toFixed(1);

      res.json({
        success: true,
        data: batteryData,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "No data available from ThingSpeak",
      });
    }
  } catch (error) {
    console.error("Error fetching data from ThingSpeak:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch data from ThingSpeak",
      error: error.message,
    });
  }
});

/**
 * POST /api/mode
 * Sends motor mode (ON/OFF) to ThingSpeak
 * Body: { mode: 0 (ON) or 1 (OFF) }
 */
app.post("/api/mode", async (req, res) => {
  try {
    const { mode } = req.body;

    // Validate mode value
    if (mode !== 0 && mode !== 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid mode. Use 0 for Motor ON or 1 for Motor OFF",
      });
    }

    // Send data to ThingSpeak using field7 for motor mode
    const url = `https://api.thingspeak.com/update.json`;
    const params = {
      api_key: THINGSPEAK_WRITE_API_KEY,
      field7: mode,
    };

    const response = await axios.post(url, null, { params });

    if (response.data && response.data !== 0) {
      res.json({
        success: true,
        message: `Motor ${mode === 0 ? "ON" : "OFF"} mode sent successfully`,
        entryId: response.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to update ThingSpeak. Check your WRITE API key.",
      });
    }
  } catch (error) {
    console.error("Error sending mode to ThingSpeak:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to send mode to ThingSpeak",
      error: error.message,
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "EV Battery Monitor API is running",
    timestamp: new Date().toISOString(),
  });
});

// Serve index.html for root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 ThingSpeak Channel ID: ${THINGSPEAK_CHANNEL_ID}`);
  console.log(`✅ Ready to monitor EV battery!`);
});
