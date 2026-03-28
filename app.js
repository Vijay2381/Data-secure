/* app.js — SecureLink Frontend Logic */

// ============================================================
// STATE
// ============================================================
const state = {
  currentUser: null,
  users: JSON.parse(localStorage.getItem('sl_users') || '{}'),
  partnerConnected: JSON.parse(localStorage.getItem('sl_partner') || 'false'),
  messages: JSON.parse(localStorage.getItem('sl_messages') || 'null'),
  voiceCallTimer: null,
  videoCallTimer: null,
  voiceSeconds: 0,
  videoSeconds: 0,
  isMuted: false,
  isCameraOff: false,
  emojiOpen: false,
};

// Demo messages seeded initially
const defaultMessages = [
  { id: 1, type: 'received', text: "Hey love! 💕 How's your day going?", time: "9:32 AM", mediaType: null },
  { id: 2, type: 'sent', text: "Missing you so much 🥺❤️ Everything's better when I talk to you", time: "9:34 AM", mediaType: null },
  { id: 3, type: 'received', text: "I sent you something special 😊", time: "9:35 AM", mediaType: null },
  { id: 4, type: 'received', text: null, time: "9:35 AM", mediaType: 'image', mediaSrc: 'https://images.unsplash.com/photo-1518791841217-8f162f1912da?w=300&h=200&fit=crop' },
  { id: 5, type: 'sent', text: "That's so cute!! 😍🥰 You're the best", time: "9:37 AM", mediaType: null },
  { id: 6, type: 'sent', text: null, time: "9:38 AM", mediaType: 'video', mediaSrc: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=300&h=180&fit=crop', videoDuration: '0:32' },
  { id: 7, type: 'received', text: "I love you so much! 💖 Can't wait to see you", time: "9:40 AM", mediaType: null },
];

if (!state.messages) state.messages = [...defaultMessages];

// ============================================================
// UTILITY
// ============================================================
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.style.display = 'none'; }, duration);
}

function formatTime(d = new Date()) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSeconds(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function saveState() {
  localStorage.setItem('sl_messages', JSON.stringify(state.messages));
  localStorage.setItem('sl_partner', JSON.stringify(state.partnerConnected));
  localStorage.setItem('sl_users', JSON.stringify(state.users));
}

// ============================================================
// SCREEN NAVIGATION
// ============================================================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const el = document.getElementById('screen-' + name);
  if (el) {
    el.style.display = 'flex';
    el.classList.add('active');
  }
}

// ============================================================
// AUTH — SIGNUP
// ============================================================
function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;

  if (password !== confirm) { showToast('❌ Passwords do not match'); return; }
  if (password.length < 8) { showToast('❌ Password must be at least 8 characters'); return; }
  if (state.users[email]) { showToast('⚠️ Account already exists. Please log in.'); return; }

  state.users[email] = { name, email, passcode: generatePasscode() };
  state.currentUser = state.users[email];
  saveState();
  enterApp();
}

// ============================================================
// AUTH — LOGIN
// ============================================================
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  if (!email || !password) { showToast('⚠️ Please fill in all fields'); return; }

  // For demo: accept any credentials (create user if not exists)
  if (!state.users[email]) {
    state.users[email] = { name: email.split('@')[0], email, passcode: generatePasscode() };
  }
  state.currentUser = state.users[email];
  saveState();
  enterApp();
}

function enterApp() {
  const user = state.currentUser;
  const name = user ? user.name : 'You';
  const initial = name.charAt(0).toUpperCase();

  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-avatar').textContent = initial;

  const pc = user && user.passcode ? user.passcode : generatePasscode();
  if (user && !user.passcode) { user.passcode = pc; saveState(); }
  document.getElementById('my-passcode').textContent = pc;

  showScreen('dashboard');
  switchTab('chats', document.getElementById('nav-chats'));
  renderMessages();
  scheduleIncomingCall();
}

