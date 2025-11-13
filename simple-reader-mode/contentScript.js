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
    let article = document.querySelector("article");
    if (article) return article.cloneNode(true);

    // 2. Then <main>
    let main = document.querySelector("main");
    if (main) return main.cloneNode(true);

    // 3. Fallback: collect paragraphs & headings from body
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
        "ad"
      ];
      if (adWords.includes(t)) {
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
    }

    #reader-mode-overlay.reader-theme-sepia {
      background-color: #f4ecd8;
      color: #3b2f26;
    }

    #reader-mode-overlay.reader-theme-dark {
      background-color: #181a1b;
      color: #e4e4e4;
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

    #reader-mode-overlay.reader-theme-dark .reader-btn:hover {
      background: rgba(255,255,255,0.18);
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
  overlay.querySelector(".reader-content").appendChild(contentNode);

  // Add to document
  document.body.appendChild(overlay);

  // Font size state
  let fontSize = 18;

  function updateFontSize() {
    overlay.querySelector(".reader-content").style.setProperty(
      "--reader-font-size",
      fontSize + "px"
    );
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

  // Close button
  overlay.querySelector(".reader-close-btn").addEventListener("click", () => {
    overlay.remove();
    document.documentElement.style.overflow = "";
  });
})();
