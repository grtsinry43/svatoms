<script lang="ts">
  import LikeButton from './LikeButton.svelte'
  import { postContext } from './post-context'

  let renameCount = $state(0)

  // Initial model data (only used to mount once).
  const initialPost = {
    id: 1,
    title: 'Hello Svatoms',
    likes: 0,
  }

  // Mount once: put the model into context (single data source = store).
  postContext.mountModelData(initialPost)

  // Select only the fields each component needs.
  const title = postContext.selectModelData((p) => p?.title ?? 'Untitled')
  const likes = postContext.selectModelData((p) => p?.likes ?? 0)
  const post = postContext.selectModelData((p) => p)

  const { getModelData, setModelData } = postContext.useModelActions()

  // Rename by directly setting the data source (store).
  const rename = () => {
    renameCount += 1
    const current = getModelData()
    if (!current) return
    setModelData({
      ...current,
      title: `Hello Svatoms ${renameCount}`,
    })
  }
</script>

<main>
  <h1>svatoms playground</h1>

  <section class="card">
    <h2>Current Post</h2>
    <p class="value">{$title}</p>
    <p class="sub">Likes: {$likes}</p>
    <div class="actions">
      <LikeButton />
      <button onclick={rename}>Rename</button>
    </div>
  </section>

  <section class="card">
    <h2>Raw Data (from store)</h2>
    <pre>{JSON.stringify($post, null, 2)}</pre>
  </section>
</main>

<style>
  main {
    padding: 2rem;
    max-width: 720px;
    margin: 0 auto;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      sans-serif;
    color: #1b1b1b;
  }

  h1 {
    font-size: 2rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
  }

  .card {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    background: #ffffff;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  }

  .value {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0.5rem 0;
  }

  .sub {
    color: #475569;
    margin-bottom: 1rem;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid #0f172a;
    background: #0f172a;
    color: white;
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }

  button:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 16px rgba(15, 23, 42, 0.2);
  }

  pre {
    margin: 0;
    background: #0f172a;
    color: #e2e8f0;
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
  }
</style>
