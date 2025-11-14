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

      // Log the received data from ThingSpeak
      console.log("📡 Data received from ThingSpeak:", {
        timestamp: latestData.created_at,
        field1_voltage: latestData.field1,
        field2_current: latestData.field2,
        field3_power: latestData.field3,
        field4_temperature: latestData.field4,
        field5_soc: latestData.field5,
        field6_soh: latestData.field6,
        field7_motorState: latestData.field7,
        field8_chargingState: latestData.field8,
      });

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

      // Advanced range calculation for 3.7V Li-ion battery
      const BATTERY_CONFIG = {
        capacity: 0.5, // Battery capacity in kWh (0.5 kWh = 500Wh for small Li-ion)
        efficiency: 25, // km per kWh (Li-ion e-bikes/scooters typically 20-30 km/kWh)
        minTemp: 0, // Li-ion works down to 0°C
        maxTemp: 45, // Li-ion max recommended temp 45°C
      };

      // Base range calculation
      let baseRange =
        (batteryData.soc / 100) *
        BATTERY_CONFIG.capacity *
        BATTERY_CONFIG.efficiency;

      // Temperature correction
      let tempFactor = 1.0;
      if (batteryData.temperature < BATTERY_CONFIG.minTemp) {
        tempFactor = 0.8; // 20% reduction in cold
      } else if (batteryData.temperature > BATTERY_CONFIG.maxTemp) {
        tempFactor = 0.9; // 10% reduction in heat
      }

      // Apply corrections
      batteryData.estimatedRange = (baseRange * tempFactor).toFixed(1);

      // Determine charging status from chargingState field
      batteryData.chargingStatus = batteryData.chargingState;

      console.log("✅ Processed battery data:", {
        voltage: batteryData.voltage,
        current: batteryData.current,
        power: batteryData.power,
        temperature: batteryData.temperature,
        soc: batteryData.soc,
        soh: batteryData.soh,
        estimatedRange: batteryData.estimatedRange,
        chargingStatus: batteryData.chargingStatus,
      });

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
 * GET /api/history
 * Fetches the last 10 entries for SOC and SOH from ThingSpeak
 */
app.get("/api/history", async (req, res) => {
  try {
    const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json`;
    const params = {
      api_key: THINGSPEAK_READ_API_KEY,
      results: 10, // Get last 10 entries
    };

    const response = await axios.get(url, { params });

    if (
      response.data &&
      response.data.feeds &&
      response.data.feeds.length > 0
    ) {
      const historyData = response.data.feeds.map((entry) => ({
        timestamp: entry.created_at,
        soc: parseFloat(entry.field5) || 0,
        soh: parseFloat(entry.field6) || 0,
      }));

      console.log(
        "📊 Historical data retrieved:",
        historyData.length,
        "entries"
      );

      res.json({
        success: true,
        data: historyData,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "No historical data available from ThingSpeak",
      });
    }
  } catch (error) {
    console.error(
      "Error fetching historical data from ThingSpeak:",
      error.message
    );
    res.status(500).json({
      success: false,
      message: "Failed to fetch historical data from ThingSpeak",
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
