// popup.js
document.addEventListener("DOMContentLoaded", async () => {
  const extensionToggle = document.getElementById("extensionToggle");
  const currentDomainCheckbox = document.getElementById("currentDomainCheckbox");
  const currentDomainLabel = document.getElementById("currentDomainLabel");
  const delayInput = document.getElementById("delayInput");
  const domainListEl = document.getElementById("domainList");

  // 1) Load existing settings from storage
  let { extensionEnabled, blockedDomains, delayTime } = await browser.storage.sync.get([
    "extensionEnabled", "blockedDomains", "delayTime"
  ]);

  if (!Array.isArray(blockedDomains)) {
    blockedDomains = [];
  }

  // 2) Set up the "Enable Extension" checkbox
  extensionToggle.checked = !!extensionEnabled;

  // FIXED: addEventListener
  extensionToggle.addEventListener("change", async () => {
    extensionEnabled = extensionToggle.checked;
    await browser.storage.sync.set({ extensionEnabled });
  });

  // 3) Get the current domain
  let [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  let currentDomain = "unknown";
  if (tab && tab.url) {
    try {
      let urlObj = new URL(tab.url);
      currentDomain = urlObj.hostname;
    } catch (e) {
      console.warn("Could not parse tab URL:", tab.url);
    }
  }
  currentDomainLabel.textContent = currentDomain;

  // 4) Check if current domain is in blockedDomains
  currentDomainCheckbox.checked = blockedDomains.includes(currentDomain);

  // Toggle current domain in blockedDomains when checkbox changes
  currentDomainCheckbox.addEventListener("change", async () => {
    if (currentDomainCheckbox.checked) {
      if (!blockedDomains.includes(currentDomain)) {
        blockedDomains.push(currentDomain);
      }
    } else {
      blockedDomains = blockedDomains.filter(d => d !== currentDomain);
    }
    await browser.storage.sync.set({ blockedDomains });
    refreshDomainList();
  });

  // 5) Set the delay input
  if (typeof delayTime === "number" && delayTime > 0) {
    delayInput.value = delayTime;
  }

  delayInput.addEventListener("change", async () => {
    const val = parseInt(delayInput.value, 10);
    if (val > 0) {
      delayTime = val;
      await browser.storage.sync.set({ delayTime });
    }
  });

  // 6) Show all blocked domains in the list
  function refreshDomainList() {
    domainListEl.innerHTML = "";
    blockedDomains.forEach(domain => {
      const row = document.createElement("div");
      row.className = "domain-row";

      const span = document.createElement("span");
      span.textContent = domain;

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", async () => {
        blockedDomains = blockedDomains.filter(d => d !== domain);
        await browser.storage.sync.set({ blockedDomains });
        refreshDomainList();
        // Also uncheck the current domain box if removed
        if (domain === currentDomain) {
          currentDomainCheckbox.checked = false;
        }
      });

      row.appendChild(span);
      row.appendChild(removeBtn);
      domainListEl.appendChild(row);
    });
  }

  // Initial populate
  refreshDomainList();
});
