import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/start";

interface BenchmarkResult {
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
  timeTaken: number;
  transactions: number;
  totalOperations: number;
  readOperations: number;
  writeOperations: number;
  otherOperations: number;
  estimatedUpdates: number | null;
  estimatedInserts: number | null;
  error: number;
}

export const Route = createFileRoute("/stats/")({
  component: RouteComponent,
});

const getStatsFn = createServerFn().handler(async () => {
  const data = await fetch("http://localhost:3001", { method: "GET" });
  const parsedData = await data.json();
  return { result: parsedData };
});

function RouteComponent() {
  const { data: tableData, isLoading } = useSuspenseQuery({
    queryKey: ["stats"],
    queryFn: () => getStatsFn(),
  });

  const formatNumber = (num: number | null): string => {
    if (num === null) return "N/A";
    return num.toLocaleString();
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-10">
      <div className="rounded-md border">
        <Table>
          <TableCaption>Database Benchmark Results</TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[150px]">Database</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Scale</TableHead>
              <TableHead className="text-right">Clients</TableHead>
              <TableHead className="text-right">Threads</TableHead>
              <TableHead className="text-right">TPS</TableHead>
              <TableHead className="text-right">Latency (ms)</TableHead>
              <TableHead className="text-right">Time (s)</TableHead>
              <TableHead className="text-right">Operations</TableHead>
              <TableHead className="text-right">Error Rate</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.result.data.map((result, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{result.database}</TableCell>
                <TableCell>{result.transactionType}</TableCell>
                <TableCell className="text-right">
                  {result.scalingFactor}
                </TableCell>
                <TableCell className="text-right">{result.clients}</TableCell>
                <TableCell className="text-right">{result.threads}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(result.tps)}
                </TableCell>
                <TableCell className="text-right">
                  <div>avg: {result.latencyAvg.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">
                    min: {result.latencyMin.toFixed(2)} | max:{" "}
                    {result.latencyMax.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    p95: {result.latencyP95.toFixed(2)}
                  </div>
                </TableCell>
                <TableCell className="text-right">{result.timeTaken}</TableCell>
                <TableCell className="text-right">
                  <div>total: {formatNumber(result.totalOperations)}</div>
                  <div className="text-xs text-muted-foreground">
                    read: {formatNumber(result.readOperations)} | write:{" "}
                    {formatNumber(result.writeOperations)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    updates: {formatNumber(result.estimatedUpdates)} | inserts:{" "}
                    {formatNumber(result.estimatedInserts)}
                  </div>
                </TableCell>
                <TableCell className="text-right">{result.error}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      result.error === 0 ? "text-green-500" : "text-red-500"
                    }
                  >
                    {result.error === 0 ? "Success" : "Error"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default RouteComponent;
