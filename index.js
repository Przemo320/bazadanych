const express = require('express');
const { Server, WebSocket } = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new Server({ server, path: '/ws' });

let esp32Client = null;

function broadcastStatus(isConnected) {
  const message = JSON.stringify({ type: 'device_status', connected: isConnected });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Nowy klient połączony');

  ws.on('message', (message) => {
    const msg = message.toString();

    if (msg === 'ESP32 Connected') {
      esp32Client = ws;
      console.log('ESP32 połączone i zarejestrowane');
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
      console.log('ESP32 się rozłączyło');
      broadcastStatus(false);
    }
    console.log('Klient się rozłączył');
  });
});

// Heartbeat co 3 sekundy, żeby aplikacje wiedziały czy ESP32 jest online
setInterval(() => {
  broadcastStatus(!!esp32Client);
}, 3000);
