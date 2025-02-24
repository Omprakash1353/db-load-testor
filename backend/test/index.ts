const ws = new WebSocket("ws://localhost:8080");

ws.onopen = () => {
  console.log("Connected to WebSocket server");
  ws.send(JSON.stringify({ message: "Hello from client!" }));
};

ws.onmessage = (event) => {
  console.log("Received:", event.data);
};

ws.onclose = () => {
  console.log("Disconnected from WebSocket server");
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

var i = 0;
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ message: `Periodic message: ${i}` }));
    i++;
  }
}, 5000);
