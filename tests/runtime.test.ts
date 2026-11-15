import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startDebate } from "@/server/debate-store";
import { installFakeApi } from "./helpers/fake-api";

beforeEach(() => {
  installFakeApi();
});
afterEach(() => vi.unstubAllGlobals());

describe("Polyvise application runtime", () => {
  it("runs the engine through the Polyvise API and stores the result", async () => {
    const { debate, completion } = await startDebate({
      subject: "Should schools have longer recess?"
    });

    expect(debate.status).toBe("queued");
    await expect(completion).resolves.toMatchObject({
      status: "complete"
    });
  });
});
