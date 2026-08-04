(function () {
  const MAX_STORAGE = 30 * 1024 * 1024;

  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const errorEl = document.getElementById('error-message');
  const statusEl = document.getElementById('status-message');
  const joinBtn = document.getElementById('btn-join');
  const createBtn = document.getElementById('btn-create');
  const joinRoomId = document.getElementById('join-room-id');
  const newRoomId = document.getElementById('new-room-id');
  const newPassword = document.getElementById('new-password');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    statusEl.classList.add('hidden');
  }

  function showStatus(msg) {
    statusEl.textContent = msg;
    statusEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
  }

  function hideMessages() {
    errorEl.classList.add('hidden');
    statusEl.classList.add('hidden');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      hideMessages();
    });
  });

  joinBtn.addEventListener('click', async () => {
    const roomId = joinRoomId.value.trim().toLowerCase();
    if (!roomId) {
      showError('Please enter a room ID');
      return;
    }
    hideMessages();
    joinBtn.disabled = true;
    joinBtn.textContent = 'Loading...';

    try {
      const metaRaw = await GitHubStore.readFile(`data/rooms/${roomId}/meta.enc`);
      if (!metaRaw) {
        showError('Room not found');
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Room';
        return;
      }
      sessionStorage.setItem('vault-room', roomId);
      sessionStorage.setItem('vault-meta-raw', metaRaw);
      window.location.href = 'room.html';
    } catch (e) {
      showError('Failed to load room: ' + e.message);
    }
    joinBtn.disabled = false;
    joinBtn.textContent = 'Join Room';
  });

  createBtn.addEventListener('click', async () => {
    let roomId = newRoomId.value.trim().toLowerCase();
    const password = newPassword.value;

    if (!password || password.length < 4) {
      showError('Password must be at least 4 characters');
      return;
    }

    if (roomId && !/^[a-z0-9]+$/.test(roomId)) {
      showError('Room ID can only contain lowercase letters and numbers');
      return;
    }

    hideMessages();
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    try {
      if (!roomId) {
        roomId = VaultCrypto.generateRoomId();
      }

      const existing = await GitHubStore.readFile(`data/rooms/${roomId}/meta.enc`);
      if (existing) {
        showError('Room ID already exists. Choose another.');
        createBtn.disabled = false;
        createBtn.textContent = 'Create Room';
        return;
      }

      const meta = JSON.stringify({
        created: Date.now(),
        files: [],
        notes: '',
        links: [],
        version: 1
      });

      const encryptedMeta = await VaultCrypto.encrypt(meta, password);
      await GitHubStore.writeFile(
        `data/rooms/${roomId}/meta.enc`,
        encryptedMeta,
        `Create room ${roomId}`
      );

      sessionStorage.setItem('vault-room', roomId);
      sessionStorage.setItem('vault-meta-raw', encryptedMeta);
      window.location.href = 'room.html';
    } catch (e) {
      showError('Failed to create room: ' + e.message);
    }
    createBtn.disabled = false;
    createBtn.textContent = 'Create Room';
  });

  const urlRoom = new URLSearchParams(window.location.search).get('room');
  if (urlRoom) {
    joinRoomId.value = urlRoom;
  }
})();
