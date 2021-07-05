import esbuild from 'esbuild';
import {sassPlugin} from "esbuild-sass-plugin";
import {program} from 'commander';

program.option('-w, --watch');
program.parse(process.argv);
const options = program.opts();

await esbuild.build({
    entryPoints: ['src/app.tsx'],
    bundle: true,
    watch: options.watch,
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