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

   // 3) Full-page overlay
   const overlay = document.createElement("div");
   Object.assign(overlay.style, {
     position: "fixed",
     top: "0",
     left: "0",
     width: "100%",
     height: "100%",
     backgroundColor: "#222",    // Dark background
     color: "#f5f0e6",           // Beige text
     zIndex: "999999",
     display: "flex",
     flexDirection: "column",
     alignItems: "center",
     justifyContent: "flex-start",
     textAlign: "center",
     padding: "40px 20px",
     fontFamily: "'Ubuntu', sans-serif",
     fontSize: "1.2rem",
     lineHeight: "1.6"
   });
   shadowRoot.appendChild(overlay);

   // Import the Ubuntu font
   const linkEl = document.createElement("link");
   linkEl.rel = "stylesheet";
   linkEl.href = "https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap";
   shadowRoot.appendChild(linkEl);

   // 4) "Ph.D." style block, left-aligned
   const phdBlock = document.createElement("div");
   phdBlock.className = "phd-block"; // We'll style this to be left-aligned
   phdBlock.innerHTML = `
     <h1 class="phd-title">Ph.D.</h1>
     <div class="phd-pronounce">[ˌpiː.eɪtʃˈdiː] <strong>noun</strong></div>
     <hr class="phd-line" />
     <p class="phd-definition">
       someone who does precision guesswork based on <em>unreliable data</em> provided by those of questionable knowledge.
     </p>
     <p class="phd-seealso"><em>See also: wizard, magician</em></p>
   `;
   overlay.appendChild(phdBlock);

   // 5) Motivational message
   const motivational = document.createElement("p");
   motivational.textContent = "Remember: A brief pause can refocus your mind and spark new insights. Let’s keep going!";
   motivational.style.fontSize = "1rem";
   motivational.style.maxWidth = "700px";
   motivational.style.marginBottom = "2rem";
   overlay.appendChild(motivational);

   // 6) Loading text for xkcd
   const loadingText = document.createElement("p");
   loadingText.id = "loadingText";
   loadingText.textContent = "Loading xkcd...";
   loadingText.style.fontSize = "1.3rem";
   loadingText.style.marginBottom = "2rem";
   overlay.appendChild(loadingText);

   // 7) Request xkcd comic from background.js
   let xkcdImg;
   try {
     const response = await browser.runtime.sendMessage({ action: "fetchXkcd" });
     if (response.success) {
       loadingText.textContent = "Here’s a quick mental break from xkcd:";

       const { comic } = response;
       // comic.base64img is a data URI

       xkcdImg = document.createElement("img");
       xkcdImg.src = comic.base64img;
       // *** Change #2: Fit 350 px height, keep aspect ratio
       xkcdImg.style.height = "350px";
       xkcdImg.style.width = "auto";
       xkcdImg.style.objectFit = "contain";
       xkcdImg.style.margin = "1rem 0";
       overlay.appendChild(xkcdImg);

       // Alt text
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

   // 8) Flip clock container
   const clockContainer = document.createElement("div");
   clockContainer.style.marginTop = "2rem";
   overlay.appendChild(clockContainer);

   // A) "CountdownTracker"
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
       const valueStr = ("0" + val).slice(-2);
       if (valueStr === this.currentValue) return;

       if (this.currentValue !== null) {
         back.setAttribute("data-value", this.currentValue);
         backBottom.setAttribute("data-value", this.currentValue);
         bottom.setAttribute("data-value", this.currentValue);
       }
       this.currentValue = valueStr;
       top.setAttribute("data-value", valueStr);
       bottom.setAttribute("data-value", valueStr);

       el.classList.remove("flip");
       void el.offsetWidth;
       el.classList.add("flip");
     };

     this.update(initialValue);
   }

   // B) Flip clock
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

   // "Proceed" button
   const proceedBtn = document.createElement("button");
   proceedBtn.textContent = "Proceed";
   Object.assign(proceedBtn.style, {
     marginTop: "20px",
     padding: "10px 20px",
     fontSize: "1rem",
     cursor: "pointer",
     backgroundColor: "#444",
     color: "#f5f0e6",
     border: "none",
     borderRadius: "4px"
   });
   proceedBtn.addEventListener("click", () => {
     container.remove();
   });
   overlay.appendChild(proceedBtn);

   // Magnifier
   function magnify(img, zoom) {
     if (!img) return;
     if (!img.complete) {
       img.addEventListener("load", () => magnify(img, zoom), { once: true });
       return;
     }

     const glass = document.createElement("div");
     glass.className = "img-magnifier-glass";
     overlay.appendChild(glass);

     glass.style.backgroundImage = `url('${img.src}')`;
     glass.style.backgroundRepeat = "no-repeat";

     const fw = img.naturalWidth;
     const fh = img.naturalHeight;
     glass.style.backgroundSize = (fw * zoom) + "px " + (fh * zoom) + "px";

     let bw = 3, w = 0, h = 0;
     requestAnimationFrame(() => {
       w = glass.offsetWidth / 2;
       h = glass.offsetHeight / 2;
     });

     glass.style.display = "none";
     img.addEventListener("mouseenter", () => {
       glass.style.display = "block";
     });
     img.addEventListener("mouseleave", () => {
       glass.style.display = "none";
     });

     img.addEventListener("mousemove", moveMagnifier);
     img.addEventListener("touchmove", moveMagnifier);

     function moveMagnifier(e) {
       e.preventDefault();
       const pos = getCursorPos(e);
       let x = pos.x, y = pos.y;

       const scaleX = fw / img.width;
       const scaleY = fh / img.height;

       if (x > img.width - (w / zoom)) x = img.width - (w / zoom);
       if (x < w / zoom) x = w / zoom;
       if (y > img.height - (h / zoom)) y = img.height - (h / zoom);
       if (y < h / zoom) y = h / zoom;

       const rect = img.getBoundingClientRect();
       const offsetLeft = rect.left + window.scrollX;
       const offsetTop = rect.top + window.scrollY;

       glass.style.position = "absolute";
       glass.style.left = (offsetLeft + x - w) + "px";
       glass.style.top = (offsetTop + y - h) + "px";

       const bgX = (x * scaleX * zoom) - w + bw;
       const bgY = (y * scaleY * zoom) - h + bw;
       glass.style.backgroundPosition = `-${bgX}px -${bgY}px`;
     }

     function getCursorPos(e) {
       e = e || window.event;
       const rect = img.getBoundingClientRect();
       const x = e.pageX - rect.left - window.scrollX;
       const y = e.pageY - rect.top - window.scrollY;
       return { x, y };
     }
   }

   magnify(xkcdImg, 2);

   // 9) Additional CSS
   const styleEl = document.createElement("style");
   styleEl.textContent = `
     /* Left-align the Ph.D. block */
     .phd-block {
       text-align: left;
       max-width: 600px;
       margin: 0 auto 2rem auto; /* center horizontally with left-aligned text */
     }

     .phd-title {
       margin: 0;
       font-size: 2.5rem;
       font-weight: 700;
       line-height: 1.2;
     }
     .phd-pronounce {
       font-size: 1.2rem;
       margin: 0.2rem 0 0.5rem;
     }
     .phd-line {
       width: 80px;
       margin: 0 auto 1rem auto;
       border: none;
       border-top: 1px solid #f5f0e6;
     }
     .phd-definition {
       font-size: 1rem;
       margin: 0.5rem 0;
     }
     .phd-seealso {
       font-size: 0.9rem;
       margin-top: 0.5rem;
       font-style: italic;
     }

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
     .card__back .card__bottom::after {
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
       position: absolute;
       top: 0; left: 0;
       width: 100%; height: 100%;
       text-align: center;
     }
     .card__back {
       position: absolute;
       top: 0; left: 0;
       transform-origin: center bottom;
       width: 100%; height: 100%;
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

     .img-magnifier-glass {
       border: 3px solid #000;
       border-radius: 50%;
       cursor: none;
       width: 200px;
       height: 200px;
       pointer-events: none;
       z-index: 10000;
       background-repeat: no-repeat;
       display: none;
     }
   `;
   shadowRoot.appendChild(styleEl);
 })();
