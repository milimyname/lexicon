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
        savedWords = newWords;

        const latestWord = newWords[0];
        if (!latestWord) return;

        try {
          const response = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/${latestWord.language}/${latestWord.word}`
          );

          let dictionaryapi = null;
          if (response.ok) {
            dictionaryapi = await response.json();
          }

          await supabase.from("words").upsert(
            {
              word: latestWord.word,
              language: latestWord.language,
              full_query: latestWord.fullQuery,
              timestamp: latestWord.timestamp,
              dictionaryapi,
            },
            { ignoreDuplicates: false }
          );

          // Refresh data from database
          const { data } = await supabase
            .from("words")
            .select("*")
            .order("created_at", { ascending: false });
          savedWords = data || [];
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
          <div class="dictionary-content">
            {#each entry.dictionaryapi as dictEntry}
              <div class="dict-entry">
                <!-- Phonetics -->
                {#if dictEntry.phonetic || dictEntry.phonetics?.length}
                  <div class="phonetics">
                    <strong>Pronunciation:</strong>
                    {#if dictEntry.phonetic}
                      <span class="phonetic-text">{dictEntry.phonetic}</span>
                    {/if}
                    {#if dictEntry.phonetics}
                      {#each dictEntry.phonetics as phonetic}
                        {#if phonetic.text}
                          <span class="phonetic-text">{phonetic.text}</span>
                        {/if}
                        {#if phonetic.audio}
                          <button
                            onclick={() => playPronunciation(phonetic.audio!)}
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
                {#if dictEntry.meanings}
                  {#each dictEntry.meanings as meaning}
                    <div class="meaning">
                      <h4 class="part-of-speech">{meaning.partOfSpeech}</h4>
                      {#each meaning.definitions as definition}
                        <div class="definition">
                          <p>
                            <strong>Definition:</strong>
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
                    </div>
                  {/each}
                {/if}
              </div>
            {/each}
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
    padding: 20px;
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
    padding: 16px;
    border-radius: 6px;
    margin-bottom: 12px;
  }

  .phonetics {
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .phonetic-text {
    background: #e0e7ff;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }

  .audio-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 2px;
  }

  .audio-btn:hover {
    transform: scale(1.1);
  }

  .origin {
    margin-bottom: 12px;
    color: #4b5563;
    font-style: italic;
  }

  .meaning {
    margin-bottom: 16px;
  }

  .part-of-speech {
    color: #059669;
    font-size: 1rem;
    margin-bottom: 8px;
    text-transform: capitalize;
  }

  .definition {
    margin-bottom: 12px;
    padding-left: 16px;
  }

  .example {
    color: #6b7280;
    margin-top: 4px;
  }

  .synonyms,
  .antonyms {
    margin-top: 4px;
    font-size: 0.875rem;
  }

  .synonyms {
    color: #059669;
  }

  .antonyms {
    color: #dc2626;
  }

  .empty-state {
    text-align: center;
    color: #6b7280;
    font-style: italic;
    padding: 40px 20px;
  }
</style>
