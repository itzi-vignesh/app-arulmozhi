const API_BASE_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", async () => {
  const selectedSelectorEl = document.getElementById("selected-selector");
  const selectedValueEl = document.getElementById("selected-value");
  const selectedTypeEl = document.getElementById("selected-type");
  const monitorNameInput = document.getElementById("monitor-name");
  const btnSelect = document.getElementById("btn-select");
  const btnCreate = document.getElementById("btn-create");
  const statusBadge = document.getElementById("status-badge");
  const statusTextVal = document.getElementById("status-text-val");
  const errorMessage = document.getElementById("error-message");
  const monitorIntervalInput = document.getElementById("monitor-interval");
  const intervalErrorMessage = document.getElementById("interval-error-message");

  let currentTab = null;
  let activeSelection = null;

  // 1. Get the current active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      currentTab = tabs[0];
    }
  } catch (err) {
    console.error("Failed to query current tab:", err);
  }

  if (!currentTab) {
    statusTextVal.textContent = "Error: Tab context missing";
    btnSelect.disabled = true;
    return;
  }

  // 2. Read stored selection if it exists for this tab url
  const cleanUrl = currentTab.url.split('#')[0].split('?')[0];
  const storageKey = "selection_" + cleanUrl;
  chrome.storage.local.get([storageKey], (result) => {
    const data = result[storageKey];
    if (data) {
      activeSelection = data;
      
      // Update UI fields
      selectedSelectorEl.textContent = data.selector;
      selectedSelectorEl.classList.remove("none");
      
      const displayVal = data.monitor_type === "image" ? data.image_url : (data.text_snapshot || data.value || "");
      selectedValueEl.textContent = (displayVal || "").substring(0, 100) || "(Empty)";
      selectedValueEl.classList.remove("none");

      if (selectedTypeEl) {
        selectedTypeEl.textContent = (data.monitor_type || "text").toUpperCase();
      }

      // Set default monitor name from page title or tag
      monitorNameInput.value = data.name || `${data.tag} on ${new URL(currentTab.url).hostname}`;
      monitorNameInput.disabled = false;
      
      // Set default check interval from storage
      monitorIntervalInput.value = data.check_interval || 60;
      monitorIntervalInput.disabled = false;
      
      btnCreate.disabled = false;
      
      // Update status badge
      statusBadge.className = "status-badge";
      statusTextVal.textContent = "Element Selected";
    }
  });

  // 3. Select Element Click Handler
  btnSelect.addEventListener("click", () => {
    // Send message to content script on active tab to start picker overlay
    chrome.tabs.sendMessage(currentTab.id, { action: "start-selection" }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script might not be loaded (e.g. chrome:// or file:// or extension store)
        console.error("Could not inject script: ", chrome.runtime.lastError.message);
        alert("Cannot monitor this page type. Try refreshing or testing on http/https pages.");
      } else {
        // Close the popup so user can perform element selection
        window.close();
      }
    });
  });

  // 4. Create Monitor Click Handler
  btnCreate.addEventListener("click", async () => {
    const monitorName = monitorNameInput.value.trim();
    if (!monitorName) {
      errorMessage.style.display = "block";
      return;
    }
    errorMessage.style.display = "none";

    // Validate interval
    const rawInterval = monitorIntervalInput.value.trim();
    let checkInterval = parseInt(rawInterval, 10);
    if (isNaN(checkInterval) || checkInterval <= 0) {
      checkInterval = 60;
      monitorIntervalInput.value = 60;
      intervalErrorMessage.textContent = "Invalid interval. Fallback to 60 seconds.";
      intervalErrorMessage.style.display = "block";
      return;
    } else if (checkInterval < 10) {
      checkInterval = 10;
      monitorIntervalInput.value = 10;
      intervalErrorMessage.textContent = "Minimum allowed: 10 seconds";
      intervalErrorMessage.style.display = "block";
      return;
    } else if (checkInterval > 86400) {
      checkInterval = 86400;
      monitorIntervalInput.value = 86400;
      intervalErrorMessage.textContent = "Maximum allowed: 86400 seconds (24 hours)";
      intervalErrorMessage.style.display = "block";
      return;
    }
    intervalErrorMessage.style.display = "none";

    console.log("[CHECK INTERVAL]", checkInterval);

    if (!activeSelection) return;

    // Verify interaction_steps exists on activeSelection
    console.log("activeSelection.interaction_steps exists:", activeSelection.hasOwnProperty("interaction_steps"), activeSelection.interaction_steps);

    btnCreate.disabled = true;
    btnCreate.textContent = "Creating...";

    const payload = {
      name: monitorName,
      url: currentTab.url,
      page_title: activeSelection.page_title || activeSelection.pageTitle || currentTab.title,
      selector: activeSelection.selector,
      tag: activeSelection.tag,
      initial_value: activeSelection.monitor_type === "image" ? activeSelection.image_url : (activeSelection.text_snapshot || activeSelection.value || ""),
      text_snapshot: activeSelection.monitor_type === "image" ? activeSelection.image_url : (activeSelection.text_snapshot || activeSelection.value || ""),
      selector_confidence: activeSelection.selector_confidence || "LOW",
      interaction_steps: activeSelection.interaction_steps || [],
      monitor_mode: "server",
      check_interval: checkInterval,
      monitor_type: activeSelection.monitor_type || "text",
      image_url: activeSelection.image_url || null
    };

    const API_URL = API_BASE_URL;
    console.log("[REGISTER URL]", API_URL);
    console.log("[REGISTER PAYLOAD]", payload);

    try {
      const response = await fetch(`${API_BASE_URL}/api/monitor/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const resData = await response.json();
      console.log("Monitor registered successfully:", resData);

      // Clear the local selection cache
      chrome.storage.local.remove([storageKey], () => {
        // Show success indicators
        statusBadge.className = "status-badge";
        statusTextVal.textContent = "Created!";
        
        btnCreate.textContent = "Created Success!";
        setTimeout(() => {
          window.close();
        }, 1200);
      });

    } catch (err) {
      console.error("Error registering monitor:", err);
      btnCreate.disabled = false;
      btnCreate.textContent = "Create Monitor";
      alert("Failed to register monitor. Make sure the FastAPI server is running on localhost:8000!");
    }
  });
});
