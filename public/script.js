// DOM Elements
const batteryLiquid = document.getElementById("batteryLiquid");
const batteryPercentage = document.getElementById("batteryPercentage");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const chargeStatus = document.getElementById("chargeStatus");
const voltageEl = document.getElementById("voltage");
const currentEl = document.getElementById("current");
const powerEl = document.getElementById("power");
const temperatureEl = document.getElementById("temperature");
const socEl = document.getElementById("soc");
const sohEl = document.getElementById("soh");
const rangeEl = document.getElementById("range");
const lastUpdateEl = document.getElementById("lastUpdate");
const toastContainer = document.getElementById("toastContainer");
const alertBanner = document.getElementById("alertBanner");
const alertContent = document.getElementById("alertContent");
const warningsList = document.getElementById("warningsList");
const connectionStatus = document.getElementById("connectionStatus");
const historyTableBody = document.getElementById("historyTableBody");

// Progress bars
const voltageBar = document.getElementById("voltageBar");
const currentBar = document.getElementById("currentBar");
const powerBar = document.getElementById("powerBar");
const tempBar = document.getElementById("tempBar");
const socBar = document.getElementById("socBar");
const sohBar = document.getElementById("sohBar");
const rangeBar = document.getElementById("rangeBar");

// Auto-refresh interval (15 seconds)
const REFRESH_INTERVAL = 15000;
let refreshTimer = null;

// Warning thresholds for 3.7V Li-ion battery (easily customizable)
const THRESHOLDS = {
  temperature: {
    critical: 50, // °C - Li-ion danger zone
    warning: 45, // °C
    low: 0, // °C - Li-ion performs poorly below 0°C
  },
  voltage: {
    critical_low: 3.0, // V - Below this damages Li-ion
    warning_low: 3.3, // V - Low voltage warning
    critical_high: 4.3, // V - Overcharge danger
    warning_high: 4.0, // V - Fully charged
  },
  soc: {
    critical: 10, // %
    warning: 20, // %
  },
  soh: {
    critical: 60, // %
    warning: 75, // %
  },
  current: {
    warning_high: 600, // mA
  },
};

/**
 * Fetch battery data from the API
 */
async function fetchBatteryData() {
  try {
    console.log("🔄 Fetching battery data from ThingSpeak...");
    const response = await fetch("/api/data");
    const result = await response.json();

    if (result.success && result.data) {
      console.log("✅ Battery data received:", result.data);
      updateUI(result.data);
      updateConnectionStatus(true);
    } else {
      console.warn("⚠️ No data available from ThingSpeak");
      showToast("⚠️ No data available from ThingSpeak", "warning");
      updateConnectionStatus(false);
    }
  } catch (error) {
    console.error("❌ Error fetching data:", error);
    showToast("❌ Failed to fetch battery data", "error");
    updateConnectionStatus(false);
  }
}

/**
 * Fetch historical data from the API
 */
async function fetchHistoricalData() {
  try {
    console.log("📊 Fetching historical data from ThingSpeak...");
    const response = await fetch("/api/history");
    const result = await response.json();

    if (result.success && result.data) {
      console.log(
        "✅ Historical data received:",
        result.data.length,
        "entries"
      );
      updateHistoryTable(result.data);
    } else {
      console.warn("⚠️ No historical data available");
      historyTableBody.innerHTML =
        '<tr><td colspan="4" class="no-data-cell">No historical data available</td></tr>';
    }
  } catch (error) {
    console.error("❌ Error fetching historical data:", error);
    historyTableBody.innerHTML =
      '<tr><td colspan="4" class="error-cell">Failed to load historical data</td></tr>';
  }
}

/**
 * Update UI with battery data
 */
