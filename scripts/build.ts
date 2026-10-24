import "../src/server/runtime";
import { mkdir } from "node:fs/promises";
await mkdir("dist", { recursive: true });
for (const [name, entry] of [["app", "src/client/main.ts"], ["bridge", "src/bridge/bridge.ts"]]) {
  const result = await Bun.build({ entrypoints: [entry!], target: "browser", format: "esm", minify: true });
  if (!result.success || !result.outputs[0]) throw new AggregateError(result.logs, `Build failed: ${name}`);
  await Bun.write(`dist/${name}.js`, result.outputs[0]);
}
