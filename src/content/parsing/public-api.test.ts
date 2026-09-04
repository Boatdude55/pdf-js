import { describe, expect, it } from "vitest";

import {
  ContentStreamParser,
  isParsedOperation,
} from "#src/index";

const encode = (value: string) => new TextEncoder().encode(value);

describe("public content-stream parsing API", () => {
  it("exports ContentStreamParser from the package root", () => {
    const parser = new ContentStreamParser(
      encode("10 20 m 100 20 l 100 80 l S"),
    );

    const { operations, warnings } = parser.parse();

    expect(warnings).toEqual([]);
    expect(operations.map((operation) => operation.operator)).toEqual([
      "m",
      "l",
      "l",
      "S",
    ]);

    const moveTo = operations[0];

    expect(isParsedOperation(moveTo)).toBe(true);

    if (isParsedOperation(moveTo)) {
      expect(moveTo.operands).toEqual([
        { type: "number", value: 10 },
        { type: "number", value: 20 },
      ]);
    }
  });
});
