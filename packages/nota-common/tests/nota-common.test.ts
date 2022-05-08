import * as nota_text from "@nota-lang/nota-common/dist/nota-text";

let expectEach = (a: [any[], any][], f: (..._i: any[]) => any) =>
  a.forEach(([i, o]) => expect(f(...i)).toStrictEqual(o));

test("joinRecursive", () => {
  expectEach(
    [
      [["a"], "a"],
      [[[]], ""],
      [[["a", "b"]], "ab"],
      [[["a", ["b", "c"]]], "abc"],
    ],
    nota_text.joinRecursive
  );
});

test("addBetween", () => {
  expectEach(
    [
      [[[], ","], []],
      [[["a"], ","], ["a"]],
      [
        [["a", "b"], ","],
        ["a", ",", "b"],
      ],
      [
        [["a", "b", "c"], ","],
        ["a", ",", "b", ",", "c"],
      ],
    ],
    nota_text.addBetween
  );
});
