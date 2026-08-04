(function () {
  const MAX_STORAGE = 30 * 1024 * 1024;

  const overlay = document.getElementById('password-overlay');
  const dashboard = document.getElementById('dashboard');
  const roomPasswordEl = document.getElementById('room-password');
  const unlockBtn = document.getElementById('btn-unlock');
  const overlayError = document.getElementById('overlay-error');
  const overlayRoomId = document.getElementById('overlay-room-id');
  const dashRoomId = document.getElementById('dash-room-id');
  const roomUrlBadge = document.getElementById('room-url-badge');
  const lockBtn = document.getElementById('btn-lock');

  const fileInput = document.getElementById('file-input');
  const uploadArea = document.getElementById('upload-area');
  const fileListEl = document.getElementById('file-list');
  const filesEmpty = document.getElementById('files-empty');
  const uploadProgressBar = document.getElementById('upload-progress-bar');
  const uploadProgressFill = document.getElementById('upload-progress-fill');
  const storageUsed = document.getElementById('storage-used');

  const noteText = document.getElementById('note-text');
  const saveNoteBtn = document.getElementById('btn-save-note');

  const linkUrl = document.getElementById('link-url');
  const linkLabel = document.getElementById('link-label');
  const addLinkBtn = document.getElementById('btn-add-link');
  const linkListEl = document.getElementById('link-list');
  const linksEmpty = document.getElementById('links-empty');

  const dashError = document.getElementById('dash-error');

  let roomId = null;
  let roomPassword = null;
  let meta = null;
  let isDirty = false;

  const roomFromStorage = sessionStorage.getItem('vault-room');
  if (!roomFromStorage) {
    overlayError.textContent = 'No room selected. Go back to create or join a room.';
    overlayError.classList.remove('hidden');
    return;
  }
  roomId = roomFromStorage;
  overlayRoomId.textContent = 'Room: ' + roomId;
  dashRoomId.textContent = roomId;

  const shareUrl = window.location.origin + window.location.pathname.replace('room.html', '') + '?room=' + roomId;
  roomUrlBadge.addEventListener('click', () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      roomUrlBadge.textContent = 'Copied!';
      setTimeout(() => { roomUrlBadge.textContent = 'Share Link'; }, 1500);
    });
  });

  lockBtn.addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'index.html';
  });

  function showDashError(msg) {
    dashError.textContent = msg;
    dashError.classList.remove('hidden');
    setTimeout(() => dashError.classList.add('hidden'), 4000);
  }

  async function unlock() {
    const password = roomPasswordEl.value;
    if (!password) {
      overlayError.textContent = 'Please enter the password';
      overlayError.classList.remove('hidden');
      return;
    }

    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Decrypting...';
    overlayError.classList.add('hidden');

    try {
      const raw = await GitHubStore.readFile(`data/rooms/${roomId}/meta.enc`);
      if (!raw) {
        overlayError.textContent = 'Room not found';
        overlayError.classList.remove('hidden');
        unlockBtn.disabled = false;
        unlockBtn.textContent = 'Unlock';
        return;
      }

      const decrypted = await VaultCrypto.decrypt(raw, password);
      meta = JSON.parse(decrypted);
      roomPassword = password;
      sessionStorage.setItem('vault-meta-raw', raw);

      overlay.classList.add('hidden');
      dashboard.classList.remove('hidden');
      renderAll();
    } catch (e) {
      overlayError.textContent = 'Wrong password or corrupted data';
      overlayError.classList.remove('hidden');
    }
    unlockBtn.disabled = false;
    unlockBtn.textContent = 'Unlock';
  }

  unlockBtn.addEventListener('click', unlock);
  roomPasswordEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') unlock();
  });

  async function saveMeta() {
    const encrypted = await VaultCrypto.encrypt(JSON.stringify(meta), roomPassword);
    await GitHubStore.writeFile(`data/rooms/${roomId}/meta.enc`, encrypted, `Update room ${roomId}`);
    sessionStorage.setItem('vault-meta-raw', encrypted);
    isDirty = false;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
      xlsx: '📊', xls: '📊', csv: '📊',
      pdf: '📕', doc: '📝', docx: '📝',
      png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
      zip: '📦', rar: '📦', '7z': '📦',
      txt: '📄', json: '📄', xml: '📄',
      mp4: '🎬', mov: '🎬', avi: '🎬',
      mp3: '🎵', wav: '🎵',
    };
    return icons[ext] || '📁';
  }

  function getTotalSize() {
    let total = 0;
    (meta.files || []).forEach(f => { total += f.size || 0; });
    return total;
  }

  function renderAll() {
    renderFiles();
    renderNotes();
    renderLinks();
    updateStorage();
  }

  async function renderFiles() {
    fileListEl.innerHTML = '';
    const files = meta.files || [];
    if (files.length === 0) {
      fileListEl.classList.add('hidden');
      filesEmpty.classList.remove('hidden');
    } else {
      fileListEl.classList.remove('hidden');
      filesEmpty.classList.add('hidden');
      files.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `
          <div class="file-info">
            <span class="file-icon">${getIcon(file.name)}</span>
            <span class="file-name">${escapeHtml(file.name)}</span>
            <span class="file-size">${formatSize(file.size)}</span>
          </div>
          <div class="file-actions">
            <button class="btn small primary download-btn" data-index="${index}">⬇</button>
            <button class="btn small danger delete-btn" data-index="${index}">✕</button>
          </div>
        `;
        fileListEl.appendChild(li);
      });

      fileListEl.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.index);
          await downloadFile(idx);
        });
      });

      fileListEl.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.index);
          await deleteFile(idx);
        });
      });
    }
  }

  function renderNotes() {
    noteText.value = meta.notes || '';
  }

  function renderLinks() {
    linkListEl.innerHTML = '';
    const links = meta.links || [];
    if (links.length === 0) {
      linkListEl.classList.add('hidden');
      linksEmpty.classList.remove('hidden');
    } else {
      linkListEl.classList.remove('hidden');
      linksEmpty.classList.add('hidden');
      links.forEach((link, index) => {
        const li = document.createElement('li');
        li.className = 'link-item';
        li.innerHTML = `
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label || link.url)}</a>
          <button class="btn small danger link-delete-btn" data-index="${index}">✕</button>
        `;
        linkListEl.appendChild(li);
      });

      linkListEl.querySelectorAll('.link-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.index);
          meta.links.splice(idx, 1);
          await saveMeta();
          renderLinks();
        });
      });
    }
  }

  function updateStorage() {
    const total = getTotalSize();
    storageUsed.textContent = formatSize(total);
  }

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });

  async function handleFiles(files) {
    let total = getTotalSize();
    for (const file of files) {
      total += file.size;
    }
    if (total > MAX_STORAGE) {
      showDashError('Upload would exceed 30 MB storage limit');
      return;
    }

    uploadProgressBar.classList.remove('hidden');
    uploadProgressFill.style.width = '0%';

    let failed = 0;
    const fileArr = Array.from(files);
    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      try {
        const fileId = 'f' + Date.now() + '_' + i;
        const encrypted = await VaultCrypto.encryptFile(file, roomPassword);
        await GitHubStore.writeFile(
          `data/rooms/${roomId}/files/${fileId}.enc`,
          encrypted,
          `Upload ${file.name}`
        );
        meta.files = meta.files || [];
        meta.files.push({
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          uploaded: Date.now()
        });
      } catch (e) {
        failed++;
        showDashError('Upload failed: ' + e.message);
      }
      uploadProgressFill.style.width = ((i + 1) / fileArr.length * 100) + '%';
    }

    if (failed < fileArr.length) {
      try {
        await saveMeta();
      } catch (e) {
        showDashError('Failed to save: ' + e.message);
      }
    }

    uploadProgressBar.classList.add('hidden');
    renderAll();
  }

  async function downloadFile(index) {
    const file = meta.files[index];
    if (!file) return;
    try {
      const encrypted = await GitHubStore.readFile(`data/rooms/${roomId}/files/${file.id}.enc`);
      if (!encrypted) {
        showDashError('File not found');
        return;
      }
      const decrypted = await VaultCrypto.decryptFile(encrypted, roomPassword);
      const blob = new Blob([decrypted], { type: file.type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showDashError('Download failed: ' + e.message);
    }
  }

  async function deleteFile(index) {
    const file = meta.files[index];
    if (!file) return;
    if (!confirm(`Delete "${file.name}"?`)) return;
    try {
      await GitHubStore.deleteFile(
        `data/rooms/${roomId}/files/${file.id}.enc`,
        `Delete ${file.name}`
      );
      meta.files.splice(index, 1);
      await saveMeta();
      renderAll();
    } catch (e) {
      showDashError('Delete failed: ' + e.message);
    }
  }

  saveNoteBtn.addEventListener('click', async () => {
    meta.notes = noteText.value;
    await saveMeta();
    saveNoteBtn.textContent = 'Saved!';
    setTimeout(() => { saveNoteBtn.textContent = 'Save Note'; }, 1500);
  });

  addLinkBtn.addEventListener('click', async () => {
    const url = linkUrl.value.trim();
    const label = linkLabel.value.trim();
    if (!url) {
      showDashError('Please enter a URL');
      return;
    }
    meta.links = meta.links || [];
    meta.links.push({ url, label: label || null });
    await saveMeta();
    linkUrl.value = '';
    linkLabel.value = '';
    renderLinks();
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  if (sessionStorage.getItem('vault-meta-raw')) {
    roomPasswordEl.focus();
  }
})();