function handleLogout() {
  state.currentUser = null;
  stopVoiceCallTimer();
  stopVideoCallTimer();
  showScreen('splash');
}

// ============================================================
// PASSCODE
// ============================================================
function generatePasscode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = (n) => Array.from({length: n}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `SL-${r(4)}-${r(4)}`;
}

function copyPasscode() {
  const pc = document.getElementById('my-passcode').textContent;
  navigator.clipboard.writeText(pc).catch(() => {});
  showToast('📋 Passcode copied! Share it with your partner.');
}

function formatPasscode(input) {
  let v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length > 2) v = 'SL-' + v.replace(/^SL/, '').replace(/-/g, '');
  // format: SL-XXXX-XXXX
  let raw = v.replace(/^SL-?/, '').replace(/[^A-Z0-9]/g, '');
  let out = 'SL-';
  if (raw.length > 4) out += raw.slice(0, 4) + '-' + raw.slice(4, 8);
  else out += raw.slice(0, 4);
  input.value = out;
}

function connectPartner() {
  const input = document.getElementById('partner-passcode').value.trim();
  if (input.length < 7) { showToast('⚠️ Please enter a valid passcode'); return; }
  state.partnerConnected = true;
  saveState();
  document.getElementById('connect-success').style.display = 'block';
  document.querySelector('.connect-form').style.display = 'none';
  document.querySelector('.passcode-display').style.display = 'none';
  document.querySelector('.divider-or').style.display = 'none';
  document.getElementById('nav-chats').querySelector('.nav-label').textContent = 'Chats';
  showToast('🎉 Connected to Jamie securely!');
}

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(tabName, navEl) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById('tab-' + tabName);
  if (panel) panel.classList.add('active');
  if (navEl) navEl.classList.add('active');
  const titleMap = { chats: 'Chats', connect: 'Connect Partner', calls: 'Calls', videocalls: 'Video Calls' };
  document.getElementById('topbar-title').textContent = titleMap[tabName] || tabName;
  // Close sidebar on mobile
  if (window.innerWidth <= 768) closeSidebar();
  return false;
}

// ============================================================
// SIDEBAR
// ============================================================
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ============================================================
// CHAT: OPEN / CLOSE (mobile)
// ============================================================
function openChat() {
  document.getElementById('chat-window-panel').classList.add('active');
  scrollMessages();
}
function closeChat() {
  document.getElementById('chat-window-panel').classList.remove('active');
}

// ============================================================
// MESSAGES: RENDER
// ============================================================
function renderMessages() {
  const area = document.getElementById('messages-area');
  area.innerHTML = '<div class="date-divider"><span>Today</span></div>';

  state.messages.forEach(msg => {
    const el = buildMessageEl(msg);
    area.appendChild(el);
  });

  const notice = document.createElement('div');
  notice.className = 'e2e-notice';
  notice.textContent = '🔒 Messages are end-to-end encrypted. Only you and Jamie can read them.';
  area.appendChild(notice);

  scrollMessages();
}

