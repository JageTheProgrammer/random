let socket;
let myName = '';
let myAvatar = '';
const avatars = ['🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵'];
const pingSound = document.getElementById('pingSound');

const chat = document.getElementById('chat');
const status = document.getElementById('status');
const input = document.getElementById('msgInput');

input.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault(); // Prevent form submission or new line
    sendMessage();
  }
});

// THEME SETUP
const savedTheme = localStorage.getItem('theme') || 'dark';
document.body.classList.add(savedTheme);

document.getElementById('theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
  const currentTheme = document.body.classList.contains('light') ? 'light' : 'dark';
  localStorage.setItem('theme', currentTheme);
});

// EMOJI PICKER
const picker = new EmojiButton();
const emojiBtn = document.getElementById('emoji-button');

picker.on('emoji', emoji => {
  input.value += emoji;
  input.focus();
});

emojiBtn.addEventListener('click', () => picker.togglePicker(emojiBtn));


// MESSAGES
function appendMessage(text, isMine = false) {
  const msg = document.createElement('div');
  msg.textContent = isMine ? ${myAvatar} You: ${text} : ${text};
  msg.style.margin = '5px 0';
  msg.style.textAlign = 'left';
  msg.style.color = isMine ? '#007bff' : '#ccc';
  if (isMine) msg.style.fontWeight = 'bold';
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

// NAME INPUT
function submitName() {
  const nameField = document.getElementById('nameInput');
  myName = nameField.value.trim() || 'Anonymous';
  myAvatar = avatars[Math.floor(Math.random() * avatars.length)];
  document.getElementById('namePrompt').style.display = 'none';

  input.disabled = false;
  document.querySelector('button[onclick="sendMessage()"]').disabled = false;
  document.querySelector('button[onclick="nextChat()"]').disabled = false;

  socket = io({ query: { name: myName } });
  initSocketEvents();
  Notification.requestPermission();

}

function showNotification(msg) {
  if (Notification.permission === 'granted') {
    new Notification('New message', { body: msg });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('New message', { body: msg });
      }
    });
  }
}

// SOCKET EVENTS
function initSocketEvents() {
  socket.on('waiting', () => {
    status.textContent = 'Waiting for someone to chat with...';
  });

  socket.on('matched', (data) => {
    status.textContent = You are now chatting with ${data.partner};
    chat.innerHTML = '';
  });

  socket.on('message', (data) => {
  appendMessage(${data.from}: ${data.msg}, false);
  if (data.from !== myName) {
    pingSound.play().catch(e => console.warn('Sound error:', e));
    showNotification(${data.from}: ${data.msg});
  }
  });

  socket.on('partner_left', () => {
    status.textContent = 'Stranger disconnected.';
  });

  socket.on('typing', () => {
    status.textContent = 'Stranger is typing...';
  });

  socket.on('stop_typing', () => {
    status.textContent = 'You are now chatting.';
  });

  input.addEventListener('input', () => {
    if (input.value) {
      socket.emit('typing');
    } else {
      socket.emit('stop_typing');
    }
  });
}

// SEND MESSAGE
function sendMessage() {
  const msg = input.value.trim();
  if (msg) {
    if (containsBadWords(msg)) {
      appendMessage("🚫 Message blocked due to inappropriate language.");
    } else {
      appendMessage(msg, true);
      socket.emit('message', msg);
    }
    input.value = '';
    socket.emit('stop_typing');
  }
}

// NEXT CHAT
function nextChat() {
  chat.innerHTML = '';
  socket.emit('next');
}

// PROFANITY FILTER
function containsBadWords(text) {
  const badWords = ['badword1', 'badword2', 'hell'];
  return badWords.some(word => text.toLowerCase().includes(word));
}
