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
  const json = JSON.stringify(message);
  phoneClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('🔌 Nowe połączenie — oczekuję identyfikatora');

  let isESP32 = false;

  ws.on('message', (message) => {
    const msg = message.toString();

    // ID:ESP32 lub ID:PHONE
    if (msg.startsWith('ID:')) {
      const id = msg.split(':')[1];
      if (id === 'ESP32') {
        esp32Client = ws;
        isESP32 = true;
        lastEsp32Ping = Date.now();
        console.log('✅ ESP32 zidentyfikowane');
      } else if (id === 'PHONE') {
        phoneClients.add(ws);
        console.log('📱 Telefon zidentyfikowany');
      }
      return;
    }

    // ping od ESP32
    if (msg === 'ping' && isESP32) {
      lastEsp32Ping = Date.now();
      return;
    }

    // wiadomość od telefonu → do ESP32
    if (!isESP32 && esp32Client && esp32Client.readyState === WebSocket.OPEN) {
      esp32Client.send(msg);
    }

    // wiadomość od ESP32 → do telefonów
    if (isESP32) {
      broadcastToPhones({ type: 'message', payload: msg });
    }
  });

  ws.on('close', () => {
    if (isESP32) {
      if (esp32Client === ws) {
        console.log('❌ ESP32 rozłączyło się');
        esp32Client = null;
      }
    } else {
      phoneClients.delete(ws);
      console.log('📴 Telefon się rozłączył');
    }
  });
});

// 🕒 Co sekundę: sprawdzaj timeout i rozsyłaj device_status do wszystkich telefonów
setInterval(() => {
  const espConnected = esp32Client && (Date.now() - lastEsp32Ping < 5000);

  // jeśli timeout → reset ESP32
  if (esp32Client && !espConnected) {
    console.log('⚠️ Brak pinga od ESP32 — uznajemy za rozłączone');
    esp32Client = null;
  }

  // rozsyłaj device_status do aplikacji co 1 sek.
  broadcastToPhones({ type: 'device_status', connected: !!espConnected });
}, 1000);
