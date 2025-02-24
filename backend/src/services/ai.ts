import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Benchmark data interface
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

// WebSocket message types
interface WebSocketMessage {
  type: string;
  status: "completed" | "failed" | "running";
  timestamp: string;
  data: {
    raw: string;
    parsed: BenchmarkData;
  };
}

const prompt = `You are an expert data converter and database performance analyst. Your task is to extract relevant benchmark data from the provided text and transform it into a standardized JSON format.

**Input:**
You will be given a text containing benchmark results from PostgreSQL pgbench or MySQL sysbench. This text will include performance metrics such as transactions per second (TPS), latency, queries, scaling factors, and other relevant information.

**Prediction Guidelines:**
If values are not directly available in the input, predict them using these rules:
1. Latency metrics:
   - If only average latency is available:
     * Min ≈ average * 0.5
     * Max ≈ average * 2.0
     * P95 ≈ average * 1.6
2. Operation counts:
   - For PostgreSQL TPC-B:
     * readOperations ≈ transactions * 1
     * writeOperations ≈ transactions * 3
     * otherOperations ≈ transactions * 0.5
   - For MySQL OLTP:
     * readOperations ≈ transactions * 10
     * writeOperations ≈ transactions * 4
     * otherOperations ≈ transactions * 1
3. Time metrics:
   - If timeTaken is missing: transactions / tps
   - If tps is missing: transactions / timeTaken
4. Total operations:
   - Sum of read, write, and other operations
   - Or transactions * typical operations per transaction for the workload type

**Output:**
You must convert the extracted data into a JSON object that adheres strictly to this format:
{
  "database": <string>,
  "transactionType": <string>,
  "scalingFactor": <number>,
  "clients": <number>,
  "threads": <number>,
  "tps": <number>,
  "latencyAvg": <number>,
  "latencyMin": <number>,
  "latencyMax": <number>,
  "latencyP95": <number>,
  "transactions": <number>,
  "readOperations": <number>,
  "writeOperations": <number>,
  "otherOperations": <number>,
  "totalOperations": <number>,
  "timeTaken": <number>,
  "estimatedUpdates": <number>,
  "estimatedInserts": <number>,
  "error": <number>
}

Important:
1. Return ONLY the JSON object, no additional text or formatting
2. All numeric fields must have a value - use the prediction rules to estimate missing values
3. Numbers should be parsed as numbers, not strings
4. For read/write operations:
   - Calculate based on transaction type and database-specific patterns
   - Include index operations in otherOperations
5. Latency values should be in milliseconds
6. timeTaken should be in seconds
7. Ensure predictions maintain logical consistency:
   - totalOperations = readOperations + writeOperations + otherOperations
   - tps = transactions / timeTaken
   - All latency values should follow: min ≤ avg ≤ p95 ≤ max`;

const defaultBenchmarkData: BenchmarkData = {
  database: "postgresql",
  transactionType: "tpc-b-like",
  scalingFactor: 0,
  clients: 0,
  threads: 0,
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
  error: 0
};

export const generateData = async (text: string): Promise<BenchmarkData> => {
  try {
    const result = await model.generateContent(
      prompt + "\n\nInput text:\n" + text
    );
    const response = result.response.text();

    try {
      console.log("AI Response:", response);
      const parsedData = JSON.parse(response);
      return {
        ...defaultBenchmarkData,
        ...parsedData
      };
    } catch (error) {
      console.error("Failed to parse AI response:", response);
      return defaultBenchmarkData;
    }
  } catch (error) {
    console.error("AI generation error:", error);
    return defaultBenchmarkData;
  }
};
