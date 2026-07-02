const API_BASE_URL = "http://localhost:8000";

// 1. Notification Poller Logic
async function pollNotifications() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/monitor/notifications`);
    if (!response.ok) {
      console.warn("Notification poll server response was not ok:", response.status);
      return;
    }

    const notifications = await response.json();
    if (notifications && notifications.length > 0) {
      console.log(`Retrieved ${notifications.length} new notifications.`);
      for (const notif of notifications) {
        showChromeNotification(notif);
      }
    }
  } catch (err) {
    // Silently ignore network failures (server offline)
    console.debug("Failed to poll notifications:", err.message);
  }
}

// 2. Display Native OS Notification
function showChromeNotification(notif) {
  const notificationId = `dom_notif_${notif.id || Date.now()}`;
  
  // Format details text
  const title = notif.monitor_name || "DOM Change Detected";
  const message = `${notif.page_title}\n\n${notif.old_value} \u2192 ${notif.new_value}\nDifference: ${notif.difference}\nTime: ${notif.timestamp}`;

  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: title,
    message: message,
    priority: 2,
    requireInteraction: true
  }, (id) => {
    if (chrome.runtime.lastError) {
      console.error("Chrome notifications error:", chrome.runtime.lastError.message);
    } else {
      console.log("OS alert created successfully with id:", id);
    }
  });
}

// 3. Waking Scheduler hooks for Manifest V3
chrome.runtime.onInstalled.addListener(() => {
  console.log("DOM Monitor Extension installed.");
  
  // Create alarm to poll notifications. Alarms are highly reliable in Manifest V3
  chrome.alarms.create("poll_alarm", { periodInMinutes: 1 });
  
  // Perform immediate initial check
  pollNotifications();
});

// Alarm Listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll_alarm") {
    pollNotifications();
  }
});

// Service workers can go inactive. To make the MVP highly responsive (every 15s), 
// we will also use a setInterval loop while the worker is active.
let pollInterval = setInterval(pollNotifications, 15000);

// Re-establish interval if service worker wakes up via other events
chrome.runtime.onStartup.addListener(() => {
  if (!pollInterval) {
    pollInterval = setInterval(pollNotifications, 15000);
  }
  pollNotifications();
});
