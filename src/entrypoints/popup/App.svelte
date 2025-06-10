<script lang="ts">
  import { supabase } from "@/lib/supabase";

  interface DictionaryEntry {
    word: string;
    phonetic?: string;
    phonetics?: Array<{
      text?: string;
      audio?: string;
    }>;
    meanings?: Array<{
      partOfSpeech: string;
      definitions: Array<{
        definition: string;
        example?: string;
        synonyms?: string[];
        antonyms?: string[];
      }>;
    }>;
    origin?: string;
  }

  interface WordEntry {
    id?: number;
    word: string;
    fullQuery?: string;
    full_query?: string;
    timestamp: string;
    language?: string;
    dictionaryapi?: DictionaryEntry[];
  }

  let savedWords = $state<WordEntry[]>([]);
  let expandedWords = $state<Set<number>>(new Set());

  // Load initial data
  $effect(() => {
    (async () => {
      const result = await browser.storage.local.get(["savedMeanings"]);

      if (!result?.savedMeanings || result?.savedMeanings.length === 0) {
        const { data } = await supabase
          .from("words")
          .select("*")
          .order("created_at", { ascending: false });
        savedWords = data || [];
        return;
      }
      savedWords = result.savedMeanings || [];
    })();
  });

  // Listen for storage changes to update in real-time
  $effect(() => {
    const handleStorageChange = async (changes: any, areaName: string) => {
      if (areaName === "local" && changes.savedMeanings) {
        const newWords = changes.savedMeanings.newValue || [];

        const latestWord = newWords[0];
        if (!latestWord) return;

        try {
          const response = await fetch(
            import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ word: latestWord.word }),
            }
          );

          let dictionaryapi = null;
          if (response.ok) dictionaryapi = await response.json();

          const { data: insertedData } = await supabase
            .from("words")
            .insert({
              word: latestWord.word,
              language: latestWord.language,
              full_query: latestWord.fullQuery,
              timestamp: latestWord.timestamp,
              dictionaryapi,
            })
            .select("*");
          savedWords = [...insertedData, ...savedWords] || [];
        } catch (error) {
          console.error("Error processing word data:", error);
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  });

  const clearAll = async () => {
    savedWords = [];
    await browser.storage.local.clear();
  };

  const toggleExpanded = (wordId: number) => {
    if (expandedWords.has(wordId)) {
      expandedWords.delete(wordId);
    } else {
      expandedWords.add(wordId);
    }
    expandedWords = new Set(expandedWords);
  };

  const playPronunciation = (audioUrl: string) => {
    const audio = new Audio(audioUrl);
    audio.play().catch(console.error);
  };
</script>

