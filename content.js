const CREDENTIALS = [
  {
    label: "Lease account",
    username: "test3@mail.com",
    password: "Password@123",
    tag: "Prod",
  },
  {
    label: "Supplier account",
    username: "test@mail.com",
    password: "12345678",
    tag: "Dev",
  },
];

// Set the default tag filter applied when the palette opens.
// Example: const DEFAULT_TAG = "Prod"; Set to null for no default (All).
const DEFAULT_TAG = null;

function triggerReactInput(element, value) {
  const lastValue = element.value;
  element.value = value;

  const event = new Event("input", { bubbles: true });
  const changeEvent = new Event("change", { bubbles: true });

  const tracker = element._valueTracker;
  if (tracker) {
    tracker.setValue(lastValue);
  }

  element.dispatchEvent(event);
  element.dispatchEvent(changeEvent);
}

let paletteState = {
  isOpen: false,
  container: null,
  listEl: null,
  items: [],
  activeIndex: 0,
  searchInput: null,
  filteredIndices: [],
  tagsBarEl: null,
  activeTagFilter: null,
  lastUsedUsername: null,
};

chrome.runtime.onMessage.addListener(function (request) {
  if (request.action === "open-login-palette") {
    togglePalette(!paletteState.isOpen);
  }
});

function fillAndLogin(username, password, isAdminSite) {
  let usernameInput;
  let passwordInput;
  let submitButton;
  if (isAdminSite) {
    usernameInput = document.querySelector('input[name="userName"]');
    passwordInput = document.querySelector(
      'input[name="password"], input[data-cy="password"]'
    );
    submitButton = document.querySelector('button[type="button"]');
  } else {
    usernameInput = document.querySelector(
      'input[name="email"], input[data-cy="email"]'
    );
    passwordInput = document.querySelector(
      'input[name="password"], input[data-cy="password"]'
    );
    submitButton = document.querySelector('button[type="submit"], button');
  }

  if (usernameInput && passwordInput) {
    triggerReactInput(usernameInput, username);
    triggerReactInput(passwordInput, password);

    if (submitButton) {
      submitButton.click();
    }
  } else {
    console.error("Could not find login form elements");
  }
}

function togglePalette(open) {
  if (open && paletteState.isOpen) return;
  if (!open && !paletteState.isOpen) return;

  if (open) {
    openPalette();
  } else {
    closePalette();
  }
}

function openPalette() {
  if (paletteState.isOpen) return;
  ensurePaletteElements();
  paletteState.isOpen = true;
  paletteState.activeIndex = 0;
  // Reset search/filter on open
  if (paletteState.searchInput) {
    paletteState.searchInput.value = "";
  }
  paletteState.filteredIndices = CREDENTIALS.map((_, i) => i);
  // Load persisted prefs (last used, preferred tag), then render with filters
  loadPersistentState(() => {
    renderTagsBar();
    applyFilters();
  });
  paletteState.container.style.display = "flex";
  document.addEventListener("keydown", onPaletteKeydown, true);
  // Focus search box for immediate typing
  if (paletteState.searchInput) {
    paletteState.searchInput.focus();
    paletteState.searchInput.select();
  }
}

function closePalette() {
  if (!paletteState.isOpen) return;
  paletteState.isOpen = false;
  paletteState.container.style.display = "none";
  document.removeEventListener("keydown", onPaletteKeydown, true);
}

