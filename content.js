const CREDENTIALS = [
  {
    label: "Lease account",
    username: "test3@mail.com",
    password: "Password@123",
  },
  {
    label: "Supplier account",
    username: "test@mail.com",
    password: "12345678",
  },
];

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
  renderPaletteItems();
  highlightActiveItem();
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
  panel.style.fontFamily =
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

  const header = document.createElement("div");
  header.textContent = "Select an account to login";
  header.style.padding = "12px 14px";
  header.style.fontSize = "14px";
  header.style.letterSpacing = "0.2px";
  header.style.background = "#111827";
  header.style.borderBottom = "1px solid #374151";

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
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      paletteState.filteredIndices = CREDENTIALS.map((_, i) => i);
    } else {
      paletteState.filteredIndices = CREDENTIALS.map((cred, i) => ({ cred, i }))
        .filter(({ cred }) => {
          const label = String(cred.label || "").toLowerCase();
          const user = String(cred.username || "").toLowerCase();
          return label.includes(q) || user.includes(q);
        })
        .map(({ i }) => i);
    }
    paletteState.activeIndex = 0;
    renderPaletteItems();
    highlightActiveItem();
  });

  searchWrap.appendChild(searchInput);

  const list = document.createElement("ul");
  list.style.listStyle = "none";
  list.style.margin = "0";
  list.style.padding = "6px 0";
  list.style.maxHeight = "calc(70vh - 48px - 44px - 36px)";
  list.style.overflowY = "auto";

  // Defer actual item creation to renderPaletteItems()

  const footer = document.createElement("div");
  footer.textContent =
    "Ctrl+Shift+L: toggle • ↑/↓: navigate • 1–9: quick select • Enter: fill & submit • Esc: close";
  footer.style.padding = "8px 12px";
  footer.style.fontSize = "12px";
  footer.style.color = "#9ca3af";
  footer.style.borderTop = "1px solid #374151";

  panel.appendChild(header);
  panel.appendChild(searchWrap);
  panel.appendChild(list);
  panel.appendChild(footer);
  container.appendChild(panel);
  document.documentElement.appendChild(container);

  paletteState.container = container;
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
    primary.textContent = cred.label || cred.username;
    primary.style.fontSize = "14px";
    primary.style.lineHeight = "20px";

    const secondary = document.createElement("div");
    secondary.textContent = `${cred.username} / ${maskPassword(cred.password)}`;
    secondary.style.fontSize = "12px";
    secondary.style.color = "#9ca3af";

    textWrap.appendChild(primary);
    textWrap.appendChild(secondary);
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
  if (e.key === "Enter") {
    e.preventDefault();
    chooseActive();
    return;
  }
  // Digit quick select 1..9 (based on visual index)
  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    const index = parseInt(e.key, 10) - 1;
    if (index >= 0 && index <= maxIndex) {
      paletteState.activeIndex = index;
      chooseActive();
    }
    return;
  }
}

function chooseActive() {
  // Map visual activeIndex to underlying credential using filteredIndices
  const indices =
    paletteState.filteredIndices && paletteState.filteredIndices.length
      ? paletteState.filteredIndices
      : CREDENTIALS.map((_, i) => i);
  const credIndex = indices[paletteState.activeIndex];
  const cred = CREDENTIALS[credIndex];
  if (!cred) return;
  closePalette();
  fillAndLogin(cred.username, cred.password, !!cred.isAdminSite);
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
