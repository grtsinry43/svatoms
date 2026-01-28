# svatoms

Svelte's utilities for model data flow: provide a model once, then consume slices of it anywhere with minimal updates. The API mirrors the idea of React Jotai “provider + selector”, but uses Svelte context + stores instead of React providers.

## Install

```bash
pnpm add svatoms
```

## Why this exists

Inspired by [Jojoo](https://github.com/Innei/jojoo) and [Shiro](https://github.com/Innei/Shiro), I wanted a Svelte-native way to handle complex model data flow with:

- a single entry point (one SSR `load()` result)
- minimal-granularity reads via selectors
- centralized business data to avoid scattered requests

svatoms keeps it idiomatic to Svelte:

- use Svelte `setContext/getContext` instead of provider components
- use Svelte stores instead of hooks
- keep SSR-safe local scope by default
- allow optional global sharing

## The exact problem this solves (SvelteKit version)

Typical SvelteKit pain points:

- `load()` data needs to be used across many layers
- prop-drilling becomes noisy quickly 😭
- many components only need tiny fields, but full models trigger extra updates

`svatoms` maps the pattern into SvelteKit cleanly:

- **single entry**: call `mountModelData` once in `+page.svelte` or `+layout.svelte`
- **minimal slices**: child components use `selectModelData` for only useful fields
- **no scattered fetching**: all data comes from `load()`

Minimal SvelteKit wiring:

```ts
// src/routes/posts/[slug]/+page.server.ts
export const load = async ({ params }) => {
  const post = await fetchPost(params.slug)
  return { post }
}
```

```ts
// src/lib/post-context.ts
import { createModelDataContext } from 'svatoms'

export type Post = {
  title: string
  likes: number
  // ...
}

export const postContext = createModelDataContext<Post>({ name: 'post' })
```

```svelte
<!-- src/routes/posts/[slug]/+page.svelte -->
<script lang="ts">
  import { postContext } from '$lib/post-context'
  let { data } = $props()

  const postStore = postContext.mountModelData(data.post)
  $effect(() => {
    // Sync on client-side navigation when only data changes.
    postContext.syncModelData(postStore, data.post)
  })
</script>

<slot />
```

```svelte
<!-- Any child component -->
<script lang="ts">
  import { postContext } from '$lib/post-context'

  const title = postContext.selectModelData((p) => p?.title ?? '')
  const likeCount = postContext.selectModelData((p) => p?.likes ?? 0)
</script>

<h1>{$title}</h1>
<span>{$likeCount}</span>
```

If you want the model to survive nested route changes, mount it in `+layout.svelte` instead of `+page.svelte`.

When the model data changes (e.g. user likes a post), use `setModelData` or `updateModelData` to update it in one place, and all selectors will update accordingly.

**Important: context usage in event handlers**

`getContext(...)` can **only** be called during component initialization. That means calling
`setModelData / updateModelData / getModelData` directly inside event handlers will throw.

Bind actions once during initialization, then use them in events:

```svelte
<script lang="ts">
  import { postContext } from '$lib/post-context'

  const { updateModelData } = postContext.useModelActions() // don't forget this!

  const like = () => {
    updateModelData((prev) =>
      prev ? { ...prev, likes: prev.likes + 1 } : prev
    )
  }
</script>
```

## SvelteKit data flow (SSR → UI)

**1) Load data on the server**

```ts
// +page.server.ts
export const load = async ({ params }) => {
  const post = await fetchPost(params.slug)
  return { post }
}
```

**2) Provide the model once**

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { postContext } from '$lib/post-context'
  let { data } = $props()

  const postStore = postContext.mountModelData(data.post)
  $effect(() => {
    // Sync on client-side navigation when only data changes.
    postContext.syncModelData(postStore, data.post)
  })
</script>

<slot />
```

Why sync? On SvelteKit client-side navigation, the component may stay mounted while only `data` changes, so you need `$effect` to push the new model into the store.

**3) Select slices anywhere**

```svelte
<script lang="ts">
  import { postContext } from '$lib/post-context'

  const meta = postContext.selectModelData((p) => ({
    title: p?.title,
    likes: p?.likes ?? 0,
  }))
</script>

<h1>{$meta.title}</h1>
<p>Likes: {$meta.likes}</p>
```

**4) Update the model from anywhere**

```svelte
<script lang="ts">
  import { postContext } from '$lib/post-context'

  const { updateModelData } = postContext.useModelActions()

  const like = () => {
    updateModelData((prev) =>
      prev ? { ...prev, likes: prev.likes + 1 } : prev
    )
  }
</script>

<button onclick={like}>Like</button>
```

## Plain Svelte usage

```svelte
<script lang="ts">
  import { createModelDataContext } from 'svatoms'

  type User = { id: string; name: string; role: string }
  const userContext = createModelDataContext<User>({ name: 'user' })

  let user = $state<User>({ id: '1', name: 'Ada', role: 'admin' })

  const userStore = userContext.mountModelData(user)
  $effect(() => {
    userContext.syncModelData(userStore, user)
  })

  const { updateModelData } = userContext.useModelActions()

  const name = userContext.selectModelData((u) => u?.name ?? 'Unknown')

  // Update user name
  const rename = () => {
    updateModelData((prev) =>
      prev ? { ...prev, name: 'Grace Hopper' } : prev
    )
  }
</script>

<p>User: {$name}</p>
```

## API

### `createModelDataContext<Model>(options?)`

Create a context manager for a specific model type.

**Options**

- `name?: string` – used to label the internal symbol (for debugging)
- `key?: symbol` – custom context key (advanced)
- `initial?: Model | null` – initial value for the global store
- `defaultScope?: 'local' | 'global'` – default store scope

**Returns**

- `provideModelData(data, opts?)`
  - Set context + write initial data (no auto cleanup)
- `mountModelData(data, opts?)`
  - Same as `provideModelData`, but resets to `null` on destroy
- `provideModelStore(store)`
  - Inject a custom store directly
- `useModelStore(fallback?)`
  - Get the current store (default fallback is global)
- `useModelActions()`
  - Bind store actions during component initialization (safe for events)
- `selectModelData(selector, opts?)`
  - Create a derived store from a selector
- `setModelData(value)` / `updateModelData(fn)` / `getModelData()`
  - Convenience helpers for the current store
- `setGlobalModelData(valueOrUpdater)` / `getGlobalModelData()`
  - Global store helpers
- `syncModelData(store, data)`
  - Explicitly push new data into a store

### `selectModelData` options

```ts
selectModelData(selector, {
  equals?: (a, b) => boolean // default: Object.is
})

// selector: (model: Model | null) => Result
```

Use `equals` to avoid re-renders when your selector returns derived objects.

## Local vs global scope

- **local** (default): data is scoped to the component tree that called `mountModelData`. This is SSR-safe.
- **global**: data is shared across the whole app, similar to a singleton store.

You can override per call:

```ts
postContext.mountModelData(data.post, { scope: 'global' })
```

## Notes

- Call `mountModelData` during component initialization (top-level of `<script>`), not inside functions.
- Svelte 5 runes mode uses `$effect`; in Svelte 4 you can use `$:` instead.
- Use `syncModelData` or `store.set()` if your `data` can change after navigation.

## License

MIT License © 2026 grtsinry43