function ensurePaletteElements() {
  if (paletteState.container) return;

  const container = document.createElement("div");
  container.id = "auto-login-filler-palette";
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.display = "none";
  container.style.alignItems = "flex-start";
  container.style.justifyContent = "center";
  container.style.zIndex = "2147483647";
  container.style.background = "rgba(0,0,0,0.2)";
  container.style.backdropFilter = "blur(2px)";

  const panel = document.createElement("div");
  panel.style.marginTop = "10vh";
  panel.style.width = "min(520px, 96vw)";
  panel.style.maxHeight = "70vh";
  panel.style.background = "#1e1e1e";
  panel.style.color = "#e5e7eb";
  panel.style.border = "1px solid #374151";
  panel.style.borderRadius = "8px";
  panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.4)";
  panel.style.overflow = "hidden";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.fontFamily =
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

  const header = document.createElement("div");
  header.textContent = "Select an account to login";
  header.style.padding = "12px 14px";
  header.style.fontSize = "14px";
  header.style.letterSpacing = "0.2px";
  header.style.background = "#111827";
  header.style.borderBottom = "1px solid #374151";

  const tagsBar = document.createElement("div");
  tagsBar.style.display = "flex";
  tagsBar.style.flexWrap = "wrap";
  tagsBar.style.gap = "6px";
  tagsBar.style.padding = "8px 12px";
  tagsBar.style.background = "#0f172a";
  tagsBar.style.borderBottom = "1px solid #374151";

  const searchWrap = document.createElement("div");
  searchWrap.style.padding = "8px 12px";
  searchWrap.style.background = "#111827";
  searchWrap.style.borderBottom = "1px solid #374151";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search accounts…";
  searchInput.autocapitalize = "off";
  searchInput.autocomplete = "off";
  searchInput.spellcheck = false;
  searchInput.style.width = "100%";
  searchInput.style.boxSizing = "border-box";
  searchInput.style.padding = "8px 10px";
  searchInput.style.fontSize = "14px";
  searchInput.style.color = "#e5e7eb";
  searchInput.style.background = "#0b1220";
  searchInput.style.border = "1px solid #374151";
  searchInput.style.borderRadius = "6px";
  searchInput.style.outline = "none";

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();
    const tagFilter = paletteState.activeTagFilter;
    const matches = cred =>
      fuzzyMatch(cred.label || "", q) ||
      fuzzyMatch(cred.username || "", q) ||
      fuzzyMatch(cred.tag || "", q);
    const withTag = idx =>
      !tagFilter || (CREDENTIALS[idx].tag || "") === tagFilter;
    const indices = CREDENTIALS.map((_, i) => i).filter(
      i => (!q || matches(CREDENTIALS[i])) && withTag(i)
    );
    paletteState.filteredIndices = indices;
    paletteState.activeIndex = 0;
    renderPaletteItems();
    highlightActiveItem();
  });

  searchWrap.appendChild(searchInput);

  const list = document.createElement("ul");
  list.style.listStyle = "none";
  list.style.margin = "0";
  list.style.padding = "6px 0";
  list.style.flex = "1 1 auto";
  list.style.overflowY = "auto";

  // Defer actual item creation to renderPaletteItems()

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.flexWrap = "wrap";
  footer.style.gap = "8px 12px";
  footer.style.alignItems = "center";
  footer.style.padding = "8px 12px";
  footer.style.fontSize = "12px";
  footer.style.color = "#9ca3af";
  footer.style.borderTop = "1px solid #374151";

  // Render keyboard shortcuts as compact chips
  const shortcuts = [
    // { keys: ["Ctrl", "Shift", "L"], label: "Toggle" },
    { keys: ["↑", "↓"], label: "Navigate" },
    { keys: ["1–9"], label: "Quick select" },
    { keys: ["0"], label: "Reuse last" },
    { keys: ["Enter"], label: "Fill & submit" },
    { keys: ["Shift", "Enter"], label: "Fill only" },
    { keys: ["Alt", "Enter"], label: "Copy password" },
    { keys: ["Esc"], label: "Close" },
  ];

  const createKeyChip = text => {
    const chip = document.createElement("span");
    chip.textContent = text;
    chip.style.display = "inline-flex";
    chip.style.alignItems = "center";
    chip.style.justifyContent = "center";
    chip.style.padding = "2px 6px";
    chip.style.border = "1px solid #374151";
    chip.style.borderRadius = "4px";
    chip.style.background = "#0b1220";
    chip.style.color = "#cbd5e1";
    chip.style.fontSize = "11px";
    chip.style.lineHeight = "1";
    chip.style.minWidth = "20px";
    return chip;
  };

  shortcuts.forEach(s => {
    const group = document.createElement("div");
    group.style.display = "flex";
    group.style.alignItems = "center";
    group.style.gap = "6px";

    s.keys.forEach((k, i) => {
      if (i > 0) {
        const plus = document.createElement("span");
        plus.textContent = "+";
        plus.style.opacity = "0.6";
        group.appendChild(plus);
      }
      group.appendChild(createKeyChip(k));
    });

    const desc = document.createElement("span");
    desc.textContent = s.label;
    desc.style.color = "#9ca3af";
    desc.style.fontSize = "12px";
    group.appendChild(desc);

    footer.appendChild(group);
  });

  panel.appendChild(header);
  panel.appendChild(tagsBar);
  panel.appendChild(searchWrap);
  panel.appendChild(list);
  panel.appendChild(footer);
  container.appendChild(panel);
  document.documentElement.appendChild(container);

  paletteState.container = container;
  paletteState.tagsBarEl = tagsBar;
  paletteState.searchInput = searchInput;
  paletteState.listEl = list;
  paletteState.items = Array.from(list.children);

  container.addEventListener("click", e => {
    if (e.target === container) {
      closePalette();
    }
  });
}

