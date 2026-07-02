// app.js — global site behaviour (nav, theme, scroll reveal)
// Loaded as a module on every page.

const THEME_KEY = "ic_theme";

/** Apply saved theme (or system preference) before paint-adjacent code runs. */
export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  const icon = document.querySelector("[data-theme-icon]");
  if (icon) icon.textContent = next === "dark" ? "☀" : "☾";
}

/** Wires up nav toggle, theme button, active-link highlighting, footer year. */
export function initChrome() {
  const navToggle = document.querySelector("[data-nav-toggle]");
  const navLinks = document.querySelector("[data-nav-links]");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
    navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => navLinks.classList.remove("open")));
  }

  const themeBtn = document.querySelector("[data-theme-toggle]");
  if (themeBtn) {
    const icon = themeBtn.querySelector("[data-theme-icon]");
    if (icon) icon.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀" : "☾";
    themeBtn.addEventListener("click", toggleTheme);
  }

  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav-links] a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && href.endsWith(path)) a.classList.add("active");
  });

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  initRevealOnScroll();
}

function initRevealOnScroll() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
}

initTheme();
// Header/footer are injected async by include.js; wire chrome once they land.
// Fall back to DOMContentLoaded too, in case a page has no partials.
document.addEventListener("partials:loaded", initChrome);
document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector("[data-include]")) initChrome();
});
