import path from "node:path";
import { readJsonSync, existsSync } from "fs-extra";
import { getTurboConfigs } from "@turbo/utils";
import type { Schema, SchemaV1 } from "@turbo/types/src/types/config";
import type { Transformer, TransformerArgs } from "../types";
import { getTransformerHelpers } from "../utils/getTransformerHelpers";
import type { TransformerResults } from "../runner";

// transformer details
const TRANSFORMER = "rename-pipeline";
const DESCRIPTION = 'Rename the "pipeline" key to "tasks" in `turbo.json`';
const INTRODUCED_IN = "2.0.0-canary.0";

function migrateConfig(config: SchemaV1): Schema {
  const { pipeline, ...rest } = config;

  return { tasks: pipeline, ...rest };
}

export function transformer({
  root,
  options,
}: TransformerArgs): TransformerResults {
  const { log, runner } = getTransformerHelpers({
    transformer: TRANSFORMER,
    rootPath: root,
    options,
  });

  log.info(`Renaming \`pipeline\` key in turbo.json to \`tasks\``);
  const turboConfigPath = path.join(root, "turbo.json");
  if (!existsSync(turboConfigPath)) {
    return runner.abortTransform({
      reason: `No turbo.json found at ${root}. Is the path correct?`,
    });
  }

  const turboJson = readJsonSync(turboConfigPath) as SchemaV1;
  runner.modifyFile({
    filePath: turboConfigPath,
    after: migrateConfig(turboJson),
  });

  // find and migrate any workspace configs
  const workspaceConfigs = getTurboConfigs(root);
  workspaceConfigs.forEach((workspaceConfig) => {
    const { config, turboConfigPath: filePath } = workspaceConfig;
    if ("pipeline" in config) {
      runner.modifyFile({
        filePath,
        after: migrateConfig(config),
      });
    }
  });

  return runner.finish();
}

const transformerMeta: Transformer = {
  name: TRANSFORMER,
  description: DESCRIPTION,
  introducedIn: INTRODUCED_IN,
  transformer,
};

// eslint-disable-next-line import/no-default-export -- transforms require default export
export default transformerMeta;