function updateUI(data) {
  // Update voltage (3.7V Li-ion range: 2.5V - 4.2V)
  voltageEl.textContent = data.voltage.toFixed(2);
  updateProgressBar(voltageBar, data.voltage, 2.5, 4.2);

  // Update current (in mA)
  currentEl.textContent = data.current.toFixed(2);
  updateProgressBar(currentBar, Math.abs(data.current), 0, 150);

  // Update power (in Watts)
  powerEl.textContent = data.power.toFixed(2);
  updateProgressBar(powerBar, Math.abs(data.power), 0, 50);

  // Update temperature (Li-ion range: 0°C - 50°C)
  temperatureEl.textContent = data.temperature.toFixed(1);
  updateProgressBar(tempBar, data.temperature, 0, 50);

  // Update SOC
  socEl.textContent = data.soc.toFixed(1);
  updateProgressBar(socBar, data.soc, 0, 100);

  // Update SOH
  sohEl.textContent = data.soh.toFixed(1);
  updateProgressBar(sohBar, data.soh, 0, 100);

  // Update estimated range
  rangeEl.textContent = data.estimatedRange;
  updateProgressBar(rangeBar, parseFloat(data.estimatedRange), 0, 20);

  // Update battery visual
  updateBatteryVisual(data.soc);

  // Update charging status
  updateChargingStatus(data.chargingStatus);

  // Update last update time
  updateLastUpdateTime(data.timestamp);

  // Check for warnings
  checkWarnings(data);
}

/**
 * Update progress bar
 */
function updateProgressBar(barElement, value, min, max) {
  const percentage = Math.max(
    0,
    Math.min(100, ((value - min) / (max - min)) * 100)
  );
  barElement.style.width = `${percentage}%`;
}

/**
 * Update battery liquid animation
 */
function updateBatteryVisual(soc) {
  const percentage = Math.max(0, Math.min(100, soc));
  batteryLiquid.style.height = `${percentage}%`;
  batteryPercentage.textContent = `${percentage.toFixed(0)}%`;

  // Change color based on charge level
  if (percentage <= 20) {
    batteryLiquid.style.background =
      "linear-gradient(180deg, #ff4757, #ff6b81)";
  } else if (percentage <= 50) {
    batteryLiquid.style.background =
      "linear-gradient(180deg, #ffb800, #ffa502)";
  } else {
    batteryLiquid.style.background =
      "linear-gradient(180deg, #00f5ff, #00ff88)";
  }
}

/**
 * Update charging/discharging status
 */
function updateChargingStatus(status) {
  if (status === 1) {
    // Charging
    statusIcon.textContent = "🔌";
    statusText.textContent = "Charging";
    chargeStatus.style.borderColor = "#00ff88";
    chargeStatus.style.background = "rgba(0, 255, 136, 0.05)";
  } else {
    // Discharging
    statusIcon.textContent = "⚡";
    statusText.textContent = "Discharging";
    chargeStatus.style.borderColor = "#ffb800";
    chargeStatus.style.background = "rgba(255, 184, 0, 0.05)";
  }
}

/**
 * Update last update time
 */
function updateLastUpdateTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);

  let timeAgo;
  if (diffSeconds < 60) {
    timeAgo = `${diffSeconds}s ago`;
  } else if (diffSeconds < 3600) {
    timeAgo = `${Math.floor(diffSeconds / 60)}m ago`;
  } else {
    timeAgo = `${Math.floor(diffSeconds / 3600)}h ago`;
  }

  lastUpdateEl.textContent = timeAgo;
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(isConnected) {
  const statusDot = connectionStatus.querySelector(".status-dot");
  const statusTextNode =
    connectionStatus.childNodes[connectionStatus.childNodes.length - 1];

  if (isConnected) {
    statusDot.style.background = "#00ff88";
    statusDot.style.boxShadow = "0 0 10px #00ff88";
    if (statusTextNode && statusTextNode.nodeType === Node.TEXT_NODE) {
      statusTextNode.textContent = "Active";
    }
  } else {
    statusDot.style.background = "#ff4757";
    statusDot.style.boxShadow = "0 0 10px #ff4757";
    if (statusTextNode && statusTextNode.nodeType === Node.TEXT_NODE) {
      statusTextNode.textContent = "Disconnected";
    }
  }
}