<div class="vocab-trail">
  <h2>Vocab Trail</h2>

  <p>Words saved: {savedWords.length}</p>

  {#if savedWords.length > 0}
    <button onclick={clearAll} class="clear-btn">Clear All Local Data</button>
  {/if}

  <div class="words-list">
    {#each savedWords as entry}
      <div class="word-entry">
        <div class="word-header">
          <div class="word-info">
            <strong class="word-title">{entry.word}</strong>
            {#if entry.language}
              <span class="language-tag">{entry.language.toUpperCase()}</span>
            {/if}
            {#if entry.fullQuery || entry.full_query}
              <span class="full-query"
                >({entry.fullQuery || entry.full_query})</span
              >
            {/if}
          </div>
          {#if entry.id && entry.dictionaryapi}
            <button
              onclick={() => toggleExpanded(entry.id!)}
              class="expand-btn"
            >
              {expandedWords.has(entry.id) ? "▼" : "▶"} Dictionary
            </button>
          {/if}
        </div>

        <small class="timestamp"
          >{new Date(entry.timestamp).toLocaleString()}</small
        >

        {#if entry.id && entry.dictionaryapi && expandedWords.has(entry.id)}
          {@const dictEntry =
            typeof entry.dictionaryapi === "string"
              ? JSON.parse(entry.dictionaryapi)
              : entry.dictionaryapi}
          <div class="dictionary-content">
            <div class="dict-entry">
              <!-- Word Title -->
              <div class="word-display">
                <h3>{dictEntry.word}</h3>
              </div>

              <!-- Phonetics -->
              {#if dictEntry.phonetic || dictEntry.phonetics?.length}
                <div class="phonetics">
                  <strong>Pronunciation:</strong>
                  {#if dictEntry.phonetic}
                    <span class="phonetic-text">{dictEntry.phonetic}</span>
                  {/if}
                  {#if dictEntry.phonetics?.length}
                    {#each dictEntry.phonetics as phonetic}
                      {#if phonetic.text}
                        <span class="phonetic-text">{phonetic.text}</span>
                      {/if}
                      {#if phonetic.audio && phonetic.audio !== ""}
                        <button
                          onclick={() => playPronunciation(phonetic.audio)}
                          class="audio-btn"
                          title="Play pronunciation"
                        >
                          🔊
                        </button>
                      {/if}
                    {/each}
                  {/if}
                </div>
              {/if}

              <!-- Origin -->
              {#if dictEntry.origin}
                <div class="origin">
                  <strong>Origin:</strong>
                  {dictEntry.origin}
                </div>
              {/if}

              <!-- Meanings -->
              {#if dictEntry.meanings?.length}
                <div class="meanings-container">
                  {#each dictEntry.meanings as meaning, meaningIndex}
                    <div class="meaning">
                      <h4 class="part-of-speech">
                        {meaningIndex + 1}. {meaning.partOfSpeech}
                      </h4>

                      {#if meaning.definitions?.length}
                        {#each meaning.definitions as definition, defIndex}
                          <div class="definition">
                            <p class="definition-text">
                              <span class="def-number">{defIndex + 1}.</span>
                              {definition.definition}
                            </p>

                            {#if definition.example}
                              <p class="example">
                                <em>Example: "{definition.example}"</em>
                              </p>
                            {/if}

                            {#if definition.synonyms?.length}
                              <p class="synonyms">
                                <strong>Synonyms:</strong>
                                {definition.synonyms.join(", ")}
                              </p>
                            {/if}

                            {#if definition.antonyms?.length}
                              <p class="antonyms">
                                <strong>Antonyms:</strong>
                                {definition.antonyms.join(", ")}
                              </p>
                            {/if}
                          </div>
                        {/each}
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="no-meanings">
                  <p>No detailed meanings available</p>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if savedWords.length === 0}
    <p class="empty-state">
      No words saved yet. Search for "word meaning" or "wort bedeutung" to
      start!
    </p>
  {/if}
</div>

<style>
  .vocab-trail {
    max-width: 800px;
    margin: 0 auto;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }

  .clear-btn {
    background: #ef4444;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 20px;
  }

  .clear-btn:hover {
    background: #dc2626;
  }

  .words-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .word-entry {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    background: white;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .word-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .word-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .word-title {
    font-size: 1.25rem;
    color: #1f2937;
  }

  .language-tag {
    background: #3b82f6;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: bold;
  }

  .full-query {
    color: #6b7280;
    font-style: italic;
  }

  .expand-btn {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  .expand-btn:hover {
    background: #e5e7eb;
  }

  .timestamp {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .dictionary-content {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
  }

  .dict-entry {
    background: #f8fafc;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .word-display h3 {
    margin: 0 0 16px 0;
    color: #1e293b;
    font-size: 1.5rem;
    text-transform: capitalize;
  }

  .phonetics {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .phonetic-text {
    background: #e0e7ff;
    color: #3730a3;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: monospace;
    font-weight: 500;
  }

  .audio-btn {
    background: #f0f9ff;
    border: 1px solid #0ea5e9;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    padding: 4px 6px;
    transition: all 0.2s;
  }

  .audio-btn:hover {
    background: #0ea5e9;
    transform: scale(1.1);
  }

  .origin {
    margin-bottom: 16px;
    padding: 12px;
    background: #fef7cd;
    border-left: 4px solid #f59e0b;
    border-radius: 4px;
    color: #92400e;
    font-style: italic;
  }

  .meanings-container {
    margin-top: 16px;
  }

  .meaning {
    margin-bottom: 20px;
    padding: 16px;
    background: white;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .part-of-speech {
    color: #059669;
    font-size: 1.1rem;
    margin: 0 0 12px 0;
    text-transform: capitalize;
    font-weight: 600;
  }

  .definition {
    margin-bottom: 16px;
    padding: 12px;
    background: #f8fafc;
    border-radius: 4px;
    border-left: 3px solid #0ea5e9;
  }

  .definition-text {
    margin: 0 0 8px 0;
    line-height: 1.6;
  }

  .def-number {
    font-weight: 600;
    color: #0ea5e9;
    margin-right: 8px;
  }

  .example {
    color: #64748b;
    margin: 8px 0;
    padding: 8px;
    background: #f1f5f9;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .synonyms,
  .antonyms {
    margin: 8px 0;
    font-size: 0.875rem;
    padding: 6px 8px;
    border-radius: 4px;
  }

  .synonyms {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
  }

  .antonyms {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .no-meanings {
    text-align: center;
    color: #6b7280;
    font-style: italic;
    padding: 20px;
  }

  .empty-state {
    text-align: center;
    color: #6b7280;
    font-style: italic;
    padding: 40px 20px;
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .vocab-trail {
      padding: 16px;
    }

    .word-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .word-info {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
