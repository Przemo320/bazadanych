const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const port = 3000;
const colorFilePath = './color.json';
const dataFilePath = './data.json';

let lastPingTime = null;
let pingFailCount = 0; // Licznik niepowodzeń pingu
const TIMEOUT_INTERVAL = 5000; // 15 sekund - czas po którym uznajemy, że Arduino jest rozłączone

app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serwuje pliki statyczne, w tym index.html

// Endpoint do odbierania "pinga" od Arduino
app.get('/ping', (req, res) => {
  lastPingTime = Date.now();
  pingFailCount = 0; // Resetuj licznik pingu przy udanym pingowaniu
  res.status(200).send('Ping odebrany!');
});

// Endpoint do odbierania danych temperatury i wilgotności
app.post('/data', (req, res) => {
  const newData = req.body;
  fs.writeFileSync(dataFilePath, JSON.stringify(newData, null, 2));
  res.status(200).send('Dane nadpisane pomyślnie!');
});

// Endpoint do ustawiania koloru
app.post('/color', (req, res) => {
  const colorData = req.body;
  fs.writeFileSync(colorFilePath, JSON.stringify(colorData, null, 2));
  res.status(200).send('Kolor ustawiony pomyślnie!');
});

// Endpoint do pobierania bieżącego koloru
app.get('/color', (req, res) => {
  let data = { red: 0, green: 0, blue: 0 };
  if (fs.existsSync(colorFilePath)) {
    data = JSON.parse(fs.readFileSync(colorFilePath));
  }
  res.json(data);
});

// Endpoint do sprawdzania statusu połączenia
app.get('/status', (req, res) => {
  if (lastPingTime && (Date.now() - lastPingTime < TIMEOUT_INTERVAL)) {
    res.json({ status: 'connected' });
  } else {
    pingFailCount++;
    if (pingFailCount >= 2) {
      res.json({ status: 'disconnected' });
    } else {
      res.json({ status: 'connected' });
    }
  }
});

// Endpoint do serwowania strony głównej
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
  console.log(`Serwer uruchomiony na http://localhost:${port}`);
});
