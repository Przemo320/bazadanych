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
const phoneClients = new Set();

function broadcastToPhones(message) {
  phoneClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('🔌 Nowy klient połączony');

  let isESP32 = false;

  ws.on('message', (message) => {
    const msg = message.toString();

    if (msg.startsWith('ID:')) {
      const id = msg.split(':')[1];
      if (id === 'ESP32') {
        esp32Client = ws;
        isESP32 = true;
        lastEsp32Ping = Date.now();
        console.log('✅ ESP32 połączone');
        broadcastToPhones({ type: 'device_status', connected: true });
      } else if (id === 'PHONE') {
        phoneClients.add(ws);
        console.log('📱 Aplikacja połączona');
        ws.send(JSON.stringify({ type: 'device_status', connected: !!esp32Client && (Date.now() - lastEsp32Ping < 5000) }));
      }
      return;
    }

    if (msg === 'ping' && isESP32) {
      lastEsp32Ping = Date.now();
      return;
    }

    if (!isESP32 && esp32Client && esp32Client.readyState === WebSocket.OPEN) {
      esp32Client.send(msg);
    }

    if (isESP32) {
      broadcastToPhones({ type: 'message', payload: msg });
    }
  });

  ws.on('close', () => {
    if (isESP32) {
      esp32Client = null;
      console.log('❌ ESP32 rozłączone');
      broadcastToPhones({ type: 'device_status', connected: false });
    } else {
      phoneClients.delete(ws);
      console.log('📴 Aplikacja rozłączona');
    }
  });
});

// Ping timeout
setInterval(() => {
  if (esp32Client && Date.now() - lastEsp32Ping > 5000) {
    console.log('⚠️ ESP32 nie pingowało — uznajemy za rozłączone');
    esp32Client = null;
    broadcastToPhones({ type: 'device_status', connected: false });
  }
}, 1000);