function renderPaletteItems() {
  if (!paletteState.listEl) return;
  const list = paletteState.listEl;
  list.innerHTML = "";
  const indices =
    paletteState.filteredIndices && paletteState.filteredIndices.length
      ? paletteState.filteredIndices
      : CREDENTIALS.map((_, i) => i);

  indices.forEach((credIndex, visualIndex) => {
    const cred = CREDENTIALS[credIndex];
    const item = document.createElement("li");
    item.setAttribute("data-index", String(visualIndex));
    item.setAttribute("data-cred-index", String(credIndex));
    item.style.padding = "8px 12px";
    item.style.cursor = "pointer";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.gap = "12px";

    const badge = document.createElement("span");
    badge.textContent = String(visualIndex + 1);
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.width = "22px";
    badge.style.height = "22px";
    badge.style.borderRadius = "6px";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "600";
    badge.style.background = "#374151";
    badge.style.color = "#e5e7eb";

    const textWrap = document.createElement("div");
    textWrap.style.display = "flex";
    textWrap.style.flexDirection = "column";
    textWrap.style.gap = "2px";

    const primary = document.createElement("div");
    const tags = cred.tag ? [cred.tag] : [];
    primary.textContent = cred.label || cred.username;
    primary.style.fontSize = "14px";
    primary.style.lineHeight = "20px";

    const secondary = document.createElement("div");
    secondary.textContent = `${cred.username} / ${maskPassword(cred.password)}`;
    secondary.style.fontSize = "12px";
    secondary.style.color = "#9ca3af";

    const tagsRow = document.createElement("div");
    tagsRow.style.display = "flex";
    tagsRow.style.flexWrap = "wrap";
    tagsRow.style.gap = "6px";
    tags.forEach(t => {
      const chip = document.createElement("span");
      chip.textContent = t;
      chip.style.fontSize = "11px";
      chip.style.color = "#cbd5e1";
      chip.style.background = "#334155";
      chip.style.padding = "2px 6px";
      chip.style.borderRadius = "9999px";
      tagsRow.appendChild(chip);
    });

    textWrap.appendChild(primary);
    textWrap.appendChild(secondary);
    if (tags.length) textWrap.appendChild(tagsRow);
    item.appendChild(badge);
    item.appendChild(textWrap);

    item.addEventListener("mouseenter", () => {
      paletteState.activeIndex = visualIndex;
      highlightActiveItem();
    });
    item.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const idxAttr = item.getAttribute("data-index");
      if (idxAttr) {
        paletteState.activeIndex = parseInt(idxAttr, 10) || 0;
      }
      chooseActive();
    });

    list.appendChild(item);
  });

  paletteState.items = Array.from(list.children);
}

