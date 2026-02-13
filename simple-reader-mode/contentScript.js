(() => {
  // If already active, toggle OFF
  const existing = document.getElementById("reader-mode-overlay");
  if (existing) {
    existing.remove();
    document.documentElement.style.overflow = "";
    return;
  }

  // Try to get main content of page
  function getMainContentNode() {
    // 1. Prefer <article>
    const article = document.querySelector("article");
    if (article) return article.cloneNode(true);

    // 2. Then <main>
    const main = document.querySelector("main");
    if (main) return main.cloneNode(true);

    // 3. Score common content containers by text density
    const containerSelectors = [
      "[role='main']",
      "#content",
      ".content",
      "#article",
      ".article",
      ".post",
      ".entry",
      "section",
      "div"
    ];

    const scored = Array.from(document.querySelectorAll(containerSelectors.join(",")))
      .map((el) => {
        const text = (el.innerText || "").trim();
        const length = text.length;
        const pCount = el.querySelectorAll("p").length;
        const headingCount = el.querySelectorAll("h1, h2, h3, h4").length;
        const linkText = Array.from(el.querySelectorAll("a"))
          .map((a) => a.innerText || "")
          .join(" ").length;
        const linkDensity = length > 0 ? linkText / length : 0;
        const score = length + pCount * 200 + headingCount * 150 - linkDensity * 1000;
        return { el, score, length };
      })
      .filter((entry) => entry.length > 200)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      return scored[0].el.cloneNode(true);
    }

    // 4. Fallback: collect paragraphs & headings from body
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

    // If it's basically empty, just clone body
    if (textLength < 200) {
      return document.body.cloneNode(true);
    }

    return container;
  }

  // NEW: strip obvious ad elements and "ADVERTISEMENT" blocks
  function cleanContentNode(root) {
    if (!root) return root;

    const adSelectors = [
      // IDs that look like ad containers
      '[id^="ad-"]',
      '[id$="-ad"]',
      '[id^="ad_"]',
      '[id$="_ad"]',
      '[id*="advert"]',
      '[id*="sponsor"]',

      // Classes that look like ad containers
      '[class~="ad"]',
      '[class*="ad-"]',
      '[class*="-ad"]',
      '[class*="advert"]',
      '[class*="sponsor"]',

      // Common ad container attributes
      '[data-ad]',
      '[data-ad-slot]',
      '[data-ad-client]',
      '[data-testid*="ad"]',

      // Things we never need in reader mode
      'iframe',
      'script',
      'style'
    ];

    root.querySelectorAll(adSelectors.join(",")).forEach((el) => {
      el.remove();
    });

    // Remove standalone "ADVERTISEMENT", "Sponsored" blocks, etc.
    const textAdCandidates = root.querySelectorAll("p, div, span");
    textAdCandidates.forEach((el) => {
      if (el.children.length > 0) return;
      const t = (el.textContent || "").trim().toLowerCase();
      const adWords = [
        "advertisement",
        "advertisements",
        "sponsored",
        "sponsored content",
        "paid content",
        "promoted"
      ];
      if (adWords.includes(t)) {
        el.remove();
      }
    });

    // Remove lightweight ad shells near the reader content
    const adShells = root.querySelectorAll("aside, section, div");
    adShells.forEach((el) => {
      const text = (el.textContent || "").toLowerCase();
      if (text.length > 80) return;
      const hasAdKeyword = /(ad\s*choices|sponsored|promoted|advertisement)/i.test(text);
      if (hasAdKeyword) {
        el.remove();
      }
    });

    return root;
  }

  // Get and clean article content
  const contentNode = cleanContentNode(getMainContentNode());

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "reader-mode-overlay";
  overlay.innerHTML = `
    <div class="reader-toolbar">
      <div class="reader-left">
        <span class="reader-title">Reader Mode</span>
      </div>
      <div class="reader-center">
        <button class="reader-btn reader-theme-btn" data-theme="light">Light</button>
        <button class="reader-btn reader-theme-btn" data-theme="sepia">Sepia</button>
        <button class="reader-btn reader-theme-btn" data-theme="dark">Dark</button>
        <label class="reader-wpm-wrap">
          WPM
          <input class="reader-wpm-input" type="number" min="60" max="1200" step="10" value="250" />
        </label>
        <button class="reader-btn reader-speed-toggle" aria-pressed="false">Speed Read: Off</button>
      </div>
      <div class="reader-right">
        <button class="reader-btn reader-font-btn" data-size="smaller">A-</button>
        <button class="reader-btn reader-font-btn" data-size="larger">A+</button>
        <button class="reader-btn reader-close-btn" title="Close Reader Mode">✕</button>
      </div>
    </div>
    <div class="reader-content-wrapper">
      <div class="reader-content"></div>
    </div>
  `;

  // Style tag
  const style = document.createElement("style");
  style.textContent = `
    #reader-mode-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999999;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    #reader-mode-overlay,
    #reader-mode-overlay * {
      box-sizing: border-box;
    }

    #reader-mode-overlay.reader-theme-light {
      background-color: #f5f5f5;
      color: #111111;
      --reader-muted-text: #757575;
    }

    #reader-mode-overlay.reader-theme-sepia {
      background-color: #f4ecd8;
      color: #3b2f26;
      --reader-muted-text: #7b6c59;
    }

    #reader-mode-overlay.reader-theme-dark {
      background-color: #181a1b;
      color: #e4e4e4;
      --reader-muted-text: #8a8f94;
    }

    .reader-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-bottom: 1px solid rgba(0,0,0,0.15);
      backdrop-filter: blur(8px);
      position: sticky;
      top: 0;
      z-index: 1;
    }

    #reader-mode-overlay.reader-theme-dark .reader-toolbar {
      border-bottom-color: rgba(255,255,255,0.15);
    }

    .reader-left, .reader-center, .reader-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .reader-title {
      font-weight: 600;
      font-size: 14px;
    }

    .reader-btn {
      border: none;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 13px;
      cursor: pointer;
      background: rgba(0,0,0,0.05);
      color: inherit;
    }

    #reader-mode-overlay.reader-theme-dark .reader-btn {
      background: rgba(255,255,255,0.08);
    }

    .reader-btn:hover {
      background: rgba(0,0,0,0.12);
    }

    .reader-btn[aria-pressed="true"] {
      background: rgba(0, 0, 0, 0.22);
      font-weight: 600;
    }

    #reader-mode-overlay.reader-theme-dark .reader-btn:hover {
      background: rgba(255,255,255,0.18);
    }

    #reader-mode-overlay.reader-theme-dark .reader-btn[aria-pressed="true"] {
      background: rgba(255,255,255,0.28);
    }

    .reader-wpm-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }

    .reader-wpm-input {
      width: 84px;
      border: none;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 13px;
      background: rgba(0,0,0,0.05);
      color: inherit;
    }

    #reader-mode-overlay.reader-theme-dark .reader-wpm-input {
      background: rgba(255,255,255,0.08);
    }

    .reader-close-btn {
      font-size: 14px;
      padding-inline: 10px;
    }

    .reader-content-wrapper {
      flex: 1;
      overflow-y: auto;
      padding: 16px 0 32px;
    }

    .reader-content {
      max-width: 720px;
      margin: 0 auto;
      padding: 0 16px 32px;
      line-height: 1.6;
      font-size: var(--reader-font-size, 18px);
    }

    .reader-content h1 {
      font-size: 1.6em;
      margin-bottom: 0.4em;
      margin-top: 0.6em;
    }

    .reader-content h2 {
      font-size: 1.4em;
      margin-bottom: 0.4em;
      margin-top: 0.8em;
    }

    .reader-content h3 {
      font-size: 1.2em;
      margin-bottom: 0.4em;
      margin-top: 0.8em;
    }

    .reader-content p {
      margin: 0.4em 0 0.6em;
    }

    .reader-content a {
      color: inherit;
      text-decoration: underline;
      text-decoration-thickness: 1px;
    }

    .reader-content img,
    .reader-content figure {
      max-width: 100%;
      height: auto;
      margin: 12px auto;
      display: block;
    }

    .reader-content ul,
    .reader-content ol {
      padding-left: 1.4em;
      margin: 0.4em 0 0.6em;
    }

    .reader-content blockquote {
      border-left: 3px solid currentColor;
      opacity: 0.85;
      padding-left: 0.8em;
      margin-left: 0;
    }

    .reader-content pre {
      background: rgba(0, 0, 0, 0.06);
      padding: 12px 14px;
      border-radius: 10px;
      overflow-x: auto;
      font-size: 0.92em;
    }

    #reader-mode-overlay.reader-theme-dark .reader-content pre {
      background: rgba(255, 255, 255, 0.1);
    }

    .reader-content code {
      font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.92em;
      background: rgba(0, 0, 0, 0.06);
      padding: 0 4px;
      border-radius: 6px;
    }

    #reader-mode-overlay.reader-theme-dark .reader-content code {
      background: rgba(255, 255, 255, 0.1);
    }

    .reader-content figcaption {
      font-size: 0.9em;
      opacity: 0.75;
      margin-top: -6px;
      text-align: center;
    }

    .reader-content.reader-speed-reading-active .reader-speed-word {
      color: var(--reader-muted-text);
      font-weight: 400;
    }

    .reader-content.reader-speed-reading-active .reader-speed-word.reader-speed-current {
      color: #000000;
      font-weight: 700;
    }

    .reader-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.6em 0;
      font-size: 0.95em;
    }

    .reader-content th,
    .reader-content td {
      border: 1px solid rgba(0,0,0,0.2);
      padding: 4px 6px;
    }

    #reader-mode-overlay.reader-theme-dark .reader-content th,
    #reader-mode-overlay.reader-theme-dark .reader-content td {
      border-color: rgba(255,255,255,0.2);
    }

    /* Hide scrollbars on body behind the overlay */
    html.reader-mode-no-scroll,
    body.reader-mode-no-scroll {
      overflow: hidden !important;
    }
  `;

  document.documentElement.style.overflow = "hidden";
  overlay.classList.add("reader-theme-light"); // Default theme

  // Insert style into overlay (isolated from page styles)
  overlay.prepend(style);

  // Append extracted content
  const contentElement = overlay.querySelector(".reader-content");
  const contentWrapper = overlay.querySelector(".reader-content-wrapper");
  const wpmInput = overlay.querySelector(".reader-wpm-input");
  const speedToggleBtn = overlay.querySelector(".reader-speed-toggle");
  contentElement.appendChild(contentNode);

  // Add to document
  document.body.appendChild(overlay);

  // Font size state
  let fontSize = 18;
  let speedReadingEnabled = false;
  let speedWords = [];
  let currentWordIndex = 0;
  let speedTimer = null;

  function updateFontSize() {
    contentElement.style.setProperty(
      "--reader-font-size",
      fontSize + "px"
    );
  }

  function stopSpeedReading() {
    if (speedTimer) {
      clearInterval(speedTimer);
      speedTimer = null;
    }
    speedReadingEnabled = false;
    contentElement.classList.remove("reader-speed-reading-active");
    speedWords.forEach((word) => word.classList.remove("reader-speed-current"));
    speedToggleBtn.textContent = "Speed Read: Off";
    speedToggleBtn.setAttribute("aria-pressed", "false");
  }

  function scrollCurrentWordToTop(currentWord) {
    const currentWordRect = currentWord.getBoundingClientRect();
    const wrapperRect = contentWrapper.getBoundingClientRect();
    const offsetWithinWrapper = currentWordRect.top - wrapperRect.top;
    const targetTop = Math.max(contentWrapper.scrollTop + offsetWithinWrapper - 2, 0);
    contentWrapper.scrollTo({ top: targetTop });
  }

  function showCurrentWord() {
    if (!speedWords.length) return;
    if (currentWordIndex >= speedWords.length) {
      stopSpeedReading();
      return;
    }

    speedWords.forEach((word) => word.classList.remove("reader-speed-current"));
    const currentWord = speedWords[currentWordIndex];
    currentWord.classList.add("reader-speed-current");
    scrollCurrentWordToTop(currentWord);
    currentWordIndex += 1;
  }

  function getWordsPerMinute() {
    const parsed = Number.parseInt(wpmInput.value, 10);
    if (Number.isNaN(parsed)) return 250;
    return Math.min(Math.max(parsed, 60), 1200);
  }

  function prepareSpeedReadingWords() {
    if (speedWords.length > 0) return;

    const walker = document.createTreeWalker(contentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.parentElement) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.parentElement.closest("script, style, noscript")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((textNode) => {
      const value = textNode.nodeValue;
      if (!value) return;

      const parts = value.match(/(\s+|[^\s]+)/g);
      if (!parts || parts.length === 0) return;

      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (/^\s+$/.test(part)) {
          fragment.appendChild(document.createTextNode(part));
        } else {
          const wordSpan = document.createElement("span");
          wordSpan.className = "reader-speed-word";
          wordSpan.textContent = part;
          speedWords.push(wordSpan);
          fragment.appendChild(wordSpan);
        }
      });

      textNode.replaceWith(fragment);
    });
  }

  function startSpeedReading() {
    prepareSpeedReadingWords();
    if (!speedWords.length) return;

    stopSpeedReading();
    speedReadingEnabled = true;
    currentWordIndex = 0;
    contentElement.classList.add("reader-speed-reading-active");
    speedToggleBtn.textContent = "Speed Read: On";
    speedToggleBtn.setAttribute("aria-pressed", "true");

    const wpm = getWordsPerMinute();
    const intervalMs = Math.max(Math.round(60000 / wpm), 30);

    showCurrentWord();
    speedTimer = setInterval(showCurrentWord, intervalMs);
  }

  function toggleSpeedReading() {
    if (speedReadingEnabled) {
      stopSpeedReading();
      return;
    }
    startSpeedReading();
  }

  updateFontSize();

  // Theme buttons
  overlay.querySelectorAll(".reader-theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.getAttribute("data-theme");
      overlay.classList.remove("reader-theme-light", "reader-theme-sepia", "reader-theme-dark");
      overlay.classList.add(`reader-theme-${theme}`);
    });
  });

  // Font size buttons
  overlay.querySelectorAll(".reader-font-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-size");
      if (dir === "larger") {
        fontSize = Math.min(fontSize + 2, 30);
      } else {
        fontSize = Math.max(fontSize - 2, 12);
      }
      updateFontSize();
    });
  });

  speedToggleBtn.addEventListener("click", toggleSpeedReading);
  wpmInput.addEventListener("change", () => {
    if (!speedReadingEnabled) return;
    startSpeedReading();
  });

  // Close button
  overlay.querySelector(".reader-close-btn").addEventListener("click", () => {
    stopSpeedReading();
    overlay.remove();
    document.documentElement.style.overflow = "";
  });
})();
