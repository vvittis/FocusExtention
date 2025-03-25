 (async () => {
   const { extensionEnabled, blockedDomains, delayTime } = await browser.storage.sync.get([
     "extensionEnabled",
     "blockedDomains",
     "delayTime"
   ]);

   // 1) If extension is off, do nothing
   if (!extensionEnabled) return;

   // 2) Check if the current domain is blocked
   const domain = location.hostname;
   if (!Array.isArray(blockedDomains) || !blockedDomains.includes(domain)) {
     return;
   }

   // Default delay time if not set or invalid
   const delaySec = (typeof delayTime === "number" && delayTime > 0) ? delayTime : 30;

   // 3) Create a full-page overlay
   const overlay = document.createElement("div");
   overlay.style.position = "fixed";
   overlay.style.top = "0";
   overlay.style.left = "0";
   overlay.style.width = "100%";
   overlay.style.height = "100%";
   overlay.style.backgroundColor = "#222";
   overlay.style.color = "#fff";
   overlay.style.zIndex = "999999";
   overlay.style.display = "flex";
   overlay.style.flexDirection = "column";
   overlay.style.alignItems = "center";
   overlay.style.justifyContent = "flex-start";
   overlay.style.textAlign = "center";
   overlay.style.padding = "40px 20px";
   overlay.style.fontFamily = "'Inter', sans-serif";
   overlay.style.fontSize = "1.2rem";
   overlay.style.lineHeight = "1.6";
   document.documentElement.appendChild(overlay);

   // Heading
   const heading = document.createElement("h2");
   heading.textContent = "Take a mindful moment...";
   heading.style.fontSize = "2rem";
   heading.style.marginBottom = "1rem";
   overlay.appendChild(heading);

   // Loading text
   const loadingText = document.createElement("p");
   loadingText.id = "loadingText";
   loadingText.textContent = "Loading xkcd...";
   loadingText.style.fontSize = "1.3rem";
   loadingText.style.marginBottom = "2rem";
   overlay.appendChild(loadingText);

   // 4) Fetch a random xkcd comic via background script
   try {
     const response = await browser.runtime.sendMessage({ action: "fetchXkcd" });

     if (response.success) {
       // Replace "Loading xkcd..." text
       loadingText.textContent = "Here’s a quick mental break from xkcd:";

       const comic = response.comic;

       // Display the comic
       const img = document.createElement("img");
       img.src = comic.img;
       img.style.maxWidth = "90%";
       img.style.maxHeight = "500px";     // NEW
       img.style.objectFit = "contain";   // NEW
       img.style.margin = "1rem 0";
       overlay.appendChild(img);

       // Alt text container
       const altText = document.createElement("p");
       altText.textContent = comic.alt;
       altText.style.maxWidth = "600px";
       altText.style.margin = "1rem auto";
       altText.style.fontSize = "1.3rem";
       altText.style.lineHeight = "1.4";
       altText.style.textAlign = "center"; // NEW
       overlay.appendChild(altText);

     } else {
       console.error("Failed to fetch xkcd:", response.error);
     }

   } catch (err) {
     console.error("Failed to sendMessage to background:", err);
   }

   // 5) Create a container for the flip clock
   const clockContainer = document.createElement("div");
   clockContainer.style.marginTop = "2rem";
   overlay.appendChild(clockContainer);

   // A) Define the "CountdownTracker" for each tile (Minutes/Seconds)
   function CountdownTracker(label, initialValue) {
     const el = document.createElement("span");
     el.className = "flip-clock__piece";
     el.innerHTML = `
       <b class="flip-clock__card card">
         <b class="card__top" data-value=""></b>
         <b class="card__bottom" data-value=""></b>
         <b class="card__back">
           <b class="card__bottom" data-value=""></b>
         </b>
       </b>
       <span class="flip-clock__slot">${label}</span>
     `;
     this.el = el;

     const top = el.querySelector(".card__top");
     const bottom = el.querySelector(".card__bottom");
     const back = el.querySelector(".card__back");
     const backBottom = el.querySelector(".card__back .card__bottom");

     this.currentValue = null;

     this.update = (val) => {
       // always 2 digits
       const valueStr = ("0" + val).slice(-2);
       if (valueStr === this.currentValue) return;

       // old value
       if (this.currentValue !== null) {
         back.setAttribute("data-value", this.currentValue);
         backBottom.setAttribute("data-value", this.currentValue);
         bottom.setAttribute("data-value", this.currentValue);
       }

       this.currentValue = valueStr;
       top.setAttribute("data-value", valueStr);
       bottom.setAttribute("data-value", valueStr);

       // Trigger flip
       el.classList.remove("flip");
       void el.offsetWidth; // force reflow
       el.classList.add("flip");
     };

     this.update(initialValue);
   }

   // B) Define the main flip clock function
   function FlipClock(totalSeconds, onComplete) {
     onComplete = onComplete || function(){};

     // Outer container
     const clockEl = document.createElement("div");
     clockEl.className = "flip-clock";
     clockEl.style.display = "inline-block";
     clockEl.style.textAlign = "center";
     clockEl.style.perspective = "600px"; // for deeper 3D effect

     // Create two trackers: Minutes & Seconds
     const minutesTracker = new CountdownTracker("Minutes", 0);
     const secondsTracker = new CountdownTracker("Seconds", 0);

     clockEl.appendChild(minutesTracker.el);
     clockEl.appendChild(secondsTracker.el);

     let remaining = totalSeconds;

     function updateTiles() {
       const mins = Math.floor(remaining / 60);
       const secs = remaining % 60;
       minutesTracker.update(mins);
       secondsTracker.update(secs);
     }

     updateTiles();

     // Start countdown
     const interval = setInterval(() => {
       remaining--;
       if (remaining < 0) {
         clearInterval(interval);
         onComplete();
         return;
       }
       updateTiles();
     }, 1000);

     return clockEl;
   }

   // C) Insert the flip clock for 'delaySec'
   const flipClockEl = new FlipClock(delaySec, () => {
     // Once time is up, remove overlay
     overlay.remove();
   });
   clockContainer.appendChild(flipClockEl);

   // D) Insert the flip clock CSS (inline for convenience)
   const styleEl = document.createElement("style");
   styleEl.textContent = `
     .flip-clock {
       text-align: center;
       perspective: 600px;
     }
     .flip-clock__piece {
       display: inline-block;
       margin: 0 10px;
       position: relative;
     }
     .flip-clock__slot {
       display: block;
       text-transform: uppercase;
       text-align: center;
       margin-top: 0.3rem;
       font-size: 1rem;
       font-weight: 600;
       color: #aaa;
     }
     .card {
       position: relative;
       font-size: 3rem; /* Adjust tile size here */
       line-height: 1;
       color: #fff;
     }
     .card__top,
     .card__bottom,
     .card__back::before,
     .card__back .card__bottom {
       display: block;
       height: 1.2em;
       overflow: hidden;
       background: #333;
       border-radius: 0.1em;
       transform-style: preserve-3d;
     }
     .card__top {
       border-bottom: 1px solid #333;
     }
     .card__bottom {
       position: absolute;
       top: 1.2em;
       width: 100%;
       background: #444;
       border-radius: 0 0 0.1em 0.1em;
     }
     .card__top::after,
     .card__bottom::after,
     .card__back::before,
     .card__back .card__bottom::after {
       content: attr(data-value);
       display: block;
       position: absolute;
       top: 0; left: 0;
       width: 100%; height: 100%;
       text-align: center;
     }
     .card__back {
       position: absolute;
       top: 0;
       left: 0;
       transform-origin: center bottom;
       width: 100%;
       height: 100%;
       pointer-events: none;
     }
     .card__back .card__bottom {
       background: #444;
     }
     .flip .card__back {
       animation: flipTop 0.3s forwards ease-in;
     }
     .flip .card__back .card__bottom {
       animation: flipBottom 0.3s forwards ease-in;
     }
     @keyframes flipTop {
       0% { transform: rotateX(0deg); }
       100% { transform: rotateX(-90deg); }
     }
     @keyframes flipBottom {
       0% { transform: rotateX(90deg); }
       100% { transform: rotateX(0deg); }
     }
   `;
   document.head.appendChild(styleEl);
 })();
