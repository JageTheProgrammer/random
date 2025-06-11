const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const USERS_FILE = path.join(__dirname, 'users.json');

// Middleware
app.use(express.static('public'));
app.use(express.json());

// 📁 Load users or create file
let users = {};
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE));
}

// 📌 Auth Routes
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (users[username]) return res.status(400).json({ error: 'User already exists' });

  const hashed = await bcrypt.hash(password, 10);
  users[username] = { password: hashed };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users));
  res.json({ message: 'User registered' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// 🎯 Auth middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Auth token missing"));

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.username = payload.username;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// 🎤 Socket.IO Chat Logic
const adjectives = ['Red', 'Blue', 'Green', 'Yellow', 'Quick', 'Lazy', 'Happy'];
const animals = ['Tiger', 'Elephant', 'Fox', 'Panda', 'Giraffe', 'Cat', 'Dog'];
function generateNickname() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(Math.random() * 100);
  return `${adj}${animal}${number}`;
}

let waitingUser = null;

io.on('connection', (socket) => {
  const customName = socket.handshake.query.name;
  socket.nickname = customName || generateNickname();
  console.log(`${socket.nickname} connected as ${socket.username} (${socket.id})`);

  if (waitingUser && waitingUser !== socket) {
    socket.partner = waitingUser;
    waitingUser.partner = socket;

    socket.emit('matched', { partner: waitingUser.nickname });
    waitingUser.emit('matched', { partner: socket.nickname });

    waitingUser = null;
  } else {
    waitingUser = socket;
    socket.emit('waiting');
  }

  socket.on('typing', () => {
    if (socket.partner) socket.partner.emit('typing');
  });

  socket.on('stop_typing', () => {
    if (socket.partner) socket.partner.emit('stop_typing');
  });

  socket.on('message', (msg) => {
    if (socket.partner) {
      socket.partner.emit('message', { from: socket.nickname, msg });
    }
  });

  socket.on('next', () => {
    if (socket.partner) {
      socket.partner.emit('partner_left');
      socket.partner.partner = null;
    }
    socket.partner = null;

    if (waitingUser && waitingUser !== socket) {
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit('matched', { partner: waitingUser.nickname });
      waitingUser.emit('matched', { partner: socket.nickname });

      waitingUser = null;
    } else {
      waitingUser = socket;
      socket.emit('waiting');
    }
  });

  socket.on('disconnect', () => {
    if (socket.partner) {
      socket.partner.emit('partner_left');
      socket.partner.partner = null;
    }
    if (waitingUser === socket) waitingUser = null;
    console.log(`${socket.nickname} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
