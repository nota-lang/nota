import * as common from "@nota-lang/nota-common";

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
    common.joinRecursive
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
    common.addBetween
  );
});
