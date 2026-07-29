import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { RunsTable } from "@/components/runs-table";
import { toRunSummary } from "@/lib/run-summary";
import { adminEnabled, isAdmin } from "@/server/admin";
import { listDebates } from "@/server/debate-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "All runs | Polyvise admin",
  robots: { index: false, follow: false }
};

export default async function AdminRunsPage() {
  // No configured token means the admin surface doesn't exist, rather than
  // existing unguarded.
  if (!adminEnabled()) {
    notFound();
  }
  if (!(await isAdmin())) {
    redirect("/admin/login" as Route);
  }

  const debates = await listDebates();
  const runs = debates.map(toRunSummary);

  return (
    <section className="page">
      <div className="row gap8 wrap">
        <span className="eyebrow">Admin</span>
        <span className="chip judge">
          <span className="dot" />
          all visitors
        </span>
      </div>
      <h2 className="display d2 mt10">Every run</h2>
      <p className="lede mt10 mw640">
        The complete list, including other people&apos;s questions. Failed runs stay in the list with the step that
        failed named in the verdict column.
      </p>

      <div className="mt24">
        {runs.length === 0 ? (
          <div className="card card-pad">
            <h4 className="card-title">No runs recorded yet.</h4>
          </div>
        ) : (
          <RunsTable runs={runs} />
        )}
      </div>

      <p className="meta mt14">{runs.length} runs · this page is not indexed</p>
    </section>
  );
}
