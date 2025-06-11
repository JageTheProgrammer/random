const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); // This creates the 'io' object

const app = express();
const server = http.createServer(app);
const io = new Server(server); // 💡 This defines 'io'

app.use(express.static('public'));

const adjectives = ['Red', 'Blue', 'Green', 'Yellow', 'Quick', 'Lazy', 'Happy'];
const animals = ['Tiger', 'Elephant', 'Fox', 'Panda', 'Giraffe', 'Cat', 'Dog'];

function generateNickname() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(Math.random() * 100);
  return ${adj}${animal}${number};
}

let waitingUser = null;

io.on('connection', (socket) => {
  const customName = socket.handshake.query.name;
  socket.nickname = customName || generateNickname();
  console.log(${socket.nickname} connected: ${socket.id});

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

    console.log(${socket.nickname} disconnected);
  });
});

server.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});
