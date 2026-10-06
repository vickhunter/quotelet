// Entry for dist/quotelet.js: exposes window.Quotelet and auto-mounts [data-quotelet] elements.
import { autoMount, mount } from "./widget.ts";

declare global { interface Window { Quotelet?: { mount: typeof mount; scan: typeof autoMount; version: string } } }

try {
  if (!window.Quotelet) {
    window.Quotelet = { mount, scan: autoMount, version: "0.1.0" };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => autoMount(document));
    else autoMount(document);
  }
} catch { /* never throw into the host page */ }
