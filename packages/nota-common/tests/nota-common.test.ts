import * as common from "@nota-lang/nota-common";

let expect_each = (a: [any[], any][], f: (..._i: any[]) => any) =>
  a.forEach(([i, o]) => expect(f(...i)).toStrictEqual(o));

test("join_recursive", () => {
  expect_each(
    [
      [["a"], "a"],
      [[[]], ""],
      [[["a", "b"]], "ab"],
      [[["a", ["b", "c"]]], "abc"],
    ],
    common.join_recursive
  );
});

test("add_between", () => {
  expect_each(
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
    common.add_between
  );
});
