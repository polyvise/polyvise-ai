import { describe, expect, it } from "vitest";
import { startDebate } from "@/server/debate-store";

describe("Polyvise application runtime", () => {
  it("runs the core engine through the app-owned service boundary", async () => {
    const { debate, completion } = await startDebate({
      subject: "Should schools have longer recess?"
    });

    expect(debate.status).toBe("queued");
    await expect(completion).resolves.toMatchObject({
      status: "complete"
    });
  });
});
