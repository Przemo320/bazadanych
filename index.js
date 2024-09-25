const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

app.set("view engine","ejs")
app.set("views","./views")

const pathPublic=path.join(__dirname,"public")
app.use(express.static(pathPublic))

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

// Renderowanie strony głównej
app.get('/', (req, res) => {
    res.render("index");
});

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