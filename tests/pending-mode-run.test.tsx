import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PendingModeRun } from "@/components/pending-mode-run";
import type { PolyviseRecord } from "@/lib/run-record";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

it.each(["consensus", "advisory_panel"] as const)(
  "keeps %s identity and recovers transport interruptions",
  async (mode) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    let stream!: EventTarget & { close: ReturnType<typeof vi.fn> };
    vi.stubGlobal(
      "EventSource",
      class extends EventTarget {
        close = vi.fn();
        constructor() {
          super();
          stream = this;
        }
      },
    );
    router.refresh.mockClear();
    const host = document.createElement("div");
    const root = createRoot(host);
    const record: PolyviseRecord = {
      id: "pending-test",
      subject: "How should we introduce AI support?",
      resolution: "Legacy debate framing",
      mode,
      evidence: "cited",
      status: "queued",
      createdAt: "2026-09-08T12:00:00Z",
      updatedAt: "2026-09-08T12:00:00Z",
      topicKind: "decision",
      highStakes: null,
      productNotes: [],
      followups: [],
    };
    try {
      await act(async () => root.render(<PendingModeRun record={record} />));
      expect(host.querySelector("h1")?.textContent).toBe(record.subject);
      expect(host.textContent).not.toContain("Debate floor");
      await act(async () =>
        stream.dispatchEvent(
          new MessageEvent("stage", {
            data: JSON.stringify({ status: "debating" }),
          }),
        ),
      );
      expect(host.textContent).toContain(
        mode === "consensus"
          ? "Comparing independent perspectives"
          : "Gathering advice from each lens",
      );
      await act(async () => stream.dispatchEvent(new Event("error")));
      expect(stream.close).not.toHaveBeenCalled();
      expect(host.textContent).toContain("Reconnecting");
      await act(async () => stream.dispatchEvent(new Event("open")));
      expect(host.textContent).not.toContain("Reconnecting");
      await act(async () => stream.dispatchEvent(new MessageEvent("complete")));
      expect(stream.close).toHaveBeenCalled();
      expect(router.refresh).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
      vi.unstubAllGlobals();
    }
  },
);
