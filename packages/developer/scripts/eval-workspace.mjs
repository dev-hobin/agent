import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createEvalWorkspace(root, ids) {
  const workspace = await mkdtemp(join(tmpdir(), "developer-eval-workspace-"));
  const source = join(root, "evals", "workspace");
  for (const id of ids) {
    await cp(source, join(workspace, id), { recursive: true });
  }
  return workspace;
}