function highlightActiveItem() {
  if (!paletteState.items.length) return;
  paletteState.items.forEach((el, i) => {
    el.style.background =
      i === paletteState.activeIndex ? "#111827" : "transparent";
  });
  const activeEl = paletteState.items[paletteState.activeIndex];
  if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
}

function onPaletteKeydown(e) {
  if (!paletteState.isOpen) return;

  // Ensure palette interactions do not leak to the page
  e.stopPropagation();

  const maxIndex = paletteState.items.length - 1;
  if (e.key === "Escape") {
    e.preventDefault();
    closePalette();
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    paletteState.activeIndex = Math.min(maxIndex, paletteState.activeIndex + 1);
    highlightActiveItem();
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    paletteState.activeIndex = Math.max(0, paletteState.activeIndex - 1);
    highlightActiveItem();
    return;
  }
  // Tag chips navigation with Ctrl+ArrowLeft/Right
  if (e.ctrlKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    focusNextTagChip(e.key === "ArrowRight");
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const submit = !e.shiftKey; // Enter fills & submits; Shift+Enter fills only
    chooseActive({ submit, copyOnly: e.altKey });
    return;
  }
  // Digit quick select 1..9 (based on visual index)
  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    const index = parseInt(e.key, 10) - 1;
    if (index >= 0 && index <= maxIndex) {
      paletteState.activeIndex = index;
      chooseActive({ submit: true, copyOnly: false });
    }
    return;
  }
  // 0 -> reuse last account
  if (e.key === "0") {
    e.preventDefault();
    reuseLastAccount();
    return;
  }
}

function chooseActive(options) {
  const opts = Object.assign({ submit: true, copyOnly: false }, options || {});
  // Map visual activeIndex to underlying credential using filteredIndices
  const indices =
    paletteState.filteredIndices && paletteState.filteredIndices.length
      ? paletteState.filteredIndices
      : CREDENTIALS.map((_, i) => i);
  const credIndex = indices[paletteState.activeIndex];
  const cred = CREDENTIALS[credIndex];
  if (!cred) return;
  closePalette();
  if (opts.copyOnly) {
    copyToClipboard(cred.password);
  } else {
    if (opts.submit) {
      fillAndLogin(cred.username, cred.password, !!cred.isAdminSite);
    } else {
      fillOnly(cred.username, cred.password, !!cred.isAdminSite);
    }
  }
  paletteState.lastUsedUsername = cred.username;
  savePersistentState();
}

function fillOnly(username, password, isAdminSite) {
  let usernameInput;
  let passwordInput;
  if (isAdminSite) {
    usernameInput = document.querySelector('input[name="userName"]');
    passwordInput = document.querySelector(
      'input[name="password"], input[data-cy="password"]'
    );
  } else {
    usernameInput = document.querySelector(
      'input[name="email"], input[data-cy="email"]'
    );
    passwordInput = document.querySelector(
      'input[name="password"], input[data-cy="password"]'
    );
  }
  if (usernameInput && passwordInput) {
    triggerReactInput(usernameInput, username);
    triggerReactInput(passwordInput, password);
  }
}

function reuseLastAccount() {
  const last = paletteState.lastUsedUsername;
  if (!last) return;
  const cred = CREDENTIALS.find(c => c.username === last);
  if (!cred) return;
  closePalette();
  fillAndLogin(cred.username, cred.password, !!cred.isAdminSite);
}

function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function maskEmail(email) {
  if (typeof email !== "string") return "";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const maskedName =
    name.length <= 2 ? name : name[0] + "***" + name[name.length - 1];
  return maskedName + "@" + domain;
}

function maskPassword(password) {
  if (typeof password !== "string" || password.length === 0) return "";
  if (password.length <= 3) return "*".repeat(password.length);
  const visible = Math.min(2, password.length - 2);
  const head = password.slice(0, visible);
  const tail = password.slice(-1);
  const hiddenLength = password.length - visible - 1;
  return head + "*".repeat(hiddenLength) + tail;
}

