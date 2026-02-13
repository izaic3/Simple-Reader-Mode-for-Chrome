(() => {
  // If we're already on the reader page, toggle it off
  if (document.body && document.body.dataset.readerMode === "active") {
    window.close();
    return;
  }

  // --------- STEP 1: Extract + clean article content from original page ---------

  function getMainContentNode() {
    // 1. Prefer <article>
    let article = document.querySelector("article");
    if (article) return article.cloneNode(true);

    // 2. Then <main>
    let main = document.querySelector("main");
    if (main) return main.cloneNode(true);

    // 3. Reddit-specific: look for the main content area
    let redditSelectors = [
      "shreddit-post",
      '[data-test-id="post-content"]',
      '[slot="text-body"]',
      "#overlayScrollContainer",
      '[data-adclicklocation="title"]',
      "main"
    ];

    for (let selector of redditSelectors) {
      let redditContent = document.querySelector(selector);
      if (redditContent && redditContent.textContent.trim().length > 100) {
        return redditContent.cloneNode(true);
      }
    }

    // 4. Fallback: collect paragraphs & headings
    const container = document.createElement("div");
    const candidates = document.querySelectorAll("p, h1, h2, h3, h4, h5, h6");

    let textLength = 0;
    candidates.forEach((el) => {
      const text = el.innerText || "";
      if (text.trim().length > 0) {
        textLength += text.length;
        container.appendChild(el.cloneNode(true));
      }
    });

    if (textLength < 200) {
      return document.body.cloneNode(true);
    }

    return container;
  }

  function cleanContentNode(root) {
    if (!root) return root;

    const adSelectors = [
      '[id^="ad-"]',
      '[id$="-ad"]',
      '[id^="ad_"]',
      '[id$="_ad"]',
      '[id*="advert"]',
      '[id*="sponsor"]',
      '[class~="ad"]',
      '[class*="ad-"]',
      '[class*="-ad"]',
      '[class*="advert"]',
      '[class*="sponsor"]',
      "[data-ad]",
      "[data-ad-slot]",
      "[data-ad-client]",
      '[data-testid*="ad"]',
      "iframe",
      "script",
      "style",
      "video",
      "embed",
      "object",
      "nav",
      "header:not(.reader-content header)",
      "footer:not(.reader-content footer)"
    ];

    root.querySelectorAll(adSelectors.join(",")).forEach((el) => el.remove());

    // Remove standalone "ADVERTISEMENT", "Sponsored", etc.
    const textAdCandidates = root.querySelectorAll(
      "p, div, span, h1, h2, h3, h4, h5, h6, section, aside"
    );
    textAdCandidates.forEach((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      const adWords = [
        "advertisement",
        "advertisements",
        "advertising",
        "sponsored",
        "sponsored content",
        "ad"
      ];
      if (adWords.includes(t)) {
        el.remove();
      }
    });

    // Remove empty containers
    const emptyContainers = root.querySelectorAll("figure, div, section, aside");
    emptyContainers.forEach((el) => {
      const hasText = (el.textContent || "").trim().length > 0;
      const hasImages = el.querySelector("img, picture");
      if (!hasText && !hasImages) {
        el.remove();
      }
    });

    return root;
  }

  const contentNode = cleanContentNode(getMainContentNode());

  if (!contentNode || contentNode.textContent.trim().length < 50) {
    alert(
      "Could not extract readable content from this page. The page might still be loading or may not be compatible with reader mode."
    );
    return;
  }

  const articleHTML = contentNode.innerHTML;
  const title = document.title || "Reader Mode";
  const originalUrl = window.location.href;

  // --------- STEP 2: Build the complete reader page HTML ---------

  const pageHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background-color: #f5f5f5;
    color: #111111;
    display: flex;
    flex-direction: column;
  }

  body.reader-theme-light {
    background-color: #f5f5f5;
    color: #111111;
    --reader-muted-text: rgba(0,0,0,0.45);
    --reader-current-word: #111111;
  }
  body.reader-theme-sepia {
    background-color: #f4ecd8;
    color: #3b2f26;
    --reader-muted-text: rgba(59,47,38,0.5);
    --reader-current-word: #3b2f26;
  }
  body.reader-theme-dark {
    background-color: #181a1b;
    color: #e4e4e4;
    --reader-muted-text: rgba(228,228,228,0.45);
    --reader-current-word: #ffffff;
  }

  /* NO-IMAGES MODE */
  body.reader-no-images .reader-content img,
  body.reader-no-images .reader-content figure,
  body.reader-no-images .reader-content picture { display: none !important; }

  .reader-toolbar{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(0,0,0,0.15);
    position: sticky;
    top: 0;
    z-index: 1;
    backdrop-filter: blur(8px);
    flex-wrap: wrap;
  }
  body.reader-theme-dark .reader-toolbar { border-bottom-color: rgba(255,255,255,0.15); }

  .reader-left, .reader-center, .reader-right {
    display:flex;
    align-items:center;
    gap:8px;
    flex-wrap: wrap;
  }
  .reader-center { flex: 1; justify-content: center; }
  .reader-right { justify-content: flex-end; }

  .reader-title { font-weight: 600; font-size: 14px; }

  .reader-btn{
    border:none;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 13px;
    cursor: pointer;
    background: rgba(0,0,0,0.05);
    color: inherit;
    white-space: nowrap;
  }
  body.reader-theme-dark .reader-btn { background: rgba(255,255,255,0.08); }
  .reader-btn:hover { background: rgba(0,0,0,0.12); }
  body.reader-theme-dark .reader-btn:hover { background: rgba(255,255,255,0.18); }

  .reader-btn[aria-pressed="true"]{
    font-weight: 700;
    background: rgba(0,0,0,0.18);
  }
  body.reader-theme-dark .reader-btn[aria-pressed="true"]{ background: rgba(255,255,255,0.22); }

  .reader-wpm-wrap{
    display:inline-flex;
    align-items:center;
    gap:6px;
    font-size: 13px;
    user-select: none;
    white-space: nowrap;
  }
  .reader-wpm-input{
    width: 84px;
    border:none;
    border-radius:999px;
    padding: 4px 10px;
    font-size: 13px;
    background: rgba(0,0,0,0.05);
    color: inherit;
  }
  body.reader-theme-dark .reader-wpm-input{ background: rgba(255,255,255,0.08); }

  .reader-time-est{
    font-size: 13px;
    opacity: 0.8;
    white-space: nowrap;
    padding-left: 2px;
  }

  .reader-content-wrapper { flex: 1; overflow-y: auto; padding: 16px 0 32px; }
  .reader-content{
    max-width: 720px;
    margin: 0 auto;
    padding: 0 16px 32px;
    line-height: 1.6;
    font-size: var(--reader-font-size, 18px);
  }

  .reader-content h1 { font-size: 1.6em; margin-bottom: 0.4em; margin-top: 0.6em; }
  .reader-content h2 { font-size: 1.4em; margin-bottom: 0.4em; margin-top: 0.8em; }
  .reader-content h3 { font-size: 1.2em; margin-bottom: 0.4em; margin-top: 0.8em; }
  .reader-content p  { margin: 0.4em 0 0.6em; }
  .reader-content a  { color: inherit; text-decoration: underline; text-decoration-thickness: 1px; }
  .reader-content img, .reader-content figure { max-width: 100%; height: auto; margin: 12px auto; display: block; }
  .reader-content svg { max-width: 48px; max-height: 48px; height: auto; width: auto; }
  .reader-content ul, .reader-content ol { padding-left: 1.4em; margin: 0.4em 0 0.6em; }
  .reader-content blockquote { border-left: 3px solid currentColor; opacity: 0.85; padding-left: 0.8em; margin-left: 0; }
  .reader-content table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.95em; }
  .reader-content th, .reader-content td { border: 1px solid rgba(0,0,0,0.2); padding: 4px 6px; }
  body.reader-theme-dark .reader-content th, body.reader-theme-dark .reader-content td { border-color: rgba(255,255,255,0.2); }

  /* Speed reading */
  .reader-content.reader-speed-reading-active .reader-speed-word {
    color: var(--reader-muted-text);
    font-weight: 400;
  }
  /* current word is black but NOT bold */
  .reader-content.reader-speed-reading-active .reader-speed-word.reader-speed-current {
    color: var(--reader-current-word);
    font-weight: 400;
  }
