<script lang="ts">
  import { postContext } from './post-context'

  // Read only the likes count for display if needed
  const likes = postContext.selectModelData((p) => p?.likes ?? 0)

  // Bind actions during component init (avoid getContext in events)
  const { updateModelData } = postContext.useModelActions()

  // Update via updateModelData (child component mutation)
  const like = () => {
    updateModelData((prev) =>
      prev ? { ...prev, likes: prev.likes + 1 } : prev,
    )
  }
</script>

<button class="like-button" on:click={like}>Like ({$likes})</button>

<style>
  .like-button {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid #0f172a;
    background: #0f172a;
    color: #ffffff;
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }

  .like-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 16px rgba(15, 23, 42, 0.2);
  }
</style>
