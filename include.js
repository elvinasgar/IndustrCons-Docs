// include.js — fetches shared header/footer partials into any page that has
// <div data-include="partials/header.html"></div> style placeholders.
// Runs before app.js's DOMContentLoaded chrome wiring via explicit await chain.

async function includePartials() {
  const nodes = [...document.querySelectorAll("[data-include]")];
  await Promise.all(
    nodes.map(async (node) => {
      const url = node.getAttribute("data-include");
      try {
        const res = await fetch(url);
        node.outerHTML = await res.text();
      } catch (e) {
        console.error("Include failed:", url, e);
      }
    })
  );
  document.dispatchEvent(new CustomEvent("partials:loaded"));
}

includePartials();
