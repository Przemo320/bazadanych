const express = require('express');
const { Server, WebSocket } = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new Server({ server, path: '/ws' });

app.get('/', (req, res) => {
  res.send('WebSocket server działa');
});

let esp32Client = null;

function broadcastStatus(isConnected) {
  const msg = JSON.stringify({ type: 'device_status', connected: isConnected });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    const msg = message.toString();
    console.log(`Received: ${msg}`);

    if (msg === 'ESP32 Connected') {
      esp32Client = ws;
      console.log('ESP32 client registered');
      broadcastStatus(true);
    } else if (esp32Client && ws !== esp32Client) {
      esp32Client.send(msg);
    } else if (ws === esp32Client) {
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
    }
  });

  ws.on('close', () => {
    if (ws === esp32Client) {
      esp32Client = null;
      console.log('ESP32 client disconnected');
      broadcastStatus(false);
    }
    console.log('Client disconnected');
  });
});
