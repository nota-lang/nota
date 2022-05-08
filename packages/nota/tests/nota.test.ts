import * as cp from "child_process";
import fs from "fs/promises";
import http from "http";
import os from "os";
import path from "path";
import util from "util";

let exec = util.promisify(cp.exec);
let notaPath = path.join(process.cwd(), "packages", "nota", "dist", "index.mjs");

let dir: string;
let inputPath: string;
beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "nota-"));
  inputPath = path.join(dir, "index.nota");
  await fs.writeFile(inputPath, `@h1{Hello world}`);

  let modPath = path.join(process.cwd(), "packages", "nota");
  await exec(`yarn add ${modPath}`, { cwd: dir });
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true });
});

jest.setTimeout(30 * 1000);

// TODO: figure out how to make installation symlink to all @nota-lang dependencies

test("nota-cli-builder", async () => {
  // await exec(`node ${notaPath} build index.nota`, { cwd: dir });
  // let htmlPath = path.join(dir, "dist", "index.html");
  // let contents = await fs.readFile(htmlPath, "utf-8");
  // expect(contents).toMatchSnapshot();
});



// test("nota-cli-server", async () => {
//   let p = cp.spawn(`node ${nota_path} edit index.nota --port 8765`, { cwd: dir, shell: true });
//   let once = (k: string) =>
//     new Promise(resolve => {
//       p.once(k, resolve);
//     });

//   await once("spawn");

//   // TODO: figure out http
//   // await new Promise(resolve =>
//   //   http.request(
//   //     {
//   //       hostname: "localhost",
//   //       port: 8765,
//   //     },
//   //     resolve
//   //   )
//   // );

//   p.kill('SIGINT');

//   await once("exit");
// });