function buildMessageEl(msg) {
  const div = document.createElement('div');
  div.className = `message ${msg.type}`;
  div.id = `msg-${msg.id}`;

  if (msg.mediaType === 'image') {
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'msg-media';
    const img = document.createElement('img');
    img.src = msg.mediaSrc;
    img.alt = 'Shared image';
    img.onerror = () => { img.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="260" height="180"><rect fill="%23333" width="260" height="180"/><text x="130" y="90" text-anchor="middle" fill="%23888" font-size="14">Image</text></svg>`; };
    img.onclick = () => openImagePreview(msg.mediaSrc);
    mediaWrap.appendChild(img);
    div.appendChild(mediaWrap);
  } else if (msg.mediaType === 'video') {
    const mediaWrap = document.createElement('div');
    mediaWrap.className = msg.type === 'sent' ? 'msg-media sent-media' : 'msg-media';
    const vThumb = document.createElement('div');
    vThumb.className = 'video-thumb';
    const img = document.createElement('img');
    img.src = msg.mediaSrc;
    img.alt = 'Video thumbnail';
    img.onerror = () => { img.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="260" height="160"><rect fill="%23333" width="260" height="160"/></svg>`; };
    const playBtn = document.createElement('div');
    playBtn.className = 'play-btn';
    playBtn.textContent = '▶';
    playBtn.onclick = () => showToast('▶ Video playback — backend required');
    vThumb.appendChild(img);
    vThumb.appendChild(playBtn);
    const label = document.createElement('span');
    label.className = 'video-label';
    label.textContent = `Video · ${msg.videoDuration || '0:00'}`;
    mediaWrap.appendChild(vThumb);
    mediaWrap.appendChild(label);
    div.appendChild(mediaWrap);
  } else if (msg.text) {
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = msg.text;
    div.appendChild(bubble);
  }

  const timeEl = document.createElement('span');
  timeEl.className = 'msg-time';
  timeEl.textContent = msg.type === 'sent' ? `${msg.time} ✓✓` : msg.time;
  div.appendChild(timeEl);

  return div;
}

