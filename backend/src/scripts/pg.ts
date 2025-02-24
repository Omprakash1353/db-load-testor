import { spawn } from "bun";
import { wss } from "..";
import { database } from "../db";
import { stats } from "../db/schema";

interface PgParams {
  clients: number;
  threads: number;
  scale: number;
}

interface BenchmarkData {
  database: string;
  transactionType: string;
  scalingFactor: number;
  clients: number;
  threads: number;
  tps: number;
  latencyAvg: number;
  latencyMin: number;
  latencyMax: number;
  latencyP95: number;
  transactions: number;
  readOperations: number;
  writeOperations: number;
  otherOperations: number;
  totalOperations: number;
  timeTaken: number;
  estimatedUpdates: number;
  estimatedInserts: number;
  error: number;
}

export const pgScript = async ({ clients, threads, scale }: PgParams) => {
  const child = spawn([
    "bash",
    "-c",
    `
          DB_CONTAINER="postgres_bench"
          DB_USER="user"
          DB_PASSWORD="pass"
          DB_NAME="testdb"
          DB_PORT="5432"
          LOG_FILE="pgbench_results.log"

          echo "🧹 Cleaning up existing resources..."
          docker stop $DB_CONTAINER >/dev/null 2>&1
          docker rm $DB_CONTAINER >/dev/null 2>&1
          docker network rm loadtest-network >/dev/null 2>&1

          echo "🌐 Creating Docker network..."
          docker network create loadtest-network >/dev/null 2>&1

          echo "🚀 Starting PostgreSQL container..."
          docker run --name $DB_CONTAINER \
            --network loadtest-network \
            -e POSTGRES_USER=$DB_USER \
            -e POSTGRES_PASSWORD=$DB_PASSWORD \
            -e POSTGRES_DB=$DB_NAME \
            -p $DB_PORT:5432 \
            -d postgres:14

          echo "⏳ Waiting for PostgreSQL to start..."
          max_tries=30
          counter=0
          while ! docker exec $DB_CONTAINER pg_isready -U $DB_USER -d $DB_NAME >/dev/null 2>&1; do
            echo "    Still waiting for PostgreSQL to be ready... ($((counter + 1))/$max_tries)"
            counter=$((counter + 1))
            if [ $counter -gt $max_tries ]; then
              echo "❌ PostgreSQL failed to start within reasonable time"
              exit 1
            fi
            sleep 2
          done

          echo "✅ PostgreSQL is ready!"

          echo "🔧 Initializing pgbench with scale ${scale}..."
          docker exec $DB_CONTAINER pgbench \
            -h localhost \
            -p 5432 \
            -i \
            -U $DB_USER \
            -d $DB_NAME \
            --scale=${scale} \
            --foreign-keys \
            --quiet

          echo "⚡ Running pgbench load test with ${clients} clients and ${threads} threads..."
          docker exec $DB_CONTAINER pgbench \
            -h localhost \
            -p 5432 \
            -U $DB_USER \
            -d $DB_NAME \
            --client=${clients} \
            --jobs=${threads} \
            --time=60 \
            --scale=${scale} \
            --progress=10 | tee $LOG_FILE

          echo "🧹 Cleaning up..."
          docker stop $DB_CONTAINER >/dev/null 2>&1
          docker rm $DB_CONTAINER >/dev/null 2>&1
          docker network rm loadtest-network >/dev/null 2>&1

          echo "✅ Test completed. Results saved in $LOG_FILE"
          `,
  ]);

  await child.exited;

  let logContents = "";
  let jsonData: Partial<BenchmarkData> = {};

  try {
    logContents = await Bun.file("pgbench_results.log").text();
    console.log("LOG", logContents);
    // Parse pgbench output for key metrics (fallback if AI fails)
    let transactions = 0;
    let tps = 0;
    let latencyAvg = 0;
    let latencyMin = 0;
    let latencyMax = 0;
    let latencyP95 = 0;
    let timeTaken = 0;

    const lines = logContents.split("\n");
    for (const line of lines) {
      if (line.includes("number of transactions actually processed:")) {
        transactions = parseInt(line.split(":")[1].trim(), 10) || 0;
      } else if (line.includes("tps =")) {
        const tpsMatch = line.match(/tps = ([\d.]+)/);
        if (tpsMatch) tps = parseFloat(tpsMatch[1]) || 0;
      } else if (line.includes("latency average =")) {
        const latencyMatch = line.match(/latency average = ([\d.]+)/);
        if (latencyMatch) latencyAvg = parseFloat(latencyMatch[1]) || 0;
      } else if (line.includes("latency min =")) {
        const minMatch = line.match(/latency min = ([\d.]+)/);
        if (minMatch) latencyMin = parseFloat(minMatch[1]) || 0;
      } else if (line.includes("latency max =")) {
        const maxMatch = line.match(/latency max = ([\d.]+)/);
        if (maxMatch) latencyMax = parseFloat(maxMatch[1]) || 0;
      } else if (line.includes("latency percentile 95 =")) {
        const p95Match = line.match(/latency percentile 95 = ([\d.]+)/);
        if (p95Match) latencyP95 = parseFloat(p95Match[1]) || 0;
      } else if (line.includes("total time:")) {
        const timeMatch = line.match(/total time: ([\d.]+)/);
        if (timeMatch) timeTaken = parseFloat(timeMatch[1]) || 0;
      }
    }

    // Calculate operations based on TPC-B workload pattern
    const readOpsPerTx = 1; // Each transaction reads one row
    const writeOpsPerTx = 3; // Updates 3 different tables
    const otherOpsPerTx = 0.5; // Index operations and other overhead

    const readOperations = transactions * readOpsPerTx;
    const writeOperations = transactions * writeOpsPerTx;
    const otherOperations = Math.round(transactions * otherOpsPerTx);
    const totalOperations = readOperations + writeOperations + otherOperations;

    // If some latency metrics are missing, estimate them
    if (!latencyMin) latencyMin = latencyAvg * 0.5;
    if (!latencyMax) latencyMax = latencyAvg * 2.0;
    if (!latencyP95) latencyP95 = latencyAvg * 1.6;

    // If time not found, calculate from TPS
    if (!timeTaken && tps > 0) {
      timeTaken = transactions / tps;
    }

    // Build jsonData
    jsonData = {
      database: "postgresql",
      transactionType: "tpc-b-like",
      scalingFactor: scale,
      clients,
      threads,
      tps: Math.round(tps),
      latencyAvg: Math.round(latencyAvg),
      latencyMin: Math.round(latencyMin),
      latencyMax: Math.round(latencyMax),
      latencyP95: Math.round(latencyP95),
      transactions: Math.round(transactions),
      readOperations: Math.round(readOperations),
      writeOperations: Math.round(writeOperations),
      otherOperations: Math.round(otherOperations),
      totalOperations: Math.round(totalOperations),
      timeTaken: Math.round(timeTaken),
      estimatedUpdates: Math.round(writeOperations),
      estimatedInserts: 0,
      error: 0,
    };

    // Send to WebSocket clients
    const [insertedData] = await database
      .insert(stats)
      .values(jsonData)
      .returning();
    console.log("AFTER RETURNED DATA", insertedData);

    const message = {
      type: "benchmark_result",
      status: "completed",
      timestamp: new Date().toISOString(),
      statsId: insertedData.id,
      data: {
        raw: logContents,
        parsed: jsonData,
      },
    };

    if (wss.clients.size === 0) {
      console.log("No connected clients to send response.");
    }

    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message));
        console.log("Success Sent response to client");
      } else {
        console.log(
          "Success Client disconnected or not ready:",
          client.readyState
        );
      }
    });
  } catch (error: any) {
    logContents = `Error: ${error.message}`;
    jsonData = {
      database: "postgresql",
      transactionType: "tpc-b-like",
      scalingFactor: scale,
      clients,
      threads,
      tps: 0,
      latencyAvg: 0,
      latencyMin: 0,
      latencyMax: 0,
      latencyP95: 0,
      transactions: 0,
      readOperations: 0,
      writeOperations: 0,
      otherOperations: 0,
      totalOperations: 0,
      timeTaken: 0,
      estimatedUpdates: 0,
      estimatedInserts: 0,
      error: 1,
    };

    const [insertedErrorData] = await database
      .insert(stats)
      .values(jsonData)
      .returning();

    const errorMessage = {
      type: "benchmark_result",
      status: "failed",
      timestamp: new Date().toISOString(),
      statsId: insertedErrorData.id,
      data: {
        raw: logContents,
        parsed: jsonData,
      },
    };

    console.log("Failed Returned Data", insertedErrorData);
    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(errorMessage));
        console.log("Failed Sent error response to client");
      }
    });
  }

  return jsonData;
};
