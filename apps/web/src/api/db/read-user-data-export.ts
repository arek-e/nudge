import { Effect } from "effect";
import type { DbService, DbUser, UserDataExport } from "@nudge/db";

export interface ReadUserDataExportInput {
  readonly db: DbService;
  readonly user: DbUser;
}

export type ReadUserDataExportResult = UserDataExport;

export function readUserDataExport(
  input: ReadUserDataExportInput,
): Effect.Effect<ReadUserDataExportResult> {
  return input.db.exportUserData(input.user);
}