function scrollMessages(smooth = false) {
  const area = document.getElementById('messages-area');
  if (area) area.scrollTo({ top: area.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

// ============================================================
// SEND MESSAGE
// ============================================================
function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text) return;

  const msg = { id: Date.now(), type: 'sent', text, time: formatTime(), mediaType: null };
  state.messages.push(msg);
  saveState();

  const el = buildMessageEl(msg);
  const area = document.getElementById('messages-area');
  const notice = area.querySelector('.e2e-notice');
  area.insertBefore(el, notice);
  scrollMessages(true);

  input.value = '';
  document.getElementById('emoji-picker').style.display = 'none';
  state.emojiOpen = false;

  // Simulate reply after delay
  if (Math.random() < 0.6) {
    setTimeout(() => simulateReply(), 1500 + Math.random() * 2000);
  }
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

const autoReplies = [
  "I love you so much! ❤️", "You're the best thing that ever happened to me 🥰",
  "Can't wait to see you! 💕", "Thinking of you always 🌹", "You make me so happy 😊",
  "Miss you like crazy 🥺", "Forever and always 💖", "You're my everything ✨",
  "Just smiled reading that 😍", "I'm so lucky to have you 🍀",
];

function simulateReply() {
  const text = autoReplies[Math.floor(Math.random() * autoReplies.length)];
  const msg = { id: Date.now(), type: 'received', text, time: formatTime(), mediaType: null };
  state.messages.push(msg);
  saveState();
  const el = buildMessageEl(msg);
  const area = document.getElementById('messages-area');
  const notice = area.querySelector('.e2e-notice');
  area.insertBefore(el, notice);
  scrollMessages(true);
  updateChatListPreview(text);
}

function updateChatListPreview(text) {
  const preview = document.querySelector('.chat-item-msg');
  if (preview) preview.textContent = '🔒 ' + text;
  const timeEl = document.querySelector('.chat-item-time');
  if (timeEl) timeEl.textContent = 'Just now';
}

// ============================================================
// FILE UPLOAD
// ============================================================
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target.result;
    const isVideo = file.type.startsWith('video/');
    const msg = {
      id: Date.now(), type: 'sent', text: null, time: formatTime(),
      mediaType: isVideo ? 'video' : 'image',
      mediaSrc: src,
      videoDuration: '0:00',
    };
    state.messages.push(msg);
    saveState();
    const el = buildMessageEl(msg);
    const area = document.getElementById('messages-area');
    const notice = area.querySelector('.e2e-notice');
    area.insertBefore(el, notice);
    scrollMessages(true);
    showToast(isVideo ? '🎥 Video shared!' : '🖼️ Image shared!');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

// ============================================================
// EMOJI PICKER
// ============================================================
function toggleEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  state.emojiOpen = !state.emojiOpen;
  picker.style.display = state.emojiOpen ? 'block' : 'none';
}

function insertEmoji(emoji) {
  const input = document.getElementById('message-input');
  input.value += emoji;
  input.focus();
}

// ============================================================
// PASSWORD TOGGLE
// ============================================================
function togglePassword(id, btn) {
  const input = document.getElementById(id);
  if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
  else { input.type = 'password'; btn.textContent = '👁️'; }
}

// ============================================================
// IMAGE PREVIEW
// ============================================================
function openImagePreview(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain;';
  overlay.appendChild(img);
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

// ============================================================
// VOICE CALL
// ============================================================
function startVoiceCallFrom(from) {
  document.getElementById('voice-call-overlay').style.display = 'flex';
  document.getElementById('voice-call-state').textContent = '🔒 Encrypted Call';
  state.voiceSeconds = 0;
  updateVoiceTimer();
  state.voiceCallTimer = setInterval(() => {
    state.voiceSeconds++;
    updateVoiceTimer();
    if (state.voiceSeconds === 3) document.getElementById('voice-call-state').textContent = '🟢 Connected · Encrypted';
  }, 1000);
}

function updateVoiceTimer() {
  document.getElementById('voice-call-timer').textContent = formatSeconds(state.voiceSeconds);
}

function stopVoiceCallTimer() {
  clearInterval(state.voiceCallTimer);
  state.voiceCallTimer = null;
}

function endVoiceCall() {
  stopVoiceCallTimer();
  document.getElementById('voice-call-overlay').style.display = 'none';
  const dur = formatSeconds(state.voiceSeconds);
  showToast(`📞 Call ended · ${dur}`);
  addCallToHistory('voice', dur);
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  const btn = document.getElementById('mute-btn');
  btn.querySelector('span').textContent = state.isMuted ? '🔇' : '🎙️';
  btn.querySelector('label').textContent = state.isMuted ? 'Unmute' : 'Mute';
  showToast(state.isMuted ? '🔇 Muted' : '🎙️ Unmuted');
}

function toggleSpeaker() { showToast('🔊 Speaker toggled'); }

function switchToVideoCall() {
  endVoiceCall();
  setTimeout(() => startVideoCallFrom('switch'), 300);
}

function toggleCallKeypad() { showToast('🔢 Keypad — coming soon'); }

// ============================================================
// VIDEO CALL
// ============================================================
function startVideoCallFrom(from) {
  document.getElementById('video-call-overlay').style.display = 'flex';
  state.videoSeconds = 0;
  updateVideoTimer();
  state.videoCallTimer = setInterval(() => {
    state.videoSeconds++;
    updateVideoTimer();
  }, 1000);
}

function updateVideoTimer() {
  document.getElementById('video-call-timer').textContent = formatSeconds(state.videoSeconds);
}

function stopVideoCallTimer() {
  clearInterval(state.videoCallTimer);
  state.videoCallTimer = null;
}

function endVideoCall() {
  stopVideoCallTimer();
  document.getElementById('video-call-overlay').style.display = 'none';
  const dur = formatSeconds(state.videoSeconds);
  showToast(`🎥 Video call ended · ${dur}`);
  addCallToHistory('video', dur);
}

function toggleCamera() {
  state.isCameraOff = !state.isCameraOff;
  const btn = document.getElementById('vcam-btn');
  btn.querySelector('span').textContent = state.isCameraOff ? '🚫' : '📹';
  showToast(state.isCameraOff ? '📷 Camera off' : '📹 Camera on');
}

function toggleVideoMute() {
  state.isMuted = !state.isMuted;
  const btn = document.getElementById('vmic-btn');
  btn.querySelector('span').textContent = state.isMuted ? '🔇' : '🎙️';
  showToast(state.isMuted ? '🔇 Mic muted' : '🎙️ Mic on');
}

function flipCamera() { showToast('🔄 Camera flipped'); }
function shareScreen() { showToast('🖥️ Screen sharing — backend required'); }

// ============================================================
// ADD CALL TO HISTORY LIST
// ============================================================
function addCallToHistory(type, duration) {
  const list = type === 'video'
    ? document.querySelector('#tab-videocalls .calls-list')
    : document.querySelector('#tab-calls .calls-list');
  if (!list) return;
  const item = document.createElement('div');
  item.className = 'call-item';
  const icon = type === 'video' ? '🎥' : '📤';
  item.innerHTML = `
    <div class="call-avatar outgoing">J</div>
    <div class="call-info">
      <span class="call-name">Jamie ❤️</span>
      <span class="call-meta outgoing-call">${icon} Outgoing · ${duration}</span>
    </div>
    <span class="call-time">Just now</span>
  `;
  list.prepend(item);
}

// ============================================================
// INCOMING CALL SIMULATION
// ============================================================
function scheduleIncomingCall() {
  setTimeout(() => {
    triggerIncomingCall('voice');
  }, 8000);
}

function triggerIncomingCall(type) {
  const overlay = document.getElementById('incoming-call-overlay');
  document.getElementById('incoming-call-type').textContent =
    type === 'video' ? '📹 Incoming Video Call...' : '📞 Incoming Voice Call...';
  overlay._callType = type;
  overlay.style.display = 'flex';
  window._incomingTimeout = setTimeout(() => {
    if (overlay.style.display !== 'none') {
      overlay.style.display = 'none';
      showToast('📵 Missed call from Jamie');
    }
  }, 12000);
}

function acceptCall() {
  const overlay = document.getElementById('incoming-call-overlay');
  const type = overlay._callType || 'voice';
  overlay.style.display = 'none';
  clearTimeout(window._incomingTimeout);
  if (type === 'video') startVideoCallFrom('incoming');
  else startVoiceCallFrom('incoming');
}

function rejectCall() {
  document.getElementById('incoming-call-overlay').style.display = 'none';
  clearTimeout(window._incomingTimeout);
  showToast('📵 Call declined');
}

// ============================================================
// SETTINGS
// ============================================================
function showSettings() {
  document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettings(e) {
  if (!e || e.target === document.getElementById('settings-modal')) {
    document.getElementById('settings-modal').style.display = 'none';
  }
}

function saveSettings() {
  const name = document.getElementById('settings-name').value.trim() || 'You';
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-avatar').textContent = name.charAt(0).toUpperCase();
  if (state.currentUser) {
    state.currentUser.name = name;
    saveState();
  }
  closeSettings();
  showToast('✅ Settings saved');
}

// ============================================================
// CLOSE EMOJI PICKER ON OUTSIDE CLICK
// ============================================================
document.addEventListener('click', (e) => {
  const picker = document.getElementById('emoji-picker');
  const emojiBtn = document.querySelector('.emoji-btn');
  if (picker && emojiBtn && !picker.contains(e.target) && !emojiBtn.contains(e.target)) {
    picker.style.display = 'none';
    state.emojiOpen = false;
  }
});

// ============================================================
// SIDEBAR OVERLAY CLOSE (mobile)
// ============================================================
document.addEventListener('click', (e) => {
  const sb = document.getElementById('sidebar');
  const hb = document.getElementById('hamburger-btn');
  if (sb && hb && window.innerWidth <= 768 && sb.classList.contains('open')) {
    if (!sb.contains(e.target) && !hb.contains(e.target)) closeSidebar();
  }
});

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  // Check if user is already "logged in" (demo: just show splash)
  const savedUser = localStorage.getItem('sl_current_user');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
      // Still show splash for security
    } catch(e) {}
  }
  showScreen('splash');

  // Auto-open chat panel on desktop
  if (window.innerWidth > 768) {
    document.getElementById('chat-window-panel').classList.add('active');
  }
});
