import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebSocketServer } from "ws";
import { database } from "./db";
import { stats } from "./db/schema";
import { pgScript } from "./scripts/pg";
import { sqlScript } from "./scripts/sql";
import { eq } from "drizzle-orm";
import { mongoScript } from "./scripts/mongo";

export const wss = new WebSocketServer({ port: 8080 });
const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/", async (c) => {
  try {
    const res = await database.select().from(stats);
    return c.json({ message: "Success", data: res }, 200);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/stats/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid ID parameter. Must be a number." }, 400);
    }
    const res = await database.select().from(stats).where(eq(stats.id, id));
    return c.json({ message: "Success", data: res }, 200);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

function sayHello() {
  return { message: "Hello World!" };
}

app.post("/run-pg", async (c) => {
  try {
    const body = await c.req.json();
    const clients = body.clients || 10;
    const threads = body.threads || 2;
    const scale = body.scale || 100;

    console.log("Running pg script with params:", { clients, threads, scale });

    pgScript({ clients, threads, scale });

    return c.json(
      { message: "Script started. Check back later for results." },
      202
    );
  } catch (error) {
    console.error("Error in /run-pg:", error);
    return c.json({ error: "Invalid request body" }, 400);
  }
});

app.post("/run-mysql", async (c) => {
  try {
    const body = await c.req.json();
    const clients = body.clients || 10;
    const threads = body.threads || 2;
    const scale = body.scale || 100;

    sqlScript({ threads, scale });

    return c.json(
      { message: "Script started. Check back later for results." },
      202
    );
  } catch (error) {
    console.error("Error in /run-mysql:", error);
    return c.json({ error: "Invalid request body" }, 400);
  }
});

app.post("/run-mongo", async (c) => {
  try {
    const body = await c.req.json();
    const clients = body.clients || 10;
    const threads = body.threads || 2;
    const scale = body.scale || 100;

    mongoScript({ clients, threads, scale });

    return c.json(
      { message: "Script started. Check back later for results." },
      202
    );
  } catch (error) {
    console.error("Error in /run-mongo:", error);
    return c.json({ error: "Invalid request body" }, 400);
  }
});

app.get("*", (c) => c.text("Not Found", 404));

export default {
  port: 3001,
  fetch: app.fetch,
};
