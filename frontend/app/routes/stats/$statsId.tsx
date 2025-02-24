import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/start";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";

export const Route = createFileRoute("/stats/$statsId")({
  component: RouteComponent,
  loader: async ({ params }) => {
    return loaderFn({ data: { statsId: parseInt(params.statsId) } });
  },
});

const loaderFn = createServerFn()
  .validator(
    z.object({
      statsId: z.number(),
    })
  )
  .handler(async ({ data }) => {
    const res = await fetch(`http://localhost:3001/stats/${data.statsId}`, {
      method: "GET",
    });
    const parsedData = await res.json();
    console.log("Parsed data:", parsedData);
    return { result: parsedData };
  });

function RouteComponent() {
  const { result } = Route.useLoaderData();

  const [selectedMetric, setSelectedMetric] = useState("tps");

  const metrics = [
    { value: "tps", label: "Transactions per Second" },
    { value: "latencyAvg", label: "Average Latency" },
    { value: "latencyP95", label: "95th Percentile Latency" },
    { value: "totalOperations", label: "Total Operations" },
  ];

  const operationsData = [
    { name: "Read", value: result.data[0]?.readOperations || 0 },
    { name: "Write", value: result.data[0]?.writeOperations || 0 },
    { name: "Other", value: result.data[0]?.otherOperations || 0 },
  ];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  const calculateSuccessRate = () => {
    console.log("RESULTS", result);
    const transactions = result.data[0]?.transactions || 0;
    const errors = result.data[0]?.error || 0;
    console.log("TRANSACTIONS", transactions, errors);
    if (transactions === 0) return 0;
    console.info((((transactions - errors) / transactions) * 100).toFixed(2));
    return parseInt(
      (((transactions - errors) / transactions) * 100).toFixed(2)
    );
  };

  const successRate = calculateSuccessRate();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Database Performance Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              <Select
                value={selectedMetric}
                onValueChange={(value) => setSelectedMetric(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {metrics.map((metric) => (
                    <SelectItem key={metric.value} value={metric.value}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[result.data[0]].filter(Boolean)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="database" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey={selectedMetric} fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latency Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[result.data[0]].filter(Boolean)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="database" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="latencyMin" stroke="#8884d8" />
                <Line type="monotone" dataKey="latencyAvg" stroke="#82ca9d" />
                <Line type="monotone" dataKey="latencyMax" stroke="#ffc658" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operation Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={operationsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {operationsData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Success Rate</CardTitle>
            <CardDescription>Success vs Error Distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  {
                    name: "Transactions",
                    successful:
                      (result.data[0]?.transactions || 0) -
                      (result.data[0]?.error || 0),
                    failed: result.data[0]?.error || 0,
                    successRate: successRate,
                  },
                ]}
                stackOffset="expand"
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "successful")
                      return [`${value} successful transactions`, "Successful"];
                    if (name === "failed")
                      return [`${value} failed transactions`, "Failed"];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar
                  dataKey="successful"
                  stackId="a"
                  fill="#4ade80"
                  name="Successful"
                />
                <Bar
                  dataKey="failed"
                  stackId="a"
                  fill="#f87171"
                  name="Failed"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="px-6 py-4 text-sm">
            <div className="flex items-center justify-between">
              <div>Success Rate</div>
              <div className="font-medium">{successRate}%</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
