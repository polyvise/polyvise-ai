import type { Metadata } from "next";
import { Composer } from "@/components/composer";

export const metadata: Metadata = {
  title: "New run | Polyvise",
  description: "Put a question to a council of models."
};

export default function ComposePage() {
  return (
    <section className="page narrow">
      <span className="eyebrow">New run</span>
      <h2 className="display d2 mt10">What do you want decided?</h2>
      <p className="lede mt10">
        State it as a question. The framing step will turn it into a resolution the agents can argue for or against.
      </p>
      <Composer />
    </section>
  );
}
