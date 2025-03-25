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

   // -- SHADOW DOM SETUP --
   const container = document.createElement("div");
   const shadowRoot = container.attachShadow({ mode: "open" });
   document.documentElement.appendChild(container);

   // 3) Create a full-page overlay in the shadow root
   const overlay = document.createElement("div");
   Object.assign(overlay.style, {
     position: "fixed",
     top: "0",
     left: "0",
     width: "100%",
     height: "100%",
     backgroundColor: "#222",
     color: "#fff",
     zIndex: "999999",
     display: "flex",
     flexDirection: "column",
     alignItems: "center",
     justifyContent: "flex-start",
     textAlign: "center",
     padding: "40px 20px",
     fontFamily: "'Inter', sans-serif",
     fontSize: "1.2rem",
     lineHeight: "1.6"
   });
   shadowRoot.appendChild(overlay);

   // Motivational heading
   const heading = document.createElement("h2");
   heading.textContent = "Pause. Breathe. Recenter.";
   heading.style.fontSize = "2rem";
   heading.style.marginBottom = "1rem";
   overlay.appendChild(heading);

   // Supportive message
   const subHeading = document.createElement("p");
   subHeading.textContent = "We know the urge is strong. Let's take a mindful moment before diving into social media.";
   subHeading.style.fontSize = "1.1rem";
   subHeading.style.marginBottom = "2rem";
   subHeading.style.maxWidth = "700px";
   overlay.appendChild(subHeading);

   // Loading text
   const loadingText = document.createElement("p");
   loadingText.id = "loadingText";
   loadingText.textContent = "Loading xkcd...";
   loadingText.style.fontSize = "1.3rem";
   loadingText.style.marginBottom = "2rem";
   overlay.appendChild(loadingText);

   // 4) Request the random xkcd from background.js
   let xkcdImg;
   try {
     const response = await browser.runtime.sendMessage({ action: "fetchXkcd" });
     if (response.success) {
       loadingText.textContent = "Here’s a quick mental break from xkcd:";

       const { comic } = response;
       // comic.base64img is the data URI

       // Display the comic as a base64 data URI
       xkcdImg = document.createElement("img");
       xkcdImg.src = comic.base64img;
       xkcdImg.style.maxWidth = "90%";
       xkcdImg.style.maxHeight = "500px";
       xkcdImg.style.objectFit = "contain";
       xkcdImg.style.margin = "1rem 0";
       overlay.appendChild(xkcdImg);

       // Alt text container
       const altText = document.createElement("p");
       altText.textContent = comic.alt;
       altText.style.maxWidth = "600px";
       altText.style.margin = "1rem auto";
       altText.style.fontSize = "1.3rem";
       altText.style.lineHeight = "1.4";
       altText.style.textAlign = "center";
       overlay.appendChild(altText);

     } else {
       console.error("Failed to fetch xkcd:", response.error);
       loadingText.textContent = "Failed to fetch xkcd comic.";
     }

   } catch (err) {
     console.error("Failed to sendMessage to background:", err);
     loadingText.textContent = "Failed to load comic.";
   }

   // 5) Container for the flip clock
   const clockContainer = document.createElement("div");
   clockContainer.style.marginTop = "2rem";
   overlay.appendChild(clockContainer);

   // A) "CountdownTracker" for each tile (Minutes/Seconds)
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

   // B) Flip clock function
   function FlipClock(totalSeconds, onComplete) {
     onComplete = onComplete || function(){};

     const clockEl = document.createElement("div");
     clockEl.className = "flip-clock";
     Object.assign(clockEl.style, {
       display: "inline-block",
       textAlign: "center",
       perspective: "600px"
     });

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

   // Insert the flip clock
   const flipClockEl = new FlipClock(delaySec, () => {
     container.remove();
   });
   clockContainer.appendChild(flipClockEl);

   // "Proceed" button to bypass the timer
   const proceedBtn = document.createElement("button");
   proceedBtn.textContent = "Proceed";
   Object.assign(proceedBtn.style, {
     marginTop: "20px",
     padding: "10px 20px",
     fontSize: "1rem",
     cursor: "pointer"
   });
   proceedBtn.addEventListener("click", () => {
     container.remove();
   });
   overlay.appendChild(proceedBtn);

   // E) Magnifier with zoom = 2
   function magnify(img, zoom) {
     if (!img) return;

     if (!img.complete) {
       img.addEventListener("load", () => magnify(img, zoom), { once: true });
       return;
     }

     const glass = document.createElement("div");
     glass.setAttribute("class", "img-magnifier-glass");
     overlay.appendChild(glass);

     glass.style.backgroundImage = `url('${img.src}')`;
     glass.style.backgroundRepeat = "no-repeat";

     const fullWidth = img.naturalWidth;
     const fullHeight = img.naturalHeight;
     glass.style.backgroundSize = (fullWidth * zoom) + "px " + (fullHeight * zoom) + "px";

     let bw = 3;
     let w = 0, h = 0;

     requestAnimationFrame(() => {
       w = glass.offsetWidth / 2;
       h = glass.offsetHeight / 2;
     });

     glass.addEventListener("mousemove", moveMagnifier);
     img.addEventListener("mousemove", moveMagnifier);
     glass.addEventListener("touchmove", moveMagnifier);
     img.addEventListener("touchmove", moveMagnifier);

     function moveMagnifier(e) {
       e.preventDefault();
       const pos = getCursorPos(e);
       let x = pos.x;
       let y = pos.y;

       const fw = fullWidth / (img.width || 1);
       const fh = fullHeight / (img.height || 1);

       if (x > img.width - (w / zoom)) { x = img.width - (w / zoom); }
       if (x < w / zoom) { x = w / zoom; }
       if (y > img.height - (h / zoom)) { y = img.height - (h / zoom); }
       if (y < h / zoom) { y = h / zoom; }

       const rect = img.getBoundingClientRect();
       const offsetLeft = rect.left + window.scrollX;
       const offsetTop = rect.top + window.scrollY;

       glass.style.position = "absolute";
       glass.style.left = (offsetLeft + x - w) + "px";
       glass.style.top = (offsetTop + y - h) + "px";

       const bgX = (x * fw * zoom) - w + bw;
       const bgY = (y * fh * zoom) - h + bw;
       glass.style.backgroundPosition = `-${bgX}px -${bgY}px`;
     }

     function getCursorPos(e) {
       e = e || window.event;
       const rect = img.getBoundingClientRect();
       let x = e.pageX - rect.left - window.scrollX;
       let y = e.pageY - rect.top - window.scrollY;
       return { x, y };
     }
   }

   // Magnify with factor = 2
   magnify(xkcdImg, 2);

   // F) Shadow root CSS
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
       font-size: 3rem;
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

     /* Magnifier glass styling */
     .img-magnifier-glass {
       border: 3px solid #000;
       border-radius: 50%;
       cursor: none;
       width: 200px;
       height: 200px;
       pointer-events: none;
       z-index: 10000;
       background-repeat: no-repeat;
     }
   `;
   shadowRoot.appendChild(styleEl);
 })();