/**
 * Update historical data table
 */
function updateHistoryTable(historyData) {
  historyTableBody.innerHTML = "";

  if (historyData.length === 0) {
    historyTableBody.innerHTML =
      '<tr><td colspan="4" class="no-data-cell">No historical data available</td></tr>';
    return;
  }

  // Reverse to show newest first
  const reversedData = [...historyData].reverse();

  reversedData.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.className = "history-row";

    const timestamp = new Date(entry.timestamp);
    const formattedTime = timestamp.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Color coding for SOC
    let socClass = "normal";
    if (entry.soc <= 20) socClass = "critical";
    else if (entry.soc <= 50) socClass = "warning";
    else socClass = "good";

    // Color coding for SOH
    let sohClass = "normal";
    if (entry.soh <= 60) sohClass = "critical";
    else if (entry.soh <= 75) sohClass = "warning";
    else sohClass = "good";

    row.innerHTML = `
      <td class="row-number">${index + 1}</td>
      <td class="timestamp-cell">${formattedTime}</td>
      <td class="value-cell ${socClass}">${entry.soc.toFixed(1)}%</td>
      <td class="value-cell ${sohClass}">${entry.soh.toFixed(1)}%</td>
    `;

    historyTableBody.appendChild(row);
  });

  console.log("📊 History table updated with", reversedData.length, "entries");
}

/**
 * Check for warning conditions
 */
function checkWarnings(data) {
  const warnings = [];
  let criticalWarnings = [];

  // Temperature warnings
  if (data.temperature >= THRESHOLDS.temperature.critical) {
    const warning = {
      level: "critical",
      icon: "🔥",
      message: `Critical Temperature: ${data.temperature.toFixed(
        1
      )}°C - Immediate cooling required!`,
    };
    warnings.push(warning);
    criticalWarnings.push(warning.message);
  } else if (data.temperature >= THRESHOLDS.temperature.warning) {
    warnings.push({
      level: "warning",
      icon: "🌡️",
      message: `High Temperature: ${data.temperature.toFixed(
        1
      )}°C - Monitor closely`,
    });
  } else if (data.temperature <= THRESHOLDS.temperature.low) {
    warnings.push({
      level: "warning",
      icon: "❄️",
      message: `Low Temperature: ${data.temperature.toFixed(
        1
      )}°C - Performance may be reduced`,
    });
  }

  // Voltage warnings (3.7V Li-ion specific)
  if (data.voltage <= THRESHOLDS.voltage.critical_low) {
    const warning = {
      level: "critical",
      icon: "⚡",
      message: `Critical Low Voltage: ${data.voltage.toFixed(
        2
      )}V - Battery damage risk!`,
    };
    warnings.push(warning);
    criticalWarnings.push(warning.message);
  } else if (data.voltage <= THRESHOLDS.voltage.warning_low) {
    warnings.push({
      level: "warning",
      icon: "⚡",
      message: `Low Voltage: ${data.voltage.toFixed(2)}V - Charge soon`,
    });
  } else if (data.voltage >= THRESHOLDS.voltage.critical_high) {
    const warning = {
      level: "critical",
      icon: "⚡",
      message: `Critical High Voltage: ${data.voltage.toFixed(
        2
      )}V - Stop charging immediately!`,
    };
    warnings.push(warning);
    criticalWarnings.push(warning.message);
  } else if (data.voltage >= THRESHOLDS.voltage.warning_high) {
    warnings.push({
      level: "warning",
      icon: "⚡",
      message: `High Voltage: ${data.voltage.toFixed(2)}V - Fully charged`,
    });
  }

  // SOC warnings
  if (data.soc <= THRESHOLDS.soc.critical) {
    const warning = {
      level: "critical",
      icon: "🔋",
      message: `Critical Battery Level: ${data.soc.toFixed(
        1
      )}% - Charge immediately!`,
    };
    warnings.push(warning);
    criticalWarnings.push(warning.message);
  } else if (data.soc <= THRESHOLDS.soc.warning) {
    warnings.push({
      level: "warning",
      icon: "🔋",
      message: `Low Battery: ${data.soc.toFixed(1)}% - Charge soon`,
    });
  }

  // SOH warnings
  if (data.soh <= THRESHOLDS.soh.critical) {
    const warning = {
      level: "critical",
      icon: "💔",
      message: `Critical Battery Health: ${data.soh.toFixed(
        1
      )}% - Battery replacement needed!`,
    };
    warnings.push(warning);
    criticalWarnings.push(warning.message);
  } else if (data.soh <= THRESHOLDS.soh.warning) {
    warnings.push({
      level: "warning",
      icon: "💚",
      message: `Degraded Battery Health: ${data.soh.toFixed(
        1
      )}% - Consider replacement soon`,
    });
  }

  // Current warnings
  if (
    Math.abs(data.current) >= THRESHOLDS.current.warning_high &&
    data.chargingStatus === 0
  ) {
    warnings.push({
      level: "warning",
      icon: "⚡",
      message: `High Discharge Rate: ${Math.abs(data.current).toFixed(
        2
      )}mA - Reduce load`,
    });
  }

  // Range warnings
  if (data.estimatedRange <= 2 && data.chargingStatus === 0) {
    const warning = {
      level: "critical",
      icon: "🛑",
      message: `Critical Range: ${data.estimatedRange}km - Find charging station now!`,
    };
    warnings.push(warning);
    criticalWarnings.push(warning.message);
  } else if (data.estimatedRange <= 5 && data.chargingStatus === 0) {
    warnings.push({
      level: "warning",
      icon: "🔍",
      message: `Low Range: ${data.estimatedRange}km - Plan charging stop`,
    });
  }

  // Display warnings
  displayWarnings(warnings);

  // Show critical alert banner
  displayCriticalAlert(criticalWarnings);
}

