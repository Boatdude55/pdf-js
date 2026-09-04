import {
  type AnyOperation,
  ContentStreamParser,
  isParsedOperation,
  PDF,
  PdfArray,
  PdfDict,
  PdfName,
  PdfStream,
} from "#src/index";
import { describe, expect, it } from "vitest";

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("PDFPage low-level reading API", () => {
  describe("getEffectiveResources", () => {
    it("returns page-local resources first", () => {
      const pdf = PDF.create();
      const page = pdf.addPage();
      const localResources = page.dict.get("Resources");

      expect(page.getEffectiveResources()).toBe(localResources);
    });

    it("returns inherited resources without modifying the page", () => {
      const pdf = PDF.create();
      const page = pdf.addPage();
      const resolve = pdf.getObject.bind(pdf);
      const parent = page.dict.get("Parent", resolve);
      const inheritedResources = PdfDict.of({
        Marker: PdfName.of("Inherited"),
      });

      expect(parent).toBeInstanceOf(PdfDict);

      if (!(parent instanceof PdfDict)) {
        throw new Error("Expected the page Parent to resolve to a PdfDict");
      }

      parent.set("Resources", inheritedResources);
      page.dict.delete("Resources");
      page.dict.clearDirty();
      parent.clearDirty();

      expect(page.getEffectiveResources()).toBe(inheritedResources);
      expect(page.dict.has("Resources")).toBe(false);
      expect(page.dict.dirty).toBe(false);
      expect(parent.dirty).toBe(false);
    });

    it("returns undefined without creating resources when none are present", () => {
      const pdf = PDF.create();
      const page = pdf.addPage();
      const resolve = pdf.getObject.bind(pdf);
      const parent = page.dict.get("Parent", resolve);

      expect(parent).toBeInstanceOf(PdfDict);

      if (!(parent instanceof PdfDict)) {
        throw new Error("Expected the page Parent to resolve to a PdfDict");
      }

      page.dict.delete("Resources");
      parent.delete("Resources");
      page.dict.clearDirty();
      parent.clearDirty();

      expect(page.getEffectiveResources()).toBeUndefined();
      expect(page.dict.has("Resources")).toBe(false);
      expect(page.dict.dirty).toBe(false);
      expect(parent.dirty).toBe(false);
    });
  });

  describe("iterateContentOperations", () => {
    it("iterates parsed operations from the decoded page contents", () => {
      const pdf = PDF.create();
      const page = pdf.addPage();
      const content = encode("10 20 m 100 20 l 100 80 l S");

      page.dict.set("Contents", new PdfStream(undefined, content));

      const operations: AnyOperation[] = [...page.iterateContentOperations()];

      expect(operations.map(operation => operation.operator)).toEqual([
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

    it("exposes ContentStreamParser from the package root", () => {
      const operations = [...new ContentStreamParser(encode("0 0 10 20 re S"))];

      expect(operations.map(operation => operation.operator)).toEqual(["re", "S"]);
    });

    it("preserves execution order across multiple content streams", () => {
      const pdf = PDF.create();
      const page = pdf.addPage();

      page.dict.set(
        "Contents",
        new PdfArray([
          new PdfStream(undefined, encode("q 10 20 m")),
          new PdfStream(undefined, encode("100 20 l S Q")),
        ]),
      );

      const operations = [...page.iterateContentOperations()];

      expect(operations.map(operation => operation.operator)).toEqual([
        "q",
        "m",
        "l",
        "S",
        "Q",
      ]);
    });
  });
});
