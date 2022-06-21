# 1. Clone source-map repo
# 2. pnpm install
# 3. Replace whatwg-url shim with just window.URL
# 4. Then run:

esbuild --bundle --format=esm source-map.js > $NOTA_DIR/packages/nota-editor/lib/source-map.js
