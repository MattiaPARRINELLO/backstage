import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";

import { dataPath, getDataDir, setDataDir } from "../storage-core";

describe("repertoire de donnees", () => {
  afterEach(() => setDataDir(null));

  it("suit la redirection posee par setDataDir", () => {
    setDataDir("/tmp/backstage-data-test");

    expect(getDataDir()).toBe(path.resolve("/tmp/backstage-data-test"));
    expect(dataPath("users.json")).toBe(
      path.join(path.resolve("/tmp/backstage-data-test"), "users.json")
    );
  });

  it("retombe sur <cwd>/data sans redirection", () => {
    setDataDir(null);

    expect(getDataDir()).toBe(path.join(process.cwd(), "data"));
    expect(dataPath("reminders.json")).toBe(
      path.join(process.cwd(), "data", "reminders.json")
    );
  });
});
