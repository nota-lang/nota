import * as cp from "child_process";
import os from "os";
import fs from "fs/promises";
import path from "path";
import util from "util";
import http from "http";

let exec = util.promisify(cp.exec);
let nota_path = path.join(process.cwd(), "packages", "nota", "dist", "nota.mjs");

let dir: string;
let input_path: string;
beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "nota-"));
  input_path = path.join(dir, "index.nota");
  await fs.writeFile(input_path, `@h1{Hello world}`);

  let mod_path = path.join(process.cwd(), "packages", "nota");
  await exec(`yarn add ${mod_path}`, { cwd: dir });
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true });
});

jest.setTimeout(30 * 1000);

test("nota-cli-builder", async () => {
  await exec(`node ${nota_path} build index.nota`, { cwd: dir });
  let html_path = path.join(dir, "dist", "index.html");
  let contents = await fs.readFile(html_path, "utf-8");
  expect(contents).toMatchSnapshot();
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
