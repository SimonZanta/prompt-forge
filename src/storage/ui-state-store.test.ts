import { describe, expect, test } from "bun:test";
import { RAIL_DEFAULT, RAIL_MAX, RAIL_MIN, clampRailWidth, normalizeHex, parseUiState } from "./ui-state-store.ts";

describe("normalizeHex", () => {
  test("accepts six-digit hex with or without # and uppercases it", () => {
    expect(normalizeHex("#4c8df5")).toBe("#4C8DF5");
    expect(normalizeHex("4C8DF5")).toBe("#4C8DF5");
    expect(normalizeHex("  #abcdef ")).toBe("#ABCDEF");
  });
  test("rejects anything else", () => {
    for (const bad of ["#fff", "#4C8DF", "#4C8DF5A", "blue", "", "#GGGGGG"]) expect(normalizeHex(bad)).toBeNull();
  });
});

describe("parseUiState", () => {
  test("defaults when the document is missing or corrupted", () => {
    expect(parseUiState(null)).toEqual({ version: 1, railWidth: RAIL_DEFAULT, accent: "#4C8DF5" });
    expect(parseUiState("{not json")).toEqual(parseUiState(null));
    expect(parseUiState('"a string"')).toEqual(parseUiState(null));
  });
  test("each field falls back on its own", () => {
    expect(parseUiState('{"railWidth":300,"accent":"nope"}')).toEqual({ version: 1, railWidth: 300, accent: "#4C8DF5" });
    expect(parseUiState('{"railWidth":"wide","accent":"#112233"}')).toEqual({ version: 1, railWidth: RAIL_DEFAULT, accent: "#112233" });
  });
  test("clamps the rail width", () => {
    expect(parseUiState('{"railWidth":10}').railWidth).toBe(RAIL_MIN);
    expect(parseUiState('{"railWidth":9999}').railWidth).toBe(RAIL_MAX);
    expect(clampRailWidth(200.6)).toBe(201);
  });
});
