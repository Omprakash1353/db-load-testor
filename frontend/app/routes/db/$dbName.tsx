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
import * as z from "zod";

// Define validation schemas for each database type
const postgresSchema = z.object({
  clients: z.coerce
    .number()
    .min(2, "Clients must be at least 2")
    .max(15, "Clients cannot exceed 15"),
  threads: z.coerce
    .number()
    .min(2, "Threads must be at least 2")
    .max(5, "Threads cannot exceed 5"),
  scale: z.coerce
    .number()
    .min(50, "Scale must be at least 50")
    .max(120, "Scale cannot exceed 120"),
  testDuration: z.coerce
    .number()
    .min(60, "Test duration must be at least 60 seconds")
    .max(120, "Test duration cannot exceed 120 seconds"),
});

const mysqlSchema = z.object({
  threads: z.coerce
    .number()
    .min(2, "Threads must be at least 2")
    .max(5, "Threads cannot exceed 5"),
  scale: z.coerce
    .number()
    .min(50, "Scale must be at least 50")
    .max(120, "Scale cannot exceed 120"),
  testDuration: z.coerce
    .number()
    .min(60, "Test duration must be at least 60 seconds")
    .max(120, "Test duration cannot exceed 120 seconds"),
});

const mongodbSchema = z.object({
  clients: z.coerce
    .number()
    .min(2, "Clients must be at least 2")
    .max(15, "Clients cannot exceed 15"),
  threads: z.coerce
    .number()
    .min(2, "Threads must be at least 2")
    .max(5, "Threads cannot exceed 5"),
  scale: z.coerce
    .number()
    .min(50, "Scale must be at least 50")
    .max(120, "Scale cannot exceed 120"),
  testDuration: z.coerce
    .number()
    .min(60, "Test duration must be at least 60 seconds")
    .max(120, "Test duration cannot exceed 120 seconds"),
});

// Type definitions
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

// Type for form errors
type FormErrors = {
  [key: string]: string | undefined;
};

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
    clients: "10",
    threads: "2",
    scale: "100",
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
  const [errors, setErrors] = useState<FormErrors>({});

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

    // Clear the error for this field when user changes it
    if (errors[id]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[id];
        return newErrors;
      });
    }
  };

  const handleReset = () => {
    setConfig(getInitialConfig(dbName));
    setErrors({});
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

  const validateConfig = (db: string, configData: any): boolean => {
    try {
      let schema;
      switch (db.toLowerCase()) {
        case "postgresql":
          schema = postgresSchema;
          break;
        case "mongodb":
          schema = mongodbSchema;
          break;
        case "mysql":
          schema = mysqlSchema;
          break;
        default:
          throw new Error("Unsupported database type");
      }

      schema.parse(configData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: FormErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            formattedErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(formattedErrors);

        // Show toast with first validation error
        if (error.errors.length > 0) {
          toast.error(error.errors[0].message);
        }
      } else {
        toast.error("Validation failed");
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate the configuration
    const isValid = validateConfig(dbName, config);
    if (!isValid) {
      return;
    }

    setIsRunning(true);

    const configValues = Object.entries(config).reduce(
      (acc, [key, value]) => {
        acc[key] = parseInt(value as string);
        return acc;
      },
      {} as Record<string, number>
    );

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
      errors,
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
    <div className="mx-auto p-4 container">
      <h1 className="mb-4 font-bold text-2xl capitalize">
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
  errors: FormErrors;
}

function PostgresForm({
  config,
  handleChange,
  handleSubmit,
  handleReset,
  isRunning,
  errors,
}: FormProps) {
  const renderFormInput = (id: string, label: string, placeholder: string, min: string, max: string) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-medium text-foreground text-sm">
        {label}
      </Label>
      <Input
        type="number"
        id={id}
        name={id}
        min={min}
        max={max}
        value={config[id]}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full ${errors[id] ? "border-red-500" : ""}`}
      />
      {errors[id] && (
        <p className="mt-1 text-red-500 text-xs">{errors[id]}</p>
      )}
    </div>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">
          PostgreSQL Benchmark Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="gap-6 grid grid-cols-2">
          {renderFormInput("clients", "Clients", "10", "2", "15")}
          {renderFormInput("threads", "Threads", "2", "2", "5")}
        </div>
        <div className="gap-6 grid grid-cols-2">
          {renderFormInput("scale", "Scale", "100", "50", "120")}
          {renderFormInput("testDuration", "Test Duration (seconds)", "60", "60", "120")}
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
  errors,
}: FormProps) {
  const renderFormInput = (id: string, label: string, placeholder: string, min: string, max: string) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-medium text-foreground text-sm">
        {label}
      </Label>
      <Input
        type="number"
        id={id}
        name={id}
        min={min}
        max={max}
        value={config[id]}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full ${errors[id] ? "border-red-500" : ""}`}
      />
      {errors[id] && (
        <p className="mt-1 text-red-500 text-xs">{errors[id]}</p>
      )}
    </div>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">
          MySQL Benchmark Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="gap-6 grid grid-cols-2">
          {renderFormInput("threads", "Threads", "2", "2", "5")}
          {renderFormInput("scale", "Scale", "100", "50", "120")}
        </div>
        <div className="gap-6 grid grid-cols-2">
          {renderFormInput("testDuration", "Test Duration (seconds)", "60", "60", "120")}
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
  errors,
}: FormProps) {
  const renderFormInput = (id: string, label: string, placeholder: string, min: string, max: string) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-medium text-foreground text-sm">
        {label}
      </Label>
      <Input
        type="number"
        id={id}
        name={id}
        min={min}
        max={max}
        value={config[id]}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full ${errors[id] ? "border-red-500" : ""}`}
      />
      {errors[id] && (
        <p className="mt-1 text-red-500 text-xs">{errors[id]}</p>
      )}
    </div>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">
          MongoDB Benchmark Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="gap-6 grid grid-cols-2">
          {renderFormInput("clients", "Clients", "10", "2", "15")}
          {renderFormInput("threads", "Threads", "2", "2", "5")}
        </div>
        <div className="gap-6 grid grid-cols-2">
          {renderFormInput("scale", "Scale", "100", "50", "120")}
          {renderFormInput("testDuration", "Test Duration (seconds)", "60", "60", "120")}
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