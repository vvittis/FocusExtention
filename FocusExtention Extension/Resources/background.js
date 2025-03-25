// background.js
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchXkcd") {
    // 1) Get the latest comic number
    fetch("https://xkcd.com/info.0.json")
      .then((r) => r.json())
      .then((latest) => {
        const maxNum = latest.num;
        // 2) Fetch a random comic
        const randomNum = Math.floor(Math.random() * maxNum) + 1;
        return fetch(`https://xkcd.com/${randomNum}/info.0.json`);
      })
      .then((r) => r.json())
      .then((comic) => {
        sendResponse({ success: true, comic });
      })
      .catch((err) => {
        console.error("Failed to fetch xkcd:", err);
        sendResponse({ success: false, error: err.toString() });
      });

    // Must return true to keep the message channel open for async sendResponse
    return true;
  }
});
