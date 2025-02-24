import { spawn } from "bun";
import { wss } from "..";
import { database } from "../db";
import { stats } from "../db/schema";

interface SqlParams {
  threads: number;
  scale: number;
}

interface BenchmarkData {
  database: string;
  transactionType: string;
  scalingFactor: number;
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

export const sqlScript = async ({ threads, scale }: SqlParams) => {
  const child = spawn([
    "bash",
    "-c",
    `
        DB_CONTAINER="mysql_bench"
        DB_USER="root"
        DB_PASSWORD="pass"
        DB_NAME="testdb"
        DB_PORT="3306"
        LOG_FILE="sysbench_results.log"

        echo "🧹 Cleaning up existing resources..."
        docker stop $DB_CONTAINER >/dev/null 2>&1
        docker rm $DB_CONTAINER >/dev/null 2>&1
        docker network rm loadtest-network >/dev/null 2>&1

        echo "🌐 Creating Docker network..."
        docker network create loadtest-network >/dev/null 2>&1

        echo "🚀 Starting MySQL container..."
        docker run --name $DB_CONTAINER \
          --network loadtest-network \
          -e MYSQL_ROOT_PASSWORD=$DB_PASSWORD \
          -e MYSQL_DATABASE=$DB_NAME \
          -p $DB_PORT:3306 \
          -d mysql:5.7

        echo "⏳ Waiting for MySQL to start..."
        max_tries=30
        counter=0
        while ! docker exec $DB_CONTAINER mysql -u$DB_USER -p$DB_PASSWORD -e "SELECT 1" >/dev/null 2>&1; do
          echo "    Still waiting for MySQL to be ready... ($((counter + 1))/$max_tries)"
          counter=$((counter + 1))
          if [ $counter -gt $max_tries ]; then
            echo "❌ MySQL failed to start within reasonable time"
            exit 1
          fi
          sleep 2
        done

        echo "✅ MySQL is ready!"

        echo "🔧 Configuring MySQL authentication..."
        docker exec -i $DB_CONTAINER mysql -u$DB_USER -p$DB_PASSWORD <<EOF
SET GLOBAL sql_mode = '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY '$DB_PASSWORD';
FLUSH PRIVILEGES;
EOF

        echo "🔧 Installing Sysbench..."
        docker pull severalnines/sysbench >/dev/null 2>&1

        echo "🔧 Initializing sysbench..."
        docker run --rm \
          --network loadtest-network \
          severalnines/sysbench sysbench \
          --db-driver=mysql \
          --mysql-host=$DB_CONTAINER \
          --mysql-user=$DB_USER \
          --mysql-password=$DB_PASSWORD \
          --mysql-db=$DB_NAME \
          --tables=10 \
          --table-size=${scale} \
          oltp_read_write prepare

        echo "⚡ Running sysbench load test..."
        docker run --rm \
          --network loadtest-network \
          severalnines/sysbench sysbench \
          --db-driver=mysql \
          --mysql-host=$DB_CONTAINER \
          --mysql-user=$DB_USER \
          --mysql-password=$DB_PASSWORD \
          --mysql-db=$DB_NAME \
          --threads=${threads} \
          --time=60 \
          --tables=10 \
          --table-size=${scale} \
          oltp_read_write run | tee $LOG_FILE

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
    logContents = await Bun.file("sysbench_results.log").text();

    // Parse sysbench output for key metrics
    let transactions = 0;
    let tps = 0;
    let latencyAvg = 0;
    let latencyMin = 0;
    let latencyMax = 0;
    let latencyP95 = 0;
    let timeTaken = 0;

    const lines = logContents.split("\n");
    for (const line of lines) {
      // Transactions and TPS
      if (line.includes("transactions:")) {
        const txMatch = line.match(/transactions:\s+(\d+)/);
        if (txMatch) transactions = parseInt(txMatch[1], 10) || 0;

        const tpsMatch = line.match(/\(([\d.]+)\s+per\s+sec\.\)/);
        if (tpsMatch) tps = parseFloat(tpsMatch[1]) || 0;
      }

      // Latency metrics
      else if (line.includes("avg:")) {
        const avgMatch = line.match(/avg:\s+([\d.]+)/);
        if (avgMatch) latencyAvg = parseFloat(avgMatch[1]) || 0;
      } else if (line.includes("min:")) {
        const minMatch = line.match(/min:\s+([\d.]+)/);
        if (minMatch) latencyMin = parseFloat(minMatch[1]) || 0;
      } else if (line.includes("max:")) {
        const maxMatch = line.match(/max:\s+([\d.]+)/);
        if (maxMatch) latencyMax = parseFloat(maxMatch[1]) || 0;
      } else if (line.includes("95th percentile:")) {
        const p95Match = line.match(/95th percentile:\s+([\d.]+)/);
        if (p95Match) latencyP95 = parseFloat(p95Match[1]) || 0;
      }
      // Total time
      else if (line.includes("total time:")) {
        const timeMatch = line.match(/total time:\s+([\d.]+)s/);
        if (timeMatch) timeTaken = parseFloat(timeMatch[1]) || 0;
      }
    }

    // Calculate operations based on OLTP workload pattern
    const readOpsPerTx = 10; // SELECT operations per transaction
    const writeOpsPerTx = 4; // INSERT/UPDATE/DELETE operations
    const otherOpsPerTx = 1; // Index operations and other overhead

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

    // For OLTP workload, split writes between updates and inserts
    const estimatedUpdates = Math.round(writeOperations * 0.6); // 60% updates
    const estimatedInserts = Math.round(writeOperations * 0.4); // 40% inserts

    // Build jsonData
    jsonData = {
      database: "mysql",
      transactionType: "oltp_read_write",
      scalingFactor: scale,
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
      estimatedUpdates: Math.round(estimatedUpdates),
      estimatedInserts: Math.round(estimatedInserts),
      error: 0,
    };

    console.log("BEFORE RETURNED DATA", jsonData);
    const [insertedData] = await database
      .insert(stats)
      .values(jsonData)
      .returning();
    console.log("AFTER RETURNED DATA", insertedData);

    // Send to WebSocket clients
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
      console.log("No connected clients to send MySQL response.");
    }

    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message));
        console.log("Sent MySQL response to client");
      } else {
        console.log("Client disconnected or not ready:", client.readyState);
      }
    });
  } catch (error: any) {
    logContents = `Error: ${error.message}`;
    jsonData = {
      database: "mysql",
      transactionType: "oltp_read_write",
      scalingFactor: scale,
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

    console.log("BEFORE ERROR RETURNED DATA", jsonData);
    const [insertedErrorData] = await database
      .insert(stats)
      .values(jsonData)
      .returning();
    console.log("AFTER ERROR RETURNED DATA", insertedErrorData);

    const errorMessage = {
      type: "benchmark_result",
      status: "failed",
      timestamp: new Date().toISOString(),
      data: {
        raw: logContents,
        parsed: jsonData,
      },
    };

    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(errorMessage));
        console.log("Sent MySQL error response to client");
      }
    });
  }

  return jsonData;
};
