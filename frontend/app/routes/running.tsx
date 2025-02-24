import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useWebSocket } from "@/context/websocket";

export const Route = createFileRoute("/running")({
  component: RunningComponent,
});

function RunningComponent() {
  const { isConnected } = useWebSocket();

  return (
    <div className="container mx-auto h-screen flex flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin mx-auto" />
        <h1 className="text-2xl font-bold">
          Benchmarking is in progress... please wait for a while
        </h1>
        <p className="text-muted-foreground">
          Please wait while we run your benchmark test. This may take a few
          minutes...
        </p>
        <div className="text-sm text-muted-foreground">
          You will be automatically redirected to the results page when the test
          is complete.
        </div>
        {!isConnected && (
          <div className="text-red-500">
            Warning: WebSocket connection lost. Results may not update automatically.
          </div>
        )}
      </div>
    </div>
  );
}