const esbuild = require('esbuild');
const {sassPlugin} = require("esbuild-sass-plugin");
const {program} = require('commander');
const pkg = require("./package.json");

program.option('-w, --watch');
program.parse(process.argv);
const options = program.opts();

esbuild.build({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    sourcemap: true,
    // minify: true,
    minify: false,
    watch: options.watch,
    format: 'cjs',
    loader: {
        '.otf': 'file',
        '.woff': 'file',
        '.woff2': 'file',
        '.ttf': 'file',
    },
    outdir: 'dist',
    external: Object.keys(pkg.peerDependencies),
    plugins: [sassPlugin()],
});
