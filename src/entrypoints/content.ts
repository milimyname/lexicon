export default defineContentScript({
  matches: [
    "*://*.google.com/search*",
    "*://*.bing.com/search*",
    "*://*.duckduckgo.com/*",
  ],
  main() {
    console.log("Vocab Trail: Started");

    function getSearchQuery(): string {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("q") || "";
    }

    function detectMeaningSearch(
      query: string
    ): { word: string; language: string } | null {
      const trimmedQuery = query.trim();

      // English: "word meaning"
      if (trimmedQuery.toLowerCase().endsWith(" meaning")) {
        const word = trimmedQuery.replace(/ meaning$/i, "").trim();
        if (word) {
          return { word, language: "en" };
        }
      }

      // German: "word bedeutung"
      if (trimmedQuery.toLowerCase().endsWith(" bedeutung")) {
        const word = trimmedQuery.replace(/ bedeutung$/i, "").trim();
        if (word) {
          return { word, language: "de" };
        }
      }

      return null;
    }

    async function checkAndSave() {
      const query = getSearchQuery();
      const searchResult = detectMeaningSearch(query);

      if (searchResult) {
        const { word, language } = searchResult;

        const entry = {
          word: word,
          fullQuery: query,
          timestamp: new Date().toISOString(),
          language: language,
        };

        // Get existing words
        const result = await browser.storage.local.get(["savedMeanings"]);
        const savedWords = result.savedMeanings || [];

        // Check if word already exists (case-insensitive)
        const exists = savedWords.some(
          (item: { word: string }) =>
            item.word.toLowerCase() === word.toLowerCase()
        );

        if (!exists) {
          savedWords.unshift(entry);
          await browser.storage.local.set({ savedMeanings: savedWords });
          console.log(`Vocab Trail: Saved ${language} word:`, word);
        }
      }
    }

    // Check when page loads
    checkAndSave();

    // Listen for URL changes (better approach)
    window.addEventListener("popstate", () => {
      setTimeout(checkAndSave, 500);
    });

    // Watch for DOM changes (for single-page app navigation)
    const observer = new MutationObserver(() => {
      checkAndSave();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
});
