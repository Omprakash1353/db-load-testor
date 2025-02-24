import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const stats = pgTable("load_stats", {
  id: serial("id").primaryKey(),
  database: text("database"),
  transactionType: text("transaction_type"),
  scalingFactor: integer("scaling_factor"),
  clients: integer("clients"),
  threads: integer("threads"),
  tps: integer("tps"),
  latencyAvg: integer("latency_avg"),
  latencyMin: integer("latency_min"),
  latencyMax: integer("latency_max"),
  latencyP95: integer("latency_p95"),
  transactions: integer("transactions"),
  readOperations: integer("read_operations"),
  writeOperations: integer("write_operations"),
  otherOperations: integer("other_operations"),
  totalOperations: integer("total_operations"),
  timeTaken: integer("time_taken"),
  estimatedUpdates: integer("estimated_updates"),
  estimatedInserts: integer("estimated_inserts"),
  error: integer("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Stats = typeof stats.$inferSelect;
export type NewStats = typeof stats.$inferInsert;
