/* FreshFlow login / sign up page.
   Accounts live in this browser's localStorage (demo-level, no server); passwords are SHA-256 hashed.
   Default account: admin / FreshFlow@123 */
const $ = id => document.getElementById(id);
const USERS_KEY = 'ff_users';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2500);
}

async function hashPw(p) {
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('freshflow:' + p));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return 'plain:' + p;
}

async function getUsers() {
  const users = store.get(USERS_KEY) || [];
  if (!users.some(u => u.username === 'admin')) {
    users.unshift({ username: 'admin', name: 'Production Manager', hash: await hashPw('FreshFlow@123') });
    store.set(USERS_KEY, users);
  }
  return users;
}

function startSession(user) {
  const s = JSON.stringify({ username: user.username, name: user.name });
  try { sessionStorage.setItem('ff_session', s); } catch (e) {}
  window.name = 'ff_session:' + s;   // fallback so the dashboard page can read it
  location.href = 'index.html';
}

function showAuth(which) {
  $('loginForm').classList.toggle('hidden', which !== 'login');
  $('signupForm').classList.toggle('hidden', which !== 'signup');
  $('loginError').textContent = ''; $('signupError').textContent = '';
  $(which === 'login' ? 'loginUser' : 'suName').focus();
}

$('toSignup').onclick = e => { e.preventDefault(); showAuth('signup'); };
$('toLogin').onclick = e => { e.preventDefault(); showAuth('login'); };
document.querySelectorAll('[data-eye]').forEach(b => b.addEventListener('click', () => {
  const i = $(b.dataset.eye);
  i.type = i.type === 'password' ? 'text' : 'password';
}));

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('loginError'); err.className = 'auth-error';
  const username = $('loginUser').value.trim(), pass = $('loginPass').value;
  if (!username || !pass) { err.textContent = 'Enter your username and password.'; return; }
  const users = await getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || user.hash !== await hashPw(pass)) { err.textContent = 'Incorrect username or password.'; return; }
  startSession(user);
});

$('signupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('signupError'); err.className = 'auth-error';
  const name = $('suName').value.trim(), username = $('suUser').value.trim(),
    pass = $('suPass').value, confirm = $('suConfirm').value;
  if (!name) { err.textContent = 'Enter your full name.'; return; }
  if (!/^[A-Za-z0-9_]{4,20}$/.test(username)) { err.textContent = 'Username must be 4–20 letters, numbers or underscores.'; return; }
  if (pass.length < 6 || !/[A-Za-z]/.test(pass) || !/\d/.test(pass)) { err.textContent = 'Password needs at least 6 characters with a letter and a number.'; return; }
  if (pass !== confirm) { err.textContent = 'Passwords do not match.'; return; }
  const users = await getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) { err.textContent = 'That username is already taken.'; return; }
  users.push({ username, name, hash: await hashPw(pass) });
  store.set(USERS_KEY, users);
  $('signupForm').reset();
  showAuth('login');
  $('loginUser').value = username;
  $('loginPass').focus();
  $('loginError').className = 'auth-error ok';
  $('loginError').textContent = 'Account created. Log in with your new password.';
});

getUsers().then(() => showAuth('login'));
