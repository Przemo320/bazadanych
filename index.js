const express = require('express');
const { Server, WebSocket } = require('ws'); // Import WebSocket class

const app = express();
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log('Server running on port 8080');
});

const wss = new Server({ server, path: '/ws' });

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let esp32Client = null;

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const msg = message.toString();
        console.log(`Received: ${msg}`);

        if (msg === 'ESP32 Connected') {
            esp32Client = ws;
            console.log('ESP32 client registered');
        } else if (esp32Client && ws !== esp32Client) {
            // Wiadomość od przeglądarki, przekaż do ESP32
            esp32Client.send(msg);
        } else if (ws === esp32Client) {
            // Wiadomość od ESP32, przekaż do wszystkich klientów
            wss.clients.forEach((client) => {
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
        }
        console.log('Client disconnected');
    });
});
