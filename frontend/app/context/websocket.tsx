import { useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

interface WebSocketContextType {
  result: any;
  isConnected: boolean;
  ws: WebSocket | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:8080");

    websocket.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
    };

    websocket.onclose = () => {
      console.log("WebSocket connection closed");
      setIsConnected(false);
    };

    websocket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setIsConnected(false);
      toast.error("WebSocket connection error");
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket data:", data);
        setResult(data);

        if (data.status === "completed") {
          toast.success("Benchmark completed successfully!");
          // Navigate to the stats page with the result ID
          navigate({
            to: "/stats/$statsId",
            params: {
              statsId: data.statsId.toString(),
            },
          });
        } else if (data.status === "failed") {
          toast.error("Benchmark failed. Please check the logs.");
          navigate({ to: "/db/$dbName", params: { dbName: "postgresql" } });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        toast.error("Error processing benchmark results");
      }
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [navigate]);

  return (
    <WebSocketContext.Provider value={{ result, isConnected, ws }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