</style>
</head>
<body class="reader-theme-light" data-reader-mode="active">
  <div class="reader-toolbar">
    <div class="reader-left">
      <span class="reader-title">Reader Mode</span>
    </div>

    <div class="reader-center">
      <button class="reader-btn reader-theme-btn" data-theme="light">Light</button>
      <button class="reader-btn reader-theme-btn" data-theme="sepia">Sepia</button>
      <button class="reader-btn reader-theme-btn" data-theme="dark">Dark</button>

      <label class="reader-wpm-wrap" title="Words per minute (ArrowUp/ArrowDown adjusts while Speed Read is on)">
        WPM
        <input class="reader-wpm-input" type="number" min="60" max="1200" step="10" value="250" />
      </label>

      <button class="reader-btn reader-speed-toggle" aria-pressed="false"
        title="Click: Start/Pause/Resume. Space toggles pause/resume. Esc stops.">Speed Read: Off</button>

      <span class="reader-time-est" title="Estimated time remaining">⏱ <span class="reader-time-text">--</span></span>

      <button class="reader-btn reader-next-par" title="Skip to next paragraph (Speed Read only)">Next ¶</button>
    </div>

    <div class="reader-right">
      <button class="reader-btn reader-images-toggle" title="Toggle Images">🖼️ Images</button>
      <button class="reader-btn reader-font-btn" data-size="smaller">A-</button>
      <button class="reader-btn reader-font-btn" data-size="larger">A+</button>
      <button class="reader-btn reader-close-btn" title="View Original">View Original</button>
    </div>
  </div>

  <div class="reader-content-wrapper">
    <div class="reader-content">
      ${articleHTML}
    </div>
  </div>

  <script>
    const originalUrl = "${originalUrl.replace(/"/g, '&quot;')}";

    const wrapper = document.querySelector(".reader-content-wrapper");
    const content = document.querySelector(".reader-content");
    const wpmInput = document.querySelector(".reader-wpm-input");
    const speedBtn = document.querySelector(".reader-speed-toggle");
    const nextParBtn = document.querySelector(".reader-next-par");
    const timeText = document.querySelector(".reader-time-text");

    // Font size control
    let fontSize = 18;
    function updateFontSize() {
      document.documentElement.style.setProperty("--reader-font-size", fontSize + "px");
    }
    updateFontSize();

    document.querySelectorAll(".reader-font-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = btn.getAttribute("data-size");
        if (dir === "larger") fontSize = Math.min(fontSize + 2, 30);
        else fontSize = Math.max(fontSize - 2, 12);
        updateFontSize();
      });
    });

    // Theme buttons
    document.querySelectorAll(".reader-theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.getAttribute("data-theme");
        document.body.classList.remove("reader-theme-light","reader-theme-sepia","reader-theme-dark");
        document.body.classList.add(\`reader-theme-\${theme}\`);
      });
    });

    // Images toggle
    const imagesBtn = document.querySelector(".reader-images-toggle");
    if (imagesBtn) {
      imagesBtn.addEventListener("click", () => {
        const isNoImages = document.body.classList.toggle("reader-no-images");
        imagesBtn.textContent = isNoImages ? "🖼️ Show Images" : "🖼️ Images";
      });
    }

    // View original
    const closeBtn = document.querySelector(".reader-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        stopSpeedReading();
        window.location.href = originalUrl;
      });
    }

    // ---------------- Helpers: time formatting ----------------
    function clamp(n, a, b){ return Math.min(Math.max(n, a), b); }

    function formatMinutes(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) return "--";
      const total = Math.ceil(seconds);
      const m = Math.floor(total / 60);
      const s = total % 60;
      if (m <= 0) return s + "s";
      return m + "m " + String(s).padStart(2, "0") + "s";
    }

    // ---------------- Speed Reading (Pause/Resume + shortcuts + next paragraph) ----------------
    let speedReadingEnabled = false;
    let speedReadingPaused = false;

    let speedWords = [];           // spans, in order
    let currentWordIndex = 0;      // next word to show
    let speedTimer = null;

    // block mapping for "Next ¶"
    // each word span gets data-block="N" where block increments per paragraph-ish group
    let totalWordsCount = 0;

    function getWordsPerMinute() {
      const parsed = Number.parseInt(wpmInput.value, 10);
      if (Number.isNaN(parsed)) return 250;
      return clamp(parsed, 60, 1200);
    }

    function setWordsPerMinute(next) {
      const clamped = clamp(next, 60, 1200);
      wpmInput.value = String(clamped);
      return clamped;
    }

    function getIntervalMsFromWpm(wpm) {
      return Math.max(Math.round(60000 / wpm), 30);
    }

    function getReadingProgressRatio() {
      const maxScroll = Math.max(wrapper.scrollHeight - wrapper.clientHeight, 0);
      if (maxScroll <= 0) return 0;
      return clamp(wrapper.scrollTop / maxScroll, 0, 1);
    }

    function computeTotalWordsFromText() {
      const text = (content.textContent || "").trim();
      if (!text) return 0;
      // simple word split
      return text.split(/\\s+/).filter(Boolean).length;
    }

    function updateTimeEstimate() {
      // If Speed Reading ON -> remaining time from remaining words at chosen WPM
      if (speedReadingEnabled && speedWords.length > 0) {
        const remaining = Math.max(speedWords.length - currentWordIndex, 0);
        const wpm = getWordsPerMinute();
        const seconds = (remaining / wpm) * 60;
        timeText.textContent = formatMinutes(seconds);
        return;
      }

      // Speed Reading OFF -> estimate remaining time at 300 WPM based on scroll progress
      const total = totalWordsCount || computeTotalWordsFromText();
      totalWordsCount = total;
      const progress = getReadingProgressRatio();
      const remaining = Math.max(Math.round(total * (1 - progress)), 0);
      const seconds = (remaining / 300) * 60;
      timeText.textContent = formatMinutes(seconds);
    }

    function prepareSpeedReadingWords() {
      if (speedWords.length > 0) return;

      // Map "paragraph-ish block element" -> block id
      const blockMap = new Map();
      let blockIdCounter = 0;

      function getBlockEl(el) {
        if (!el) return null;
        // Prefer actual paragraphs
        const p = el.closest("p");
        if (p) return p;
        // fallback: treat headings/list items/blockquote as blocks too
        const other = el.closest("li, h1, h2, h3, h4, h5, h6, blockquote");
        if (other) return other;
        // final fallback
        return el.closest(".reader-content") || el;
      }

      function getBlockIdForElement(el) {
        const blockEl = getBlockEl(el);
        if (!blockEl) return 0;
        if (!blockMap.has(blockEl)) {
          blockMap.set(blockEl, blockIdCounter++);
        }
        return blockMap.get(blockEl);
      }

      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (!node.parentElement) return NodeFilter.FILTER_REJECT;
          if (node.parentElement.closest("script, style, noscript")) return NodeFilter.FILTER_REJECT;
          if (node.parentElement.closest("pre, code, kbd, samp")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      textNodes.forEach((textNode) => {
        const value = textNode.nodeValue;
        if (!value) return;

        const parts = value.match(/(\\s+|[^\\s]+)/g);
        if (!parts || parts.length === 0) return;

        const blockId = getBlockIdForElement(textNode.parentElement);

        const fragment = document.createDocumentFragment();
        parts.forEach((part) => {
          if (/^\\s+$/.test(part)) {
            fragment.appendChild(document.createTextNode(part));
          } else {
            const wordSpan = document.createElement("span");
            wordSpan.className = "reader-speed-word";
            wordSpan.textContent = part;
            wordSpan.dataset.block = String(blockId);
            speedWords.push(wordSpan);
            fragment.appendChild(wordSpan);
          }
        });

        textNode.replaceWith(fragment);
      });

      totalWordsCount = speedWords.length || totalWordsCount || computeTotalWordsFromText();
      updateTimeEstimate();
    }

    function clearCurrentHighlight() {
      speedWords.forEach((w) => w.classList.remove("reader-speed-current"));
    }

    function scrollCurrentWordToTop(wordEl) {
      const wordRect = wordEl.getBoundingClientRect();
      const wrapRect = wrapper.getBoundingClientRect();
      const offsetWithinWrapper = wordRect.top - wrapRect.top;
      const targetTop = Math.max(wrapper.scrollTop + offsetWithinWrapper - 2, 0);
      wrapper.scrollTo({ top: targetTop });
    }

    function updateSpeedButtonText() {
      if (!speedReadingEnabled) {
        speedBtn.textContent = "Speed Read: Off";
        speedBtn.setAttribute("aria-pressed", "false");
        return;
      }
      speedBtn.setAttribute("aria-pressed", "true");
      speedBtn.textContent = speedReadingPaused ? "Speed Read: Resume" : "Speed Read: Pause";
    }

    function stopTimer() {
      if (speedTimer) {
        clearTimeout(speedTimer);
        speedTimer = null;
      }
    }

    function scheduleNextTick() {
      stopTimer();
      if (!speedReadingEnabled || speedReadingPaused) return;

      const wpm = getWordsPerMinute();
      const intervalMs = getIntervalMsFromWpm(wpm);

      speedTimer = setTimeout(() => {
        tickWord();
        scheduleNextTick();
      }, intervalMs);
    }

    function tickWord() {
      if (!speedWords.length) return;

      if (currentWordIndex >= speedWords.length) {
        stopSpeedReading();
        return;
      }

      clearCurrentHighlight();
      const currentWord = speedWords[currentWordIndex];
      currentWord.classList.add("reader-speed-current");
      scrollCurrentWordToTop(currentWord);
      currentWordIndex += 1;

      updateTimeEstimate();
    }

    function startSpeedReading() {
      prepareSpeedReadingWords();
      if (!speedWords.length) return;

      speedReadingEnabled = true;
      speedReadingPaused = false;
      currentWordIndex = 0;

      content.classList.add("reader-speed-reading-active");
      updateSpeedButtonText();

      tickWord();
      scheduleNextTick();
    }

    function pauseSpeedReading() {
      if (!speedReadingEnabled) return;
      speedReadingPaused = true;
      stopTimer();
      updateSpeedButtonText();
      updateTimeEstimate();
    }

    function resumeSpeedReading() {
      if (!speedReadingEnabled) return;
      if (currentWordIndex >= speedWords.length) {
        stopSpeedReading();
        return;
      }
      speedReadingPaused = false;
      updateSpeedButtonText();
      scheduleNextTick();
      updateTimeEstimate();
    }

    function stopSpeedReading() {
      stopTimer();
      speedReadingEnabled = false;
      speedReadingPaused = false;
      content.classList.remove("reader-speed-reading-active");
      clearCurrentHighlight();
      updateSpeedButtonText();

      // when OFF, revert estimate to 300WPM scroll-based
      updateTimeEstimate();
    }

    function skipToNextParagraph() {
      if (!speedReadingEnabled || !speedWords.length) return;

      // current displayed word index is (currentWordIndex - 1)
      const shownIndex = Math.max(currentWordIndex - 1, 0);
      const currentBlock = speedWords[shownIndex]?.dataset?.block ?? null;
      if (currentBlock == null) return;

      // find the first word in a later block
      let i = currentWordIndex;
      while (i < speedWords.length && speedWords[i].dataset.block === currentBlock) i++;

      if (i >= speedWords.length) {
        stopSpeedReading();
        return;
      }

      currentWordIndex = i;

      // Show immediately (even if paused)
      clearCurrentHighlight();
      const w = speedWords[currentWordIndex];
      if (w) {
        w.classList.add("reader-speed-current");
        scrollCurrentWordToTop(w);
        currentWordIndex += 1;
      }
      updateTimeEstimate();

      // if running, restart schedule so it feels snappy
      if (speedReadingEnabled && !speedReadingPaused) scheduleNextTick();
    }

    // Click cycles: Off -> Start, Running -> Pause, Paused -> Resume
    speedBtn.addEventListener("click", () => {
      if (!speedReadingEnabled) startSpeedReading();
      else if (!speedReadingPaused) pauseSpeedReading();
      else resumeSpeedReading();
    });

    nextParBtn.addEventListener("click", skipToNextParagraph);

    // Restart timing when WPM changes, but do NOT reset word index.
    wpmInput.addEventListener("change", () => {
      if (!speedReadingEnabled) {
        updateTimeEstimate();
        return;
      }
      if (speedReadingPaused) {
        updateTimeEstimate();
        return;
      }
      scheduleNextTick();
      updateTimeEstimate();
    });

    // Keyboard shortcuts
    function isTypingTarget(el) {
      if (!el) return false;
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    document.addEventListener("keydown", (e) => {
      if (isTypingTarget(e.target)) return;

      // Space: pause/resume (only when enabled)
      if (e.code === "Space") {
        if (!speedReadingEnabled) return;
        e.preventDefault();
        if (speedReadingPaused) resumeSpeedReading();
        else pauseSpeedReading();
        return;
      }

      // Esc: stop
      if (e.key === "Escape") {
        if (!speedReadingEnabled) return;
        stopSpeedReading();
        return;
      }

      // ArrowUp/ArrowDown: adjust WPM (Shift = bigger steps)
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (!speedReadingEnabled) return;
        e.preventDefault();

        const step = e.shiftKey ? 50 : 10;
        const current = getWordsPerMinute();
        const next = current + (e.key === "ArrowUp" ? step : -step);
        setWordsPerMinute(next);

        if (!speedReadingPaused) scheduleNextTick();
        updateTimeEstimate();
        return;
      }

      // N: next paragraph
      if (e.key === "n" || e.key === "N") {
        if (!speedReadingEnabled) return;
        e.preventDefault();
        skipToNextParagraph();
        return;
      }
    });

    // Update estimate in real-time while normal reading (Speed Read OFF)
    wrapper.addEventListener("scroll", () => {
      if (speedReadingEnabled) return;
      updateTimeEstimate();
    });

    // Initial estimate (Speed Read OFF)
    updateTimeEstimate();
  </script>
</body>
</html>`;

  // --------- STEP 3: Open new tab with reader content and close original ---------

  const blob = new Blob([pageHTML], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  const newTab = window.open(blobUrl, "_blank");
  if (!newTab) {
    alert("Failed to open reader mode. Please allow pop-ups for this site.");
    return;
  }

  setTimeout(() => {
    window.close();
    setTimeout(() => {
      if (!document.hidden) {
        document.body.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;font-size:18px;color:#666;">Reader mode opened in new tab. You can close this tab manually.</div>';
      }
    }, 500);
  }, 100);
})();
