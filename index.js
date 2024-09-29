const express = require('express');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const { exec } = require('child_process'); // Dodanie child_process
const app = express();

app.set("view engine", "ejs");
app.set("views", "./views");

// Konfiguracja ścieżek statycznych
const pathPublic = path.join(__dirname, "public");
app.use(express.static(pathPublic));

// Konfiguracja miejsca zapisu plików
const uploadFolder = 'uploads/';
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadFolder);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.bin') {
            cb(null, true);
        } else {
            cb(new Error('Only .bin files are allowed'), false);
        }
    }
});

// Renderowanie strony głównej za pomocą EJS


const colorFilePath = './color.json';
const dataFilePath = './data.json';

let lastPingTime = null;
let pingFailCount = 0; // Licznik niepowodzeń pingu
const TIMEOUT_INTERVAL = 5000; // 15 sekund - czas po którym uznajemy, że Arduino jest rozłączone

app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serwuje pliki statyczne, w tym index.html

app.get('/', (req, res) => {
  res.render("index"); // Renderuje plik views/index.ejs
});

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

app.get('/update', (req, res) => {
    res.render("update"); // Renderuje plik views/index.ejs
});

// Renderowanie strony za pomocą PHP

// Pobieranie najnowszego pliku
app.get('/latest', (req, res) => {
    fs.readdir(uploadFolder, (err, files) => {
        if (err) {
            return res.status(500).send('Server error');
        }

        if (files.length === 0) {
            return res.status(404).send('No files found');
        }

        // Sortowanie plików według daty modyfikacji
        files.sort((a, b) => fs.statSync(path.join(uploadFolder, b)).mtime - fs.statSync(path.join(uploadFolder, a)).mtime);
        const latestFile = files[0];
        res.json({ filename: latestFile, url: `/uploads/${latestFile}` });
    });
});

// Endpoint do przesyłania plików
app.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        res.send('File uploaded successfully: ' + req.file.filename);
    } else {
        res.status(400).send('Only .bin files are allowed!');
    }
});

// Serwowanie plików z folderu uploads
app.use('/uploads', express.static(uploadFolder));

// Obsługa błędów
app.use((err, req, res, next) => {
    if (err.message === 'Only .bin files are allowed') {
        res.status(400).send('Only .bin files are allowed!');
    } else {
        res.status(500).send('An unknown error occurred.');
    }
});

// Uruchomienie serwera
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});