import { spawn } from "bun";
import * as path from "path";
import { wss } from "..";
import { database } from "../db";
import { stats } from "../db/schema";
import { existsSync } from "fs";

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

export const mongoScript = async ({ clients, threads, scale }: PgParams) => {
    const scriptPath = path.join(__dirname, "scripts", "mongo.sh");
    const gitBashPath = "C:\\Program Files\\Git\\bin\\bash.exe"; // Adjust if needed

    // Check if Git Bash exists
    if (!existsSync(gitBashPath)) {
        throw new Error(`Git Bash not found at ${gitBashPath}. Please install Git Bash or adjust the path.`);
    }

    const child = spawn({
        cmd: [gitBashPath, scriptPath, clients.toString(), threads.toString(), scale.toString()],
        stdout: "pipe",
        stderr: "pipe",
    });

    const stdoutOutput = await new Response(child.stdout).text();
    const stderrOutput = await new Response(child.stderr).text();
    await child.exited;

    let logContents = "";
    let jsonData: Partial<BenchmarkData> = {};

    try {
        if (child.exitCode !== 0) {
            throw new Error(`Script failed with exit code ${child.exitCode}\nSTDERR: ${stderrOutput}\nSTDOUT: ${stdoutOutput}`);
        }

        logContents = await Bun.file("mongobench_results.log").text();
        if (!logContents) {
            throw new Error("Log file is empty or not readable");
        }
        console.log("LOG", logContents);

        let transactions = 0;
        let tps = 0;
        let latencyAvg = 0;
        let timeTaken = 0;

        const lines = logContents.split("\n");
        for (const line of lines) {
            if (line.includes("Total Transactions Processed:")) {
                transactions = parseInt(line.split(":")[1].trim(), 10) || 0;
            } else if (line.includes("TPS =")) {
                const tpsMatch = line.match(/TPS = ([\d.]+)/);
                if (tpsMatch) tps = parseFloat(tpsMatch[1]) || 0;
            } else if (line.includes("Latency Average =")) {
                const latencyMatch = line.match(/Latency Average = ([\d.]+)/);
                if (latencyMatch) latencyAvg = parseFloat(latencyMatch[1]) || 0;
            } else if (line.includes("Duration:")) {
                const timeMatch = line.match(/Duration: ([\d.]+)/);
                if (timeMatch) timeTaken = parseFloat(timeMatch[1]) || 0;
            }
        }

        const readOpsPerTx = 1;
        const writeOpsPerTx = 4;
        const otherOpsPerTx = 0.5;

        const readOperations = transactions * readOpsPerTx;
        const writeOperations = transactions * writeOpsPerTx;
        const otherOperations = Math.round(transactions * otherOpsPerTx);
        const totalOperations = readOperations + writeOperations + otherOperations;

        jsonData = {
            database: "mongodb",
            transactionType: "TPC-B",
            scalingFactor: scale,
            clients,
            threads,
            tps: Math.round(tps),
            latencyAvg: Math.round(latencyAvg),
            latencyMin: 0,
            latencyMax: 0,
            latencyP95: 0,
            transactions,
            readOperations,
            writeOperations,
            otherOperations,
            totalOperations,
            timeTaken,
            estimatedUpdates: writeOperations - transactions,
            estimatedInserts: transactions,
            error: 0,
        };

        const [insertedData] = await database.insert(stats).values(jsonData).returning();
        console.log("AFTER RETURNED DATA", insertedData);

        const message = {
            type: "benchmark_result",
            status: "completed",
            timestamp: new Date().toISOString(),
            statsId: insertedData.id,
            data: { raw: logContents, parsed: jsonData },
        };

        wss.clients.forEach((client: any) => {
            if (client.readyState === 1) {
                client.send(JSON.stringify(message));
                console.log("Success Sent response to client");
            }
        });
    } catch (error: any) {
        logContents = `Error: ${error.message}\nSTDERR: ${stderrOutput}\nSTDOUT: ${stdoutOutput}`;
        console.error(logContents);
        jsonData = {
            database: "mongodb",
            transactionType: "TPC-B",
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

        const [insertedErrorData] = await database.insert(stats).values(jsonData).returning();
        console.log("Failed Returned Data", insertedErrorData);

        const errorMessage = {
            type: "benchmark_result",
            status: "failed",
            timestamp: new Date().toISOString(),
            statsId: insertedErrorData.id,
            data: { raw: logContents, parsed: jsonData },
        };

        wss.clients.forEach((client: any) => {
            if (client.readyState === 1) {
                client.send(JSON.stringify(errorMessage));
                console.log("Failed Sent error response to client");
            }
        });
    }

    return jsonData;
};