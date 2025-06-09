import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  manifest: {
    permissions: ["storage", "activeTab"],
    host_permissions: [
      "*://*.google.com/*",
      "*://*.bing.com/*",
      "*://*.duckduckgo.com/*",
      "*://*.yahoo.com/*",
    ],
  },
});
