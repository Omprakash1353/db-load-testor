import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWebSocket } from "@/context/websocket";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface BenchmarkResult {
  type?: string;
  status?: string;
  timestamp?: string;
  data?: {
    raw: string;
    parsed: {
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
    };
  };
}

const DEFAULT_CONFIGS = {
  postgresql: {
    clients: "10",
    threads: "2",
    scale: "100",
    testDuration: "60",
  },
  mysql: {
    threads: "2",
    scale: "100",
    testDuration: "60",
  },
  mongodb: {
    threads: "2",
    operations: "1000000",
    recordcount: "1000000",
    workload: "workloada",
    testDuration: "60",
  },
} as const;

export const Route = createFileRoute("/db/$dbName")({
  component: RouteComponent,
});

function RouteComponent() {
  const { dbName } = Route.useParams();
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const { isConnected, result } = useWebSocket();

  useEffect(() => {
    if (result?.status === "completed") {
      setIsRunning(false);
      navigate({ to: "/stats/$statsId", params: { statsId: "1" } });
    } else if (result?.status === "failed") {
      setIsRunning(false);
      toast.error("Benchmark failed. Please check the logs.");
    }
  }, [result, navigate]);

  const getInitialConfig = (db: string) => {
    switch (db.toLowerCase()) {
      case "postgresql":
        return { ...DEFAULT_CONFIGS.postgresql };
      case "mongodb":
        return { ...DEFAULT_CONFIGS.mongodb };
      case "mysql":
        return { ...DEFAULT_CONFIGS.mysql };
      default:
        return {};
    }
  };

  const [config, setConfig] = useState(getInitialConfig(dbName));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setConfig((prev) => ({ ...prev, [id]: value }));
  };

  const handleReset = () => {
    setConfig(getInitialConfig(dbName));
  };

  const getEndpoint = (db: string) => {
    switch (db.toLowerCase()) {
      case "postgresql":
        return "run-pg";
      case "mongodb":
        return "run-mongo";
      case "mysql":
        return "run-mysql";
      default:
        throw new Error("Unsupported database type");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);

    // Validate the configuration
    const configValues = Object.entries(config).reduce(
      (acc, [key, value]) => {
        acc[key] = parseInt(value as string) || 0;
        return acc;
      },
      {} as Record<string, number>
    );

    if (Object.values(configValues).some((value) => value <= 0)) {
      toast.error("All values must be greater than 0");
      setIsRunning(false);
      return;
    }

    try {
      const endpoint = getEndpoint(dbName);
      console.log("Starting benchmark test for:", dbName);
      console.log("Configuration:", configValues);

      const response = await fetch(`http://localhost:3001/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configValues),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log("Benchmark started successfully:", data);

      toast.success("Benchmark test started successfully!", {
        description: "You will be redirected to the progress page.",
      });

      // Small delay before redirect to ensure toast is visible
      await new Promise((resolve) => setTimeout(resolve, 1000));
      navigate({ to: "/running" });
    } catch (error) {
      console.error("Error starting benchmark test:", error);
      toast.error("Failed to start benchmark", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
      setIsRunning(false);
    }
  };

  const renderForm = (dbType: string) => {
    const formProps = {
      config,
      handleChange,
      handleSubmit,
      handleReset,
      isRunning,
    };

    switch (dbType.toLowerCase()) {
      case "postgresql":
        return <PostgresForm {...formProps} />;
      case "mongodb":
        return <MongoForm {...formProps} />;
      case "mysql":
        return <MySQLForm {...formProps} />;
      default:
        return <div>Unsupported database type</div>;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 capitalize">
        {dbName} Benchmark Configuration
      </h1>
      {renderForm(dbName)}
    </div>
  );
}

interface FormProps {
  config: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleReset: () => void;
  isRunning: boolean;
}

function PostgresForm({
  config,
  handleChange,
  handleSubmit,
  handleReset,
  isRunning,
}: FormProps) {
  const renderFormInput = (id: string, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        type="text"
        id={id}
        name={id}
        value={config[id]}
        onChange={handleChange}
        placeholder={placeholder || ""}
        className="w-full"
      />
    </div>
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">
          PostgreSQL Benchmark Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {renderFormInput("clients", "Clients", "10")}
          {renderFormInput("threads", "Threads", "2")}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {renderFormInput("scale", "Scale", "100")}
          {renderFormInput("testDuration", "Test Duration (seconds)", "60")}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-4">
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button type="submit" disabled={isRunning} onClick={handleSubmit}>
          {isRunning ? "Running Benchmark..." : "Run Benchmark"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function MySQLForm({
  config,
  handleChange,
  handleSubmit,
  handleReset,
  isRunning,
}: FormProps) {
  const renderFormInput = (id: string, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        type="text"
        id={id}
        name={id}
        value={config[id]}
        onChange={handleChange}
        placeholder={placeholder || ""}
        className="w-full"
      />
    </div>
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">
          MySQL Benchmark Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {renderFormInput("threads", "Threads", "2")}
          {renderFormInput("scale", "Scale", "100")}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {renderFormInput("testDuration", "Test Duration (seconds)", "60")}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-4">
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button type="submit" disabled={isRunning} onClick={handleSubmit}>
          {isRunning ? "Running Benchmark..." : "Run Benchmark"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function MongoForm({
  config,
  handleChange,
  handleSubmit,
  handleReset,
  isRunning,
}: FormProps) {
  const renderFormInput = (id: string, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        type="text"
        id={id}
        name={id}
        value={config[id]}
        onChange={handleChange}
        placeholder={placeholder || ""}
        className="w-full"
      />
    </div>
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground">
          MongoDB YCSB Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {renderFormInput("threads", "Threads", "2")}
          {renderFormInput("operations", "Operations", "1000000")}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {renderFormInput("recordcount", "Record Count", "1000000")}
          {renderFormInput("workload", "Workload Type", "workloada")}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {renderFormInput("testDuration", "Test Duration (seconds)", "60")}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-4">
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button type="submit" disabled={isRunning} onClick={handleSubmit}>
          {isRunning ? "Running Benchmark..." : "Run Benchmark"}
        </Button>
      </CardFooter>
    </Card>
  );
}
