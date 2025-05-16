const express = require('express');
const { Server, WebSocket } = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new Server({ server, path: '/ws' });

let esp32Client = null;
let lastEsp32Ping = 0;

function broadcastStatus(isConnected) {
  const message = JSON.stringify({ type: 'device_status', connected: isConnected });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Sprawdzaj czy ESP32 pingował ostatnio (timeout 5s)
setInterval(() => {
  const now = Date.now();
  if (esp32Client && now - lastEsp32Ping > 5000) {
    console.log("ESP32 nie pingowało od 5s, uznajemy za offline");
    esp32Client = null;
    broadcastStatus(false);
  }
}, 1000);

wss.on('connection', (ws) => {
  console.log('Nowy klient połączony');

  ws.on('message', (message) => {
    const msg = message.toString();

    if (msg === 'ESP32 Connected') {
      esp32Client = ws;
      lastEsp32Ping = Date.now();
      console.log('ESP32 połączone i zarejestrowane');
      broadcastStatus(true);
    } else if (msg === 'ping' && ws === esp32Client) {
      lastEsp32Ping = Date.now();
      // można też odesłać pong jeśli chcesz
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