/**
 * Display warnings in the warnings section
 */
function displayWarnings(warnings) {
  warningsList.innerHTML = "";

  if (warnings.length === 0) {
    warningsList.innerHTML = `
      <div class="warning-item info">
        <span class="warning-item-icon">✅</span>
        <span class="warning-item-text">All systems normal - No warnings detected</span>
      </div>
    `;
    return;
  }

  warnings.forEach((warning) => {
    const warningItem = document.createElement("div");
    warningItem.className = `warning-item ${warning.level}`;
    warningItem.innerHTML = `
      <span class="warning-item-icon">${warning.icon}</span>
      <span class="warning-item-text">${warning.message}</span>
    `;
    warningsList.appendChild(warningItem);
  });
}

/**
 * Display critical alert banner
 */
function displayCriticalAlert(criticalWarnings) {
  if (criticalWarnings.length > 0) {
    alertContent.innerHTML = `
      <div style="display: flex; align-items: center; gap: 20px;">
        <span style="font-size: 3rem; animation: shake 0.5s infinite;">🚨</span>
        <div>
          <div style="font-size: 1.5rem; font-weight: 800; margin-bottom: 10px; color: #ff4757;">CRITICAL ALERT</div>
          ${criticalWarnings
            .map(
              (w) =>
                `<div style="margin: 5px 0; font-size: 1.05rem;">• ${w}</div>`
            )
            .join("")}
        </div>
      </div>
    `;
    alertBanner.classList.add("show");
  } else {
    alertBanner.classList.remove("show");
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const iconMap = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || "ℹ️"}</span>
    <span class="toast-message">${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add("show"), 10);

  // Remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Start auto-refresh
 */
function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  // Fetch data immediately
  fetchBatteryData();
  fetchHistoricalData();

  // Set up interval for battery data
  refreshTimer = setInterval(() => {
    fetchBatteryData();
    fetchHistoricalData();
  }, REFRESH_INTERVAL);

  console.log(
    "🔄 Auto-refresh started: Every",
    REFRESH_INTERVAL / 1000,
    "seconds"
  );
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  startAutoRefresh();
  showToast("🚀 EV Battery Monitor initialized successfully", "success");
});
