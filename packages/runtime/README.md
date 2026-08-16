# @nota-lang/runtime — MOTHBALLED (this branch)

The Solid specialization (design/solid.md) removed this package from every emit and dependency
edge: the vnode model, `▸` flag, adapter, decode pipeline (struct/serialize), islands + replay
hydration, mark/query doc-state, and the registry are all superseded by `@nota-lang/solid`
(Reforest + the doc-state store) and plain Solid SSR/hydration.

It stays **buildable, in the workspace** for one reason: the language server's generated typing
preamble (`packages/language-server/scripts/gen-preamble.ts`) derives from this package's built
`.d.ts`, and the virtual `.tsx` emit still types the h-call surface until reader vNext emits JSX
natively. When that lands (design/solid.md §Follow-ups), delete this package.
