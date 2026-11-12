import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/composer";
import { buildRunRequest, modeOrder, parseMode } from "@/lib/mode-guide";
import {
  defaultSelectionsByMode,
  defaultSelectionsForMode,
  modelCatalog,
} from "@/lib/model-catalog";
import { debateRequestSchema } from "@polyvise/core/debate/schema";

import {
  MockLlmProvider,
  OpenRouterLlmProvider,
  type LlmRequest,
} from "@polyvise/core/providers/llm";
import { loadDebateRuntimeConfig } from "@polyvise/core/debate/config";
import { runHybridCouncilDebate } from "@polyvise/core/debate/engine";
import { runConsensus } from "@polyvise/core/consensus/engine";
import { runAdvisoryPanel } from "@polyvise/core/panel/engine";
import { modelSlotsForMode } from "@/lib/mode-guide";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  push.mockClear();
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function click(selector: string) {
  await act(async () => (host.querySelector(selector) as HTMLElement).click());
}
async function fill(selector: string, text: string) {
  const element = host.querySelector(selector) as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(element, text);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("mode request contracts", () => {
  it.each(modeOrder)(
    "sends only applicable settings for %s, accepted by core",
    (mode) => {
      const request = buildRunRequest({
        subject: "  Should we migrate our database?  ",
        context: "  Small team  ",
        mode,
        councilSize: "duo",
        agentCount: 7,
        rounds: 5,
        models: defaultSelectionsForMode(mode),
      });
      expect(debateRequestSchema.safeParse(request).success).toBe(true);
      expect(request.subject).toBe("Should we migrate our database?");
      expect(request.context).toBe("Small team");
      expect(request.councilSize).toBe(
        mode === "hybrid_council" ? "duo" : undefined,
      );
      expect(request.consensus).toEqual(
        mode === "consensus" ? { agentCount: 7, rounds: 5 } : undefined,
      );
      expect(request.models?.yes).toBe(
        mode === "hybrid_council"
          ? defaultSelectionsByMode.hybrid_council.yes
          : undefined,
      );
      expect(request.models?.no).toBe(
        mode === "hybrid_council"
          ? defaultSelectionsByMode.hybrid_council.no
          : undefined,
      );
    },
  );
  it("safely falls back for unknown mode links", () => {
    expect(parseMode("made-up")).toBe("hybrid_council");
    expect(parseMode("consensus")).toBe("consensus");
  });
});

describe("composer interactions", () => {
  it("shows a recoverable timeout without automatically repeating the create request", async () => {
    const fetcher = vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetcher);
    await act(async () => root.render(<Composer />));
    await fill("#subject", "Should we change the work week?");
    await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Your question is still here");
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });

  it("opens and brings model settings into view even when already open", async () => {
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      await act(async () => root.render(<Composer />));
      for (let attempt = 0; attempt < 2; attempt++) {
        await click(".canvas-settings");
        expect(host.querySelectorAll(".routing-row").length).toBeGreaterThan(0);
        expect(document.activeElement).toBe(host.querySelector("#model-settings"));
      }
      expect(scroll).toHaveBeenCalledTimes(2);
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });
  it.each(modeOrder)("starts %s empty with the transit placeholder and shared examples", async (initialMode) => {
    await act(async () => root.render(<Composer initialMode={initialMode} />));
    const question = () => (host.querySelector("#subject") as HTMLTextAreaElement).value;
    expect(question()).toBe("");
    expect((host.querySelector("#subject") as HTMLTextAreaElement).placeholder).toBe("Should cities make public transit free?");
    expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    const examples = () => Array.from(host.querySelectorAll(".question-examples button"), button => button.textContent);
    const initialExamples = examples();
    expect(initialExamples).toHaveLength(3);
    for (const mode of modeOrder) {
      await click(`input[value="${mode}"]`);
      expect(examples()).toEqual(initialExamples);
      await click(".question-examples button:last-child");
      expect(question()).toBe("Should a startup build its own authentication system?");
      await click(".question-examples button:first-of-type");
      expect(question()).toBe("Should cities make public transit free?");
    }
  });
  it("keeps the question and context across modes while showing the right roles", async () => {
    await act(async () => root.render(<Composer />));
    await fill("#subject", "Should we move to a four-day workweek?");
    await click('[aria-controls="question-context"]');
    await fill("#context", "We need weekday support coverage.");
    await click('[aria-controls="model-settings"]');
    expect(host.querySelectorAll(".routing-row")).toHaveLength(3);
    await click('input[value="consensus"]');
    expect(host.querySelectorAll(".routing-row")).toHaveLength(3);
    expect(host.querySelector("#model-yes")).toBeNull();
    expect(
      host.querySelector('label[for="model-judge"]')?.textContent,
    ).toContain("Summary writer");
    await click('input[value="advisory_panel"]');
    expect(
      host.querySelector('label[for="model-judge"]')?.textContent,
    ).toContain("Panel chair");
    expect(
      (host.querySelector("#subject") as HTMLTextAreaElement).value,
    ).toContain("four-day");
    expect(
      (host.querySelector("#context") as HTMLTextAreaElement).value,
    ).toContain("weekday support");
  });
  it("uses and resets independent model defaults for each mode", async () => {
    await act(async () => root.render(<Composer />));
    await click('[aria-controls="model-settings"]');

    expect((host.querySelector("#model-deep") as HTMLSelectElement).value).toBe(
      "openai/gpt-5.6-sol",
    );
    expect((host.querySelector("#model-judge") as HTMLSelectElement).value).toBe(
      "anthropic/claude-sonnet-4.6",
    );

    await click('input[value="consensus"]');
    const consensusDeep = host.querySelector("#model-deep") as HTMLSelectElement;
    expect(consensusDeep.value).toBe("openai/gpt-5.6-terra");
    expect((host.querySelector("#model-judge") as HTMLSelectElement).value).toBe(
      "openai/gpt-5.6-sol",
    );

    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )!.set!.call(consensusDeep, "openai/gpt-5.5");
      consensusDeep.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector(".routing-toggle")?.textContent).toContain(
      "Customized",
    );

    await click('input[value="advisory_panel"]');
    expect((host.querySelector("#model-deep") as HTMLSelectElement).value).toBe(
      "openai/gpt-5.6-sol",
    );
    await click('input[value="consensus"]');
    expect((host.querySelector("#model-deep") as HTMLSelectElement).value).toBe(
      "openai/gpt-5.5",
    );
    await click(".routing-settings .text-action");
    expect((host.querySelector("#model-deep") as HTMLSelectElement).value).toBe(
      "openai/gpt-5.6-terra",
    );
    expect(host.querySelector(".routing-toggle")?.textContent).toContain(
      "Defaults selected",
    );
  });
  it("preserves inputs and offers recovery after a rate limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "Too many requests" }),
      }),
    );
    await act(async () => root.render(<Composer initialMode="consensus" />));
    await fill("#subject", "Should we migrate our database?");
    await click('button[type="submit"]');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Wait a minute",
    );
    expect((host.querySelector("#subject") as HTMLTextAreaElement).value).toBe(
      "Should we migrate our database?",
    );
    expect(
      (host.querySelector('button[type="submit"]') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
  it("records and navigates to the created run without duplicate requests", async () => {
    let resolve!: (response: unknown) => void;
    const fetcher = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    await act(async () =>
      root.render(<Composer initialMode="advisory_panel" />),
    );
    await fill("#subject", "How should we introduce AI support?");
    await click('button[type="submit"]');
    await act(async () => {
      host
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({
        ok: true,
        status: 202,
        json: async () => ({ debate: { id: "debate_test" } }),
      });
    });
    expect(push).toHaveBeenCalledWith("/runs/debate_test");
    expect(window.localStorage.getItem("polyvise-runs")).toContain(
      "debate_test",
    );
  });
});

