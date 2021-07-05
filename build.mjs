import esbuild from 'esbuild';
import {sassPlugin} from "esbuild-sass-plugin";

await esbuild.build({
    entryPoints: ['src/app.tsx'],
    bundle: true,
    watch: true,
    sourcemap: true,
    loader: {
        '.otf': 'file',
        '.woff': 'file',
        '.woff2': 'file',
        '.ttf': 'file',
        '.bib': 'text'
    },
    outfile: 'static/build/app.js',
    plugins: [sassPlugin()],
});