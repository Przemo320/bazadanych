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

function broadcastToPhones(message) {
  wss.clients.forEach(client => {
    if (client !== esp32Client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('📲 Nowy klient połączony');

  ws.on('message', (message) => {
    const msg = message.toString();

    // ESP32 się zidentyfikowało
    if (msg === 'ESP32 Connected') {
      esp32Client = ws;
      lastEsp32Ping = Date.now();
      console.log('🔌 ESP32 podłączone');
      broadcastToPhones({ type: 'device_status', connected: true });
      return;
    }

    // ping od ESP32
    if (msg === 'ping' && ws === esp32Client) {
      lastEsp32Ping = Date.now();
      return;
    }

    // wiadomość od aplikacji — przekaż do ESP32
    if (ws !== esp32Client && esp32Client && esp32Client.readyState === WebSocket.OPEN) {
      esp32Client.send(msg);
      return;
    }

    // wiadomość od ESP32 — przekaż do wszystkich aplikacji
    if (ws === esp32Client) {
      broadcastToPhones({ type: 'message', payload: msg });
    }
  });

  ws.on('close', () => {
    if (ws === esp32Client) {
      esp32Client = null;
      console.log('❌ ESP32 rozłączone');
      broadcastToPhones({ type: 'device_status', connected: false });
    } else {
      console.log('📴 Telefon/klient rozłączony');
    }
  });
});

// Watchdog dla ESP32 — timeout 5s
setInterval(() => {
  const now = Date.now();
  if (esp32Client && now - lastEsp32Ping > 2000) {
    console.log('⚠️ Brak pingu od ESP32 – uznajemy za rozłączone');
    esp32Client = null;
    broadcastToPhones({ type: 'device_status', connected: false });
  }
  else{
    broadcastToPhones({ type: 'device_status', connected: true });
  }
}, 1000);