describe("model defaults", () => {
  it("keeps every default selectable and the debate judge provider-independent", () => {
    const ids = new Set(modelCatalog.map((model) => model.id));
    for (const selections of Object.values(defaultSelectionsByMode)) {
      for (const model of Object.values(selections)) {
        expect(ids.has(model)).toBe(true);
      }
    }
    expect(defaultSelectionsByMode.hybrid_council.judge.split("/")[0]).not.toBe(
      defaultSelectionsByMode.hybrid_council.quick.split("/")[0],
    );
  });
});

// Routing differs not just by mode, but by debate size. Exercise the engine's
// actual calls so an attractive control cannot silently become a no-op.

it.each([
  ["hybrid_council", "duo"],
  ["hybrid_council", "quartet"],
  ["consensus", "quartet"],
  ["advisory_panel", "quartet"],
] as const)(
  "every model control maps to a real call in %s / %s",
  async (mode, size) => {
    const roles: string[] = [];
    const config = loadDebateRuntimeConfig({
      NODE_ENV: "test",
      POLYVISE_EVIDENCE_PROVIDER: "mock",
      POLYVISE_QUICK_MODEL: "quick",
      POLYVISE_DEEP_MODEL: "deep",
      POLYVISE_YES_MODEL: "yes",
      POLYVISE_NO_MODEL: "no",
      POLYVISE_JUDGE_MODEL: "judge",
    });
    class RecordingProvider extends MockLlmProvider {
      async generateStructured<T>(request: LlmRequest) {
        roles.push(request.role);
        return super.generateStructured<T>(request);
      }
    }
    const provider = new RecordingProvider();
    const run =
      mode === "consensus"
        ? runConsensus
        : mode === "advisory_panel"
          ? runAdvisoryPanel
          : runHybridCouncilDebate;
    await run(
      "routing-test",
      {
        subject: "Should our team migrate our database?",
        mode,
        councilSize: size,
      },
      undefined,
      { config, provider },
    );
    const router = new OpenRouterLlmProvider(config);
    expect(new Set(roles.map((role) => router.modelForRole(role)))).toEqual(
      new Set(modelSlotsForMode(mode, size).map((slot) => slot.id)),
    );
  },
);
