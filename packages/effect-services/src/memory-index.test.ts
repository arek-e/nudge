import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { Db } from "@nudge/db";
import { MemoryIndex } from "./index";

const user = { id: "memory-user", displayName: "Memory User" };

const runWithMemoryIndex = <A, E>(program: Effect.Effect<A, E, Db | MemoryIndex>) => {
  return Effect.runPromise(
    Effect.provide(program, MemoryIndex.layerMemory).pipe(Effect.provide(Db.layerMemory)),
  );
};

describe("MemoryIndex", () => {
  test("indexes pending memory chunks and retrieves matching memory", async () => {
    const result = await runWithMemoryIndex(
      Effect.gen(function* () {
        const db = yield* Db;
        const memoryIndex = yield* MemoryIndex;
        yield* db.ensureUser(user);
        const memory = yield* db.upsertMemoryDocument({
          userId: user.id,
          sourceType: "journal_revision",
          sourceId: "revision-1",
          title: "June 18 journal update",
          bodyText: "need to write to michael about the launch",
          localDate: "2026-06-18",
        });

        const indexed = yield* memoryIndex.indexPending({ user, limit: 10 });
        const retrieved = yield* memoryIndex.retrieve({ user, query: "michael launch", limit: 3 });

        return { indexed, memory, retrieved };
      }),
    );

    expect(result.indexed.indexedChunkIds).toEqual([result.memory.chunks[0]?.id]);
    expect(result.retrieved.results).toEqual([
      expect.objectContaining({
        chunkId: result.memory.chunks[0]?.id,
        sourceId: "revision-1",
        text: "need to write to michael about the launch",
      }),
    ]);
  });

  test("writes pending chunks to hashed Turbopuffer namespace and retrieves with BM25", async () => {
    const requests: Array<{
      readonly body: unknown;
      readonly method: string;
      readonly url: string;
    }> = [];
    const fetch: typeof globalThis.fetch = async (url, init) => {
      requests.push({
        body: init?.body ? JSON.parse(String(init.body)) : null,
        method: init?.method ?? "GET",
        url: String(url),
      });
      if (String(url).endsWith("/query")) {
        return Response.json({
          rows: [
            {
              $dist: 4.2,
              id: "chunk-1",
              source_id: "revision-1",
              source_type: "journal_revision",
              text: "need to write to michael about the launch",
            },
          ],
        });
      }
      return Response.json({ rows_affected: 1, rows_upserted: 1 });
    };

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const db = yield* Db;
        const memoryIndex = yield* MemoryIndex;
        yield* db.ensureUser(user);
        const memory = yield* db.upsertMemoryDocument({
          userId: user.id,
          sourceType: "journal_revision",
          sourceId: "revision-1",
          title: "June 18 journal update",
          bodyText: "need to write to michael about the launch",
          localDate: "2026-06-18",
        });
        const indexed = yield* memoryIndex.indexPending({ user, limit: 10 });
        const retrieved = yield* memoryIndex.retrieve({ user, query: "michael launch", limit: 3 });
        return { indexed, memory, retrieved };
      }).pipe(
        Effect.provide(
          MemoryIndex.layerTurbopuffer({ apiKey: "test-key", fetch, region: "aws-eu-west-1" }),
        ),
        Effect.provide(Db.layerMemory),
      ),
    );

    expect(result.indexed.indexedChunkIds).toEqual([result.memory.chunks[0]?.id]);
    expect(requests[0]?.url).toMatch(
      /^https:\/\/aws-eu-west-1\.turbopuffer\.com\/v2\/namespaces\/vesta-user-[a-f0-9]{48}$/,
    );
    expect(requests[0]?.url).not.toContain(user.id);
    expect(requests[0]?.body).toMatchObject({
      schema: { text: { full_text_search: true, type: "string" } },
      upsert_rows: [
        {
          id: result.memory.chunks[0]?.id,
          source_id: "revision-1",
          source_type: "journal_revision",
          text: "need to write to michael about the launch",
        },
      ],
    });
    expect(requests[1]?.body).toMatchObject({
      include_attributes: ["text", "source_type", "source_id"],
      limit: 3,
      rank_by: ["text", "BM25", "michael launch"],
    });
    expect(result.retrieved.results[0]).toMatchObject({
      chunkId: "chunk-1",
      score: 4.2,
      sourceId: "revision-1",
      sourceType: "journal_revision",
      text: "need to write to michael about the launch",
    });
  });

  test("deletes the hashed Turbopuffer namespace for a user", async () => {
    const requests: Array<{ readonly method: string; readonly url: string }> = [];
    const fetch: typeof globalThis.fetch = async (url, init) => {
      requests.push({ method: init?.method ?? "GET", url: String(url) });
      return Response.json({ deleted: true });
    };

    await Effect.runPromise(
      Effect.gen(function* () {
        const memoryIndex = yield* MemoryIndex;
        yield* memoryIndex.deleteUserNamespace({ user });
      }).pipe(
        Effect.provide(
          MemoryIndex.layerTurbopuffer({ apiKey: "test-key", fetch, region: "aws-eu-west-1" }),
        ),
      ),
    );

    expect(requests).toEqual([
      {
        method: "DELETE",
        url: expect.stringMatching(
          /^https:\/\/aws-eu-west-1\.turbopuffer\.com\/v2\/namespaces\/vesta-user-[a-f0-9]{48}$/,
        ),
      },
    ]);
    expect(requests[0]?.url).not.toContain(user.id);
  });
});
