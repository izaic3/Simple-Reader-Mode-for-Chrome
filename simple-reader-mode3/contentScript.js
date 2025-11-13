(() => {
  // If we're already on the simplified reader page, just toggle text-only mode
  if (document.body && document.body.classList.contains("simple-reader-page")) {
    const body = document.body;
    const nowTextOnly = !body.classList.contains("reader-text-only");
    body.classList.toggle("reader-text-only", nowTextOnly);
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

    // 3. Fallback: collect paragraphs & headings
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
      '[data-ad]',
      '[data-ad-slot]',
      '[data-ad-client]',
      '[data-testid*="ad"]',
      "iframe",
      "script",
      "style"
    ];

    root.querySelectorAll(adSelectors.join(",")).forEach((el) => el.remove());

    // Remove standalone "ADVERTISEMENT", "Sponsored", etc.
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

  const contentNode = cleanContentNode(getMainContentNode());
  const articleHTML = contentNode
    ? contentNode.innerHTML
    : "<p>(No readable content found.)</p>";
  const title = document.title || "Reader Mode";

  // --------- STEP 2: Build the new minimal reader page ---------

  const pageHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
  }
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
  }
  body.reader-theme-sepia {
    background-color: #f4ecd8;
    color: #3b2f26;
  }
  body.reader-theme-dark {
    background-color: #181a1b;
    color: #e4e4e4;
  }

  /* TEXT-ONLY MODE: hide images, figures, videos, pictures, iframes */
  body.reader-text-only .reader-content img,
  body.reader-text-only .reader-content figure,
  body.reader-text-only .reader-content picture,
  body.reader-text-only .reader-content video,
  body.reader-text-only .reader-content iframe {
    display: none !important;
  }

  .reader-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(0,0,0,0.15);
    position: sticky;
    top: 0;
    z-index: 1;
    backdrop-filter: blur(8px);
  }
  body.reader-theme-dark .reader-toolbar {
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
  body.reader-theme-dark .reader-btn {
    background: rgba(255,255,255,0.08);
  }
  .reader-btn:hover {
    background: rgba(0,0,0,0.12);
  }
  body.reader-theme-dark .reader-btn:hover {
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
  body.reader-theme-dark .reader-content th,
  body.reader-theme-dark .reader-content td {
    border-color: rgba(255,255,255,0.2);
  }
</style>
</head>
<body class="simple-reader-page reader-theme-light">
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
      <button class="reader-btn reader-close-btn" title="Exit Reader">✕</button>
    </div>
  </div>
  <div class="reader-content-wrapper">
    <div class="reader-content">
      ${articleHTML}
    </div>
  </div>
</body>
</html>`;

  // Replace the whole document with the minimal reader page
  document.open();
  document.write(pageHTML);
  document.close();

  // --------- STEP 3: Attach toolbar behavior from the extension script ---------

  function initReaderControls() {
    const body = document.body;
    if (!body || !body.classList.contains("simple-reader-page")) return;

    // Font size control
    let fontSize = 18;
    function updateFontSize() {
      document.documentElement.style.setProperty("--reader-font-size", fontSize + "px");
    }
    updateFontSize();

    document.querySelectorAll(".reader-font-btn").forEach((btn) => {
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

    // Theme buttons
    document.querySelectorAll(".reader-theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.getAttribute("data-theme");
        body.classList.remove(
          "reader-theme-light",
          "reader-theme-sepia",
          "reader-theme-dark"
        );
        body.classList.add(`reader-theme-${theme}`);
      });
    });

    // Close button – go back if possible, otherwise reload
    const closeBtn = document.querySelector(".reader-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (history.length > 1) {
          history.back();
        } else {
          location.reload();
        }
      });
    }
  }

  // Run after the new document is in place
  // Small timeout to ensure layout is ready
  setTimeout(initReaderControls, 0);
})();
