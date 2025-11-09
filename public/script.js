// DOM Elements
const batteryLiquid = document.getElementById("batteryLiquid");
const batteryPercentage = document.getElementById("batteryPercentage");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const chargeStatus = document.getElementById("chargeStatus");
const voltageEl = document.getElementById("voltage");
const currentEl = document.getElementById("current");
const temperatureEl = document.getElementById("temperature");
const socEl = document.getElementById("soc");
const sohEl = document.getElementById("soh");
const rangeEl = document.getElementById("range");
const lastUpdateEl = document.getElementById("lastUpdate");
const motorOnBtn = document.getElementById("motorOnBtn");
const motorOffBtn = document.getElementById("motorOffBtn");
const toastContainer = document.getElementById("toastContainer");
const alertBanner = document.getElementById("alertBanner");
const alertContent = document.getElementById("alertContent");
const warningsList = document.getElementById("warningsList");
const connectionStatus = document.getElementById("connectionStatus");

// Progress bars
const voltageBar = document.getElementById("voltageBar");
const currentBar = document.getElementById("currentBar");
const tempBar = document.getElementById("tempBar");
const socBar = document.getElementById("socBar");
const sohBar = document.getElementById("sohBar");
const rangeBar = document.getElementById("rangeBar");

// Auto-refresh interval (15 seconds)
const REFRESH_INTERVAL = 15000;
let refreshTimer = null;

// Warning thresholds (easily customizable)
const THRESHOLDS = {
  temperature: {
    critical: 50, // °C
    warning: 45,
    low: 0,
  },
  voltage: {
    critical_low: 10, // V
    warning_low: 15,
    critical_high: 60,
    warning_high: 55,
  },
  soc: {
    critical: 10, // %
    warning: 20,
  },
  soh: {
    critical: 60, // %
    warning: 75,
  },
  current: {
    warning_high: 100, // mA
  },
};

/**
 * Fetch battery data from the API
 */
async function fetchBatteryData() {
  try {
    const response = await fetch("/api/data");
    const result = await response.json();

    if (result.success && result.data) {
      updateUI(result.data);
      updateConnectionStatus(true);
    } else {
      showToast("⚠️ No data available from ThingSpeak", "warning");
      updateConnectionStatus(false);
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    showToast("❌ Failed to fetch battery data", "error");
    updateConnectionStatus(false);
  }
}

/**
 * Update UI with battery data
 */
function updateUI(data) {
  // Update voltage
  voltageEl.textContent = data.voltage.toFixed(2);
  updateProgressBar(voltageBar, data.voltage, 0, 60);

  // Update current (in mA)
  currentEl.textContent = data.current.toFixed(2);
  updateProgressBar(currentBar, Math.abs(data.current), 0, 150);

  // Update temperature
  temperatureEl.textContent = data.temperature.toFixed(1);
  updateProgressBar(tempBar, data.temperature, 0, 60);

  // Update SOC
  socEl.textContent = data.soc.toFixed(1);
  updateProgressBar(socBar, data.soc, 0, 100);

  // Update SOH
  sohEl.textContent = data.soh.toFixed(1);
  updateProgressBar(sohBar, data.soh, 0, 100);

  // Update estimated range
  rangeEl.textContent = data.estimatedRange;
  updateProgressBar(rangeBar, parseFloat(data.estimatedRange), 0, 100);

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

  // Voltage warnings
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
      message: `High Voltage: ${data.voltage.toFixed(2)}V - Nearly full`,
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
  if (data.estimatedRange <= 10 && data.chargingStatus === 0) {
    const warning = {
      level: "critical",
      icon: "🛑",
      message: `Critical Range: ${data.estimatedRange}km - Find charging station now!`,
    };
    warnings.push(warning);
    criticalWarnings.push(warning.message);
  } else if (data.estimatedRange <= 20 && data.chargingStatus === 0) {
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
 * Send motor mode command to ThingSpeak
 */
async function sendMotorMode(mode) {
  try {
    motorOnBtn.disabled = true;
    motorOffBtn.disabled = true;

    const response = await fetch("/api/mode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode }),
    });

    const result = await response.json();

    if (result.success) {
      showToast(`✅ ${result.message}`, "success");
    } else {
      showToast(`❌ ${result.message}`, "error");
    }
  } catch (error) {
    console.error("Error sending motor mode:", error);
    showToast("❌ Failed to send motor command", "error");
  } finally {
    motorOnBtn.disabled = false;
    motorOffBtn.disabled = false;
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

  fetchBatteryData();
  refreshTimer = setInterval(fetchBatteryData, REFRESH_INTERVAL);
}

// Event Listeners
motorOnBtn.addEventListener("click", () => sendMotorMode(0));
motorOffBtn.addEventListener("click", () => sendMotorMode(1));

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  startAutoRefresh();
  showToast("🚀 EV Battery Monitor initialized successfully", "success");
});
