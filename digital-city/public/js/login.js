const form = document.getElementById('auth-form');
const errorBox = form.querySelector('.form-error');
const submit = form.querySelector('button[type=submit]');
const extra = form.querySelector('.only-register');
let mode = 'login';

// Already signed in? Go straight to the city.
fetch('/api/me').then((r) => { if (r.ok) location.replace('/game'); });

document.querySelectorAll('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    mode = tab.dataset.mode;
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    extra.hidden = mode !== 'register';
    form.password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    submit.textContent = mode === 'register' ? 'ساخت حساب و ورود' : 'ورود به شهر';
    showError('');
  }),
);

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = !msg;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = form.username.value.trim();
  const password = form.password.value;
  if (!/^[\p{L}\p{N}_]{3,20}$/u.test(username)) return showError('نام کاربری ۳ تا ۲۰ کاراکتر و فقط حروف، عدد و _');
  if (password.length < 8) return showError('رمز عبور حداقل ۸ کاراکتر است');
  if (mode === 'register' && password !== form.password2.value) return showError('تکرار رمز عبور یکسان نیست');
  submit.disabled = true;
  try {
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showError(data.error || 'خطا؛ دوباره تلاش کنید');
    location.replace('/game');
  } catch {
    showError('اتصال به سرور برقرار نشد');
  } finally {
    submit.disabled = false;
  }
});
