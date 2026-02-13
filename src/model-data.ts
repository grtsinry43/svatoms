import { getContext, onDestroy, setContext } from 'svelte'
import {
  get,
  readable,
  toStore,
  writable,
  type Readable,
  type Writable,
} from 'svelte/store'

/** Store scope for a model context. */
export type ModelScope = 'local' | 'global'
/** Equality function used by selectors to skip updates. */
export type EqualityFn<T> = (a: T, b: T) => boolean

export interface CreateModelDataOptions<T> {
  /** Custom context key. Use only if you want to share a key across modules. */
  key?: symbol
  /** Debug name for the internal symbol. */
  name?: string
  /** Initial value for the global store. */
  initial?: T | null
  /** Default scope for data provision. */
  defaultScope?: ModelScope
}

export interface ProvideModelDataOptions<T> {
  /** Provide a custom store instead of the default store. */
  store?: Writable<T | null>
  /** Override default scope for this call. */
  scope?: ModelScope
}

export interface MountModelDataOptions<T> extends ProvideModelDataOptions<T> {
  /** Whether to reset to null on component destroy. Default: true. */
  resetOnDestroy?: boolean
}

/** Reactive source for model data. */
export type ModelDataSource<T> = Readable<T | null> | (() => T | null)
/** Value or reactive source for model data. */
export type ModelDataInput<T> = T | null | ModelDataSource<T>
/** `mountModelData` call signatures. */
export interface MountModelDataFn<T> {
  (source: ModelDataSource<T>, opts?: MountModelDataOptions<T>): Writable<T | null>
  /**
   * @deprecated Pass a getter `() => data` or a readable store instead.
   * Static values capture only the initial snapshot in Svelte 5 runes mode.
   */
  (data: T | null, opts?: MountModelDataOptions<T>): Writable<T | null>
}

export interface SelectModelDataOptions<T> {
  /** Equality function for selector result; default: Object.is */
  equals?: EqualityFn<T>
}

const defaultEquals: EqualityFn<any> = Object.is
const isStoreLike = <T>(value: unknown): value is Readable<T> =>
  !!value && typeof value === 'object' && typeof (value as Readable<T>).subscribe === 'function'
const isDataGetter = <T>(value: unknown): value is () => T => typeof value === 'function'

const createSelectorStore = <S, T>(
  source: Readable<S>,
  selector: (value: S) => T,
  equals: EqualityFn<T> = defaultEquals,
): Readable<T> => {
  const initial = selector(get(source))

  return readable(initial, (set) => {
    let prev = initial
    set(prev)

    return source.subscribe((value) => {
      const next = selector(value)
      if (!equals(prev, next)) {
        prev = next
        set(next)
      }
    })
  })
}

/**
 * Create a model data context manager for a specific model type.
 * Provides context wiring + selector helpers in a Svelte-native way.
 */
export const createModelDataContext = <Model>(
  options: CreateModelDataOptions<Model> = {},
) => {
  const key = options.key ?? Symbol(options.name ?? 'model-data')
  const globalStore = writable<Model | null>(options.initial ?? null)

  /** Create a new local store (not shared across the app). */
  const createLocalStore = (initial?: Model | null) =>
    writable<Model | null>(initial ?? null)

  /**
   * Provide model data into context (no auto cleanup).
   * Useful for custom lifecycles or manual cleanup.
   */
  const provideModelData = (
    data: Model | null,
    opts: ProvideModelDataOptions<Model> = {},
  ) => {
    const scope = opts.scope ?? options.defaultScope ?? 'local'
    const store = opts.store ?? (scope === 'global' ? globalStore : createLocalStore())
    setContext(key, store)
    store.set(data)
    return store
  }

  /**
   * Provide model data into context and auto reset on destroy.
   * Accepts a static value, a getter `() => value`, or a readable store.
   * This is the recommended entry point for pages/layouts.
   */
  const mountModelDataImpl = (
    input: ModelDataInput<Model>,
    opts: MountModelDataOptions<Model> = {},
  ) => {
    const source = isStoreLike<Model | null>(input)
      ? input
      : isDataGetter<Model | null>(input)
        ? toStore(input)
        : null
    const initialData: Model | null = source ? null : (input as Model | null)
    const store = provideModelData(initialData, opts)
    const stopSync = source?.subscribe((next) => store.set(next))

    if (opts.resetOnDestroy !== false) {
      onDestroy(() => {
        stopSync?.()
        store.set(null)
      })
    } else if (stopSync) {
      onDestroy(stopSync)
    }
    return store
  }
  const mountModelData = mountModelDataImpl as MountModelDataFn<Model>

  /** Provide an existing store directly into context. */
  const provideModelStore = (store: Writable<Model | null>) => {
    setContext(key, store)
    return store
  }

  /**
   * Get the current context store.
   * Must be called during component initialization.
   */
  const useModelStore = (fallback: 'global' | 'throw' = 'global') => {
    const store = getContext<Writable<Model | null>>(key)
    if (store) return store
    if (fallback === 'throw') {
      throw new Error(
        'Model data context is missing. Call provideModelData/mountModelData in a parent component.',
      )
    }
    return globalStore
  }

  /**
   * Select a slice of the model data as a readable store.
   * Must be called during component initialization.
   */
  const selectModelData = <T>(
    selector: (data: Model | null) => T,
    opts: SelectModelDataOptions<T> = {},
  ) => createSelectorStore(useModelStore(), selector, opts.equals ?? defaultEquals)

  /**
   * Bind store actions during component initialization.
   * Use returned functions inside events to avoid getContext errors.
   */
  const useModelActions = () => {
    const store = useModelStore()
    return {
      store,
      /** Set the model data. */
      setModelData: (value: Model | null) => store.set(value),
      /** Update the model data based on previous value. */
      updateModelData: (updater: (prev: Model | null) => Model | null) =>
        store.update(updater),
      /** Read the current model data synchronously. */
      getModelData: () => get(store),
    }
  }

  /** Set model data on the current context store. */
  const setModelData = (value: Model | null) => {
    useModelStore().set(value)
  }

  /** Update model data on the current context store. */
  const updateModelData = (updater: (prev: Model | null) => Model | null) => {
    useModelStore().update(updater)
  }

  /** Read model data from the current context store. */
  const getModelData = () => get(useModelStore())

  /** Set model data on the global store (bypasses context). */
  const setGlobalModelData = (
    value: Model | null | ((prev: Model | null) => Model | null),
  ) => {
    if (typeof value === 'function') {
      globalStore.update(value as (prev: Model | null) => Model | null)
    } else {
      globalStore.set(value)
    }
  }

  /** Read model data from the global store. */
  const getGlobalModelData = () => get(globalStore)

  /** Push external data into a given store (manual sync). */
  const syncModelData = (store: Writable<Model | null>, data: Model | null) => {
    store.set(data)
  }

  return {
    key,
    globalStore,
    createLocalStore,
    provideModelData,
    mountModelData,
    provideModelStore,
    useModelStore,
    selectModelData,
    useModelActions,
    setModelData,
    updateModelData,
    getModelData,
    setGlobalModelData,
    getGlobalModelData,
    syncModelData,
  }
}
