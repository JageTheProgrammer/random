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
    e.preventDefault();
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
  msg.textContent = isMine ? `${myAvatar} You: ${text}` : `${text}`;
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

  // Enable video chat button only after name is submitted
  const videoChatBtn = document.getElementById('videoChatBtn');
  videoChatBtn.disabled = false;

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

// PROFANITY FILTER
function containsBadWords(text) {
  const badWords = ['badword1', 'badword2', 'niga'];
  return badWords.some(word => text.toLowerCase().includes(word));
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

let localStream;
let peerConnection;
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function toggleVideoChat() {
  document.getElementById('video-chat').style.display = 'flex';
  startVideoChat();
}

async function startVideoChat() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;

    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = ({ streams: [stream] }) => {
      document.getElementById('remoteVideo').srcObject = stream;
    };

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('webrtc-candidate', candidate);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('webrtc-offer', offer);
  } catch (err) {
    console.error('Error starting video chat:', err);
  }
}

function initSocketEvents() {
  socket.on('waiting', () => {
    status.textContent = 'Waiting for someone to chat with...';
  });

  socket.on('matched', (data) => {
    status.textContent = `You are now chatting with ${data.partner}`;
    chat.innerHTML = '';
  });

  socket.on('message', (data) => {
    appendMessage(`${data.from}: ${data.msg}`, false);
    if (data.from !== myName) {
      pingSound.play().catch(e => console.warn('Sound error:', e));
      showNotification(`${data.from}: ${data.msg}`);
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

  // WebRTC signaling handlers
  socket.on('webrtc-offer', async (offer) => {
    try {
      peerConnection = new RTCPeerConnection(config);
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      document.getElementById('localVideo').srcObject = localStream;
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

      peerConnection.ontrack = ({ streams: [stream] }) => {
        document.getElementById('remoteVideo').srcObject = stream;
      };

      peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('webrtc-candidate', candidate);
      };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('webrtc-answer', answer);
    } catch (e) {
      console.error('Error handling webrtc-offer:', e);
    }
  });

  socket.on('webrtc-answer', async (answer) => {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error('Error handling webrtc-answer:', e);
    }
  });

  socket.on('webrtc-candidate', async (candidate) => {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('ICE candidate error:', e);
    }
  });
}

// Add event listener for the video chat button
document.getElementById('videoChatBtn').addEventListener('click', () => {
  toggleVideoChat();
});
