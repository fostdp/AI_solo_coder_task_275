const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./experiments.db', (err) => {
  if (err) {
    console.error('数据库连接错误:', err.message);
  } else {
    console.log('已连接到SQLite数据库');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  frequency REAL NOT NULL,
  harmonic INTEGER NOT NULL,
  wavelength REAL NOT NULL,
  wave_speed REAL DEFAULT 343,
  tube_length REAL NOT NULL,
  show_molecules INTEGER DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) {
    console.error('创建表错误:', err.message);
  }
});

app.post('/api/experiments', (req, res) => {
  const { frequency, harmonic, wavelength, waveSpeed, tubeLength, showMolecules } = req.body;
  const sql = `INSERT INTO experiments (frequency, harmonic, wavelength, wave_speed, tube_length, show_molecules) 
               VALUES (?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [frequency, harmonic, wavelength, waveSpeed, tubeLength, showMolecules ? 1 : 0], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: '实验数据保存成功' });
  });
});

app.get('/api/experiments', (req, res) => {
  const sql = `SELECT * FROM experiments ORDER BY timestamp DESC LIMIT 50`;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});