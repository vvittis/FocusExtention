// background.js

// A helper function to fetch with a 2-second timeout
function fetchWithTimeout(url, timeout = 2000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(id));
}

// Fetch a URL as a Blob, then convert it to a base64 Data URI
async function fetchImageAsBase64(url, attempt = 1) {
  try {
    const res = await fetchWithTimeout(url, 2000);
    const blob = await res.blob();

    // Convert Blob -> base64
    const reader = new FileReader();
    return await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result); // data:...base64
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  } catch (err) {
    if (attempt < 3) {
      console.warn(`Image fetch attempt #${attempt} failed, retrying...`, err);
      return fetchImageAsBase64(url, attempt + 1);
    } else {
      throw err;
    }
  }
}

// Recursively tries up to 3 times to fetch random xkcd comic JSON
async function fetchXkcdComicJson(attempt = 1) {
  try {
    // 1) Get the latest comic
    const resLatest = await fetchWithTimeout("https://xkcd.com/info.0.json", 2000);
    const latest = await resLatest.json();
    const maxNum = latest.num;

    // 2) Pick a random comic
    const randomNum = Math.floor(Math.random() * maxNum) + 1;
    const resComic = await fetchWithTimeout(`https://xkcd.com/${randomNum}/info.0.json`, 2000);
    const comic = await resComic.json();
    return comic;

  } catch (err) {
    if (attempt < 3) {
      console.warn(`xkcd fetch attempt #${attempt} failed, retrying...`, err);
      return fetchXkcdComicJson(attempt + 1);
    } else {
      throw err;
    }
  }
}

// Listen for requests from content.js
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchXkcd") {
    (async () => {
      try {
        // 1) Fetch random xkcd comic JSON
        const comic = await fetchXkcdComicJson();
        if (!comic) throw new Error("No comic data found.");

        // 2) Convert the comic.img to base64
        const base64img = await fetchImageAsBase64(comic.img);
        // Return the JSON plus the base64 data
        sendResponse({
          success: true,
          comic: {
            ...comic,
            base64img // embed the data URI
          }
        });

      } catch (err) {
        console.error("Failed to fetch xkcd after 3 attempts:", err);
        sendResponse({ success: false, error: err.toString() });
      }
    })();

    // Must return true to keep the message channel open for async sendResponse
    return true;
  }
});
