import type { Route } from "next";
import { permanentRedirect } from "next/navigation";

/** The question box moved to the home page; old links still land there. */
export default function ComposePage() {
  permanentRedirect("/" as Route);
}