// ---------- Tags & Persistence ----------
function loadPersistentState(cb) {
  try {
    chrome.storage?.local.get(
      ["lastUsedUsername", "preferredTagFilter"],
      data => {
        paletteState.lastUsedUsername = data.lastUsedUsername || null;
        // Determine preferred tag: stored value or DEFAULT_TAG, only if available
        const tagSet = new Set();
        CREDENTIALS.forEach(c => {
          if (c.tag) tagSet.add(c.tag);
        });
        let preferred = data.preferredTagFilter ?? DEFAULT_TAG;
        if (preferred && !tagSet.has(preferred)) preferred = null;
        paletteState.activeTagFilter = preferred || null;
        if (typeof cb === "function") cb();
      }
    );
  } catch (_) {
    // Fallback to DEFAULT_TAG on any error
    paletteState.activeTagFilter = DEFAULT_TAG || null;
    if (typeof cb === "function") cb();
  }
}

function savePersistentState() {
  try {
    chrome.storage?.local.set({
      lastUsedUsername: paletteState.lastUsedUsername,
      preferredTagFilter: paletteState.activeTagFilter || null,
    });
  } catch (_) {}
}

function renderTagsBar() {
  if (!paletteState.tagsBarEl) return;
  const el = paletteState.tagsBarEl;
  el.innerHTML = "";
  // Collect unique tags from known mappings
  const tagSet = new Set();
  CREDENTIALS.forEach(c => {
    if (c.tag) tagSet.add(c.tag);
  });
  const tags = Array.from(tagSet).sort();

  // 'All' chip
  const all = createTagChip("All", !paletteState.activeTagFilter, () => {
    paletteState.activeTagFilter = null;
    renderTagsBar();
    applyFilters();
    savePersistentState();
  });
  el.appendChild(all);

  tags.forEach(t => {
    const chip = createTagChip(t, paletteState.activeTagFilter === t, () => {
      paletteState.activeTagFilter =
        paletteState.activeTagFilter === t ? null : t;
      renderTagsBar();
      applyFilters();
      savePersistentState();
    });
    el.appendChild(chip);
  });

  // No manual editing; keep bar static from CREDENTIALS
}

function createTagChip(text, active, onClick) {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.style.fontSize = "12px";
  btn.style.padding = "4px 8px";
  btn.style.borderRadius = "9999px";
  btn.style.border = active ? "1px solid #60a5fa" : "1px solid #334155";
  btn.style.background = active ? "#1e3a8a" : "#0b1220";
  btn.style.color = active ? "#e5e7eb" : "#cbd5e1";
  btn.addEventListener("click", onClick);
  return btn;
}

function applyFilters() {
  const q = (paletteState.searchInput?.value || "").trim();
  const tagFilter = paletteState.activeTagFilter;
  const matches = cred =>
    fuzzyMatch(cred.label || "", q) ||
    fuzzyMatch(cred.username || "", q) ||
    fuzzyMatch(cred.tag || "", q);
  const withTag = idx =>
    !tagFilter || (CREDENTIALS[idx].tag || "") === tagFilter;
  const indices = CREDENTIALS.map((_, i) => i).filter(
    i => (!q || matches(CREDENTIALS[i])) && withTag(i)
  );
  paletteState.filteredIndices = indices;
  paletteState.activeIndex = 0;
  renderPaletteItems();
  highlightActiveItem();
}

// No prompt editing any more

function focusNextTagChip(forward) {
  const chips = Array.from(
    paletteState.tagsBarEl?.querySelectorAll("button") || []
  );
  if (!chips.length) return;
  const active = document.activeElement;
  let idx = chips.indexOf(active);
  if (idx === -1) idx = forward ? -1 : 0;
  const nextIdx = (idx + (forward ? 1 : -1) + chips.length) % chips.length;
  chips[nextIdx].focus();
}

// ---------- Fuzzy matching ----------
function fuzzyMatch(text, query) {
  const q = String(query || "").toLowerCase();
  if (!q) return true;
  const s = String(text || "").toLowerCase();
  let i = 0;
  for (let c of q) {
    i = s.indexOf(c, i);
    if (i === -1) return false;
    i += 1;
  }
  return true;
}
