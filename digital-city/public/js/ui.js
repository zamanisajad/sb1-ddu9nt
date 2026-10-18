// HUD helpers and modal panels. All user-provided text goes through
// textContent / attribute setters — never innerHTML — so it can't inject markup.
import { OUTFITS, SHOP } from '/shared/world.js';

export const $ = (id) => document.getElementById(id);
const fa = new Intl.NumberFormat('fa-IR');
export const num = (n) => fa.format(Math.floor(n));

export function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    location.replace('/');
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'خطا در ارتباط با سرور');
  return data;
}

// ------------------------------------------------------------ toasts
export function toast(text, kind = '') {
  const t = el('div', { class: `toast ${kind}`, text });
  $('feed').prepend(t);
  setTimeout(() => t.remove(), 4500);
  while ($('feed').children.length > 6) $('feed').lastChild.remove();
}

// ------------------------------------------------------------ modal
let onModalClose = null;
export function openModal(...content) {
  const body = $('modal-body');
  body.replaceChildren(...content);
  $('modal').hidden = false;
  document.activeElement?.blur?.();
}
export function closeModal() {
  $('modal').hidden = true;
  $('modal-body').replaceChildren();
  onModalClose?.();
  onModalClose = null;
}
export const modalOpen = () => !$('modal').hidden;
$('modal-close').addEventListener('click', closeModal);
$('modal').addEventListener('click', (e) => e.target === $('modal') && closeModal());
document.addEventListener('keydown', (e) => e.key === 'Escape' && modalOpen() && closeModal());

const errorLine = () => el('p', { class: 'form-error', hidden: true });
const showErr = (line, msg) => {
  line.textContent = msg;
  line.hidden = !msg;
};

// External link as a real <a> so it works in new tabs, popup blockers and
// sandboxed iframes alike.
const extLink = (href, text, cls = 'btn primary small') =>
  el('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer nofollow', text });

const domainOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

// ------------------------------------------------------------ images
// Resize to max 256px and re-encode as JPEG under 300KB before uploading.
export async function compressImage(file, max = 256) {
  if (!file.type.startsWith('image/')) throw new Error('فقط فایل عکس قابل قبول است');
  if (file.size > 15 * 1024 * 1024) throw new Error('فایل خیلی بزرگ است');
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error('این فایل عکس قابل خواندن نیست');
  }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  for (let q = 0.85; q >= 0.4; q -= 0.15) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length * 0.75 < 290 * 1024) return url;
  }
  throw new Error('عکس بعد از فشرده‌سازی هنوز بزرگ است');
}

function imagePicker(initialSrc) {
  let value; // undefined = unchanged, null = removed, string = new data URL
  const preview = initialSrc ? el('img', { class: 'preview-img', src: initialSrc, alt: '' }) : el('div', { class: 'preview-img' });
  const err = errorLine();
  const input = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    if (!f) return;
    try {
      value = await compressImage(f);
      const img = el('img', { class: 'preview-img', src: value, alt: '' });
      wrap.firstChild.replaceWith(img);
      showErr(err, '');
    } catch (e) {
      showErr(err, e.message);
    }
  });
  const wrap = el('div', { class: 'row' }, preview,
    el('button', { type: 'button', class: 'btn small', text: 'انتخاب عکس', onclick: () => input.click() }), input);
  return { node: el('div', {}, wrap, err), get value() { return value; } };
}

// ------------------------------------------------------------ bank prompt
export function showPrompt(content) {
  const p = $('prompt');
  if (!content) {
    p.hidden = true;
    p.dataset.key = '';
    return;
  }
  if (p.dataset.key === content.key) return;
  p.dataset.key = content.key;
  p.replaceChildren(...content.nodes);
  p.hidden = false;
}

// ------------------------------------------------------------ shop (visitor)
export async function openPlayerShop(shopMeta, myId) {
  openModal(el('h2', { text: shopMeta.name }), el('p', { class: 'muted', text: 'در حال بارگذاری…' }));
  let data;
  try {
    data = await api('GET', `/api/shops/${shopMeta.id}`);
  } catch (e) {
    return openModal(el('h2', { text: shopMeta.name }), el('p', { class: 'form-error', text: e.message }));
  }
  const { shop, products } = data;
  const mine = shop.owner_user_id === myId;
  openModal(
    el('h2', { text: `🏪 ${shop.name}` }),
    el('p', { class: 'muted', text: `فروشنده: ${shop.owner}` }),
    el('div', { class: 'notice', text:
      'این بازی خودش پرداخت را انجام نمی‌دهد. با زدن «خرید» به لینک پرداختی که خود فروشنده گذاشته منتقل می‌شوید؛ مسئولیت پرداخت و ارسال با فروشنده است.' }),
    products.length
      ? el('div', { class: 'grid' }, products.map((p) => productCard(p)))
      : el('p', { class: 'muted', text: mine ? 'هنوز محصولی اضافه نکرده‌اید. از دکمه‌ی 🏪 بالای صفحه محصول اضافه کنید.' : 'این مغازه هنوز محصولی ندارد.' }),
  );
}

function productCard(p) {
  return el('div', { class: 'card' },
    p.has_image ? el('img', { src: `/api/img/product/${p.id}?v=${p.image_version}`, alt: p.title, loading: 'lazy' }) : el('div', { class: 'ph', text: '📦' }),
    el('div', { class: 'title', text: p.title }),
    el('div', { class: 'price', text: `${num(p.price)} تومان` }),
    p.description ? el('div', { class: 'desc', text: p.description }) : null,
    el('div', { class: 'desc', text: `پرداخت در: ${domainOf(p.payment_link)}` }),
    el('div', { class: 'actions-row' }, extLink(p.payment_link, 'خرید ↗')),
  );
}

export function openBrandShop(brand) {
  openModal(
    el('h2', { text: brand.name }),
    el('p', { class: 'muted', text: 'این یک فروشگاه واقعی است و در سایت خودش باز می‌شود.' }),
    el('div', { class: 'row' }, extLink(brand.url, `رفتن به ${brand.name} ↗`, 'btn primary')),
  );
}

// ------------------------------------------------------------ my shop (owner)
export async function openMyShop(state) {
  const me = await api('GET', '/api/me');
  state.bank = me.bank;
  if (!me.shop) return openBuyShop(state);
  return openManageShop(state, me.shop);
}

function openBuyShop(state) {
  const err = errorLine();
  const name = el('input', { maxlength: 30, placeholder: 'مثلاً: کافه‌ی سجاد' });
  const logo = imagePicker(null);
  const canAfford = state.bank >= SHOP.price;
  const buy = el('button', {
    type: 'button', class: 'btn gold wide', text: `خرید مغازه — ${num(SHOP.price)} فیت‌کوین`, disabled: !canAfford,
    onclick: async () => {
      buy.disabled = true;
      try {
        const out = await api('POST', '/api/shop', { name: name.value, logo: logo.value ?? undefined });
        state.onWallet(out.bank);
        toast('مغازه‌ات ساخته شد! حالا محصول اضافه کن.', 'good');
        openManageShop(state, out.shop);
      } catch (e) {
        showErr(err, e.message);
        buy.disabled = false;
      }
    },
  });
  openModal(
    el('h2', { text: '🏪 مغازه‌ی خودت را بخر' }),
    el('p', { class: 'muted', text: `هزینه از فیت‌کوین بانکی کم می‌شود (موجودی: ${num(state.bank)}). مغازه در یک جای خالی شهر ساخته می‌شود و همه آن را می‌بینند.` }),
    canAfford ? null : el('div', { class: 'notice', text: 'فیت‌کوین بانکی کافی نداری. امتیاز جمع کن و در گلوبانک واریز کن.' }),
    el('label', { class: 'field' }, 'نام مغازه', name),
    el('div', { class: 'field' }, 'لوگو (اختیاری)', logo.node),
    err, buy,
  );
}

function openManageShop(state, shop) {
  const err = errorLine();
  const name = el('input', { maxlength: 30, value: shop.name });
  const logo = imagePicker(shop.has_logo ? `/api/img/shop/${shop.id}?v=${shop.logo_version}` : null);
  const list = el('div', { class: 'list' });
  const save = el('button', {
    type: 'button', class: 'btn small', text: 'ذخیره نام و لوگو',
    onclick: async () => {
      try {
        const body = { name: name.value };
        if (logo.value !== undefined) body.logo = logo.value;
        await api('PUT', '/api/shop', body);
        toast('ذخیره شد', 'good');
        showErr(err, '');
      } catch (e) {
        showErr(err, e.message);
      }
    },
  });
  const refresh = async () => {
    const { products } = await api('GET', `/api/shops/${shop.id}`);
    list.replaceChildren(
      ...products.map((p) =>
        el('div', { class: 'list-item' },
          p.has_image ? el('img', { src: `/api/img/product/${p.id}?v=${p.image_version}`, alt: '' }) : el('div', { class: 'ph', text: '📦' }),
          el('div', { class: 'grow' }, el('div', { text: p.title }), el('div', { class: 'muted', text: `${num(p.price)} تومان` })),
          el('button', { type: 'button', class: 'btn small', text: 'ویرایش', onclick: () => productForm(state, shop, p) }),
          el('button', {
            type: 'button', class: 'btn small danger', text: 'حذف',
            onclick: async () => {
              if (!confirm(`«${p.title}» حذف شود؟`)) return;
              await api('DELETE', `/api/shop/products/${p.id}`).catch((e) => toast(e.message, 'bad'));
              refresh();
            },
          }),
        )),
    );
    if (!products.length) list.append(el('p', { class: 'muted', text: 'هنوز محصولی نداری.' }));
  };
  openModal(
    el('h2', { text: `🏪 ${shop.name}` }),
    el('p', { class: 'muted', text: 'مغازه‌ات در شهر ساخته شده؛ بقیه با رفتن جلوی درش و زدن «ورود» محصولاتت را می‌بینند.' }),
    el('label', { class: 'field' }, 'نام مغازه', name),
    el('div', { class: 'field' }, 'لوگو', logo.node),
    err, save,
    el('h2', { text: 'محصولات', style: 'margin-top:18px' }),
    el('button', { type: 'button', class: 'btn primary', text: '+ افزودن محصول', onclick: () => productForm(state, shop, null) }),
    list,
  );
  refresh();
}

function productForm(state, shop, p) {
  const err = errorLine();
  const title = el('input', { maxlength: 60, value: p?.title ?? '' });
  const price = el('input', { type: 'number', min: 0, step: 1000, inputmode: 'numeric', value: p ? String(p.price) : '' });
  const link = el('input', { type: 'url', dir: 'ltr', maxlength: 500, placeholder: 'https://zarinp.al/…', value: p?.payment_link ?? '' });
  const desc = el('textarea', { maxlength: 300 });
  desc.value = p?.description ?? '';
  const image = imagePicker(p?.has_image ? `/api/img/product/${p.id}?v=${p.image_version}` : null);
  const submit = el('button', {
    type: 'button', class: 'btn primary wide', text: p ? 'ذخیره‌ی تغییرات' : 'افزودن محصول',
    onclick: async () => {
      submit.disabled = true;
      const body = { title: title.value, price: Number(price.value || 0), payment_link: link.value.trim(), description: desc.value };
      if (image.value !== undefined) body.image = image.value;
      try {
        if (p) await api('PUT', `/api/shop/products/${p.id}`, body);
        else await api('POST', '/api/shop/products', body);
        toast('محصول ذخیره شد', 'good');
        openManageShop(state, shop);
      } catch (e) {
        showErr(err, e.message);
        submit.disabled = false;
      }
    },
  });
  openModal(
    el('h2', { text: p ? 'ویرایش محصول' : 'محصول جدید' }),
    el('label', { class: 'field' }, 'عنوان', title),
    el('label', { class: 'field' }, 'قیمت (تومان) — فقط برای نمایش', price),
    el('label', { class: 'field' }, 'لینک پرداخت (درگاه یا صفحه‌ی پرداخت خودت)', link),
    el('div', { class: 'notice', text: 'بازی پرداخت را پردازش نمی‌کند؛ خریدار با زدن «خرید» مستقیم به همین لینک می‌رود.' }),
    el('label', { class: 'field' }, 'توضیحات (اختیاری)', desc),
    el('div', { class: 'field' }, 'عکس محصول', image.node),
    err, submit,
    el('button', { type: 'button', class: 'btn wide', style: 'margin-top:8px', text: 'بازگشت', onclick: () => openManageShop(state, shop) }),
  );
}

// ------------------------------------------------------------ outfits
export function openOutfits(state) {
  const render = () => {
    openModal(
      el('h2', { text: '👕 لباس‌ها' }),
      el('p', { class: 'muted', text: `خرید با فیت‌کوین بانکی. موجودی: ${num(state.bank)}` }),
      el('div', { class: 'grid' }, OUTFITS.map((o) => {
        const owned = state.owned.includes(o.id);
        const equipped = state.outfit === o.id;
        const err = errorLine();
        const btn = el('button', {
          type: 'button',
          class: `btn small ${owned ? '' : 'gold'}`,
          text: equipped ? 'پوشیده‌ای' : owned ? 'بپوش' : `خرید ${num(o.price)}`,
          disabled: equipped || (!owned && state.bank < o.price),
          onclick: async () => {
            try {
              if (owned) {
                await api('POST', '/api/outfits/equip', { id: o.id });
              } else {
                const out = await api('POST', '/api/outfits/buy', { id: o.id });
                state.owned = out.owned;
                state.onWallet(out.bank);
              }
              state.outfit = o.id;
              render();
            } catch (e) {
              showErr(err, e.message);
            }
          },
        });
        return el('div', { class: 'card' },
          el('div', { class: 'swatch' }, [o.hat || o.skin, o.skin, o.shirt, o.pants].map((c) => el('span', { style: `background:${c}` }))),
          el('div', { class: 'title', text: o.name }), btn, err);
      })),
    );
  };
  render();
}

// ------------------------------------------------------------ leaderboard
export async function openRanks(online) {
  const rows = await api('GET', '/api/leaderboard');
  openModal(
    el('h2', { text: '🏆 ثروتمندترین‌ها' }),
    el('p', { class: 'muted', text: `بازیکن‌های آنلاین الان: ${num(online)}` }),
    el('table', { class: 'ranks' },
      el('tr', {}, el('th', { text: '#' }), el('th', { text: 'بازیکن' }), el('th', { text: 'فیت‌کوین بانکی' }), el('th', { text: 'پیروزی' })),
      rows.map((r, i) => el('tr', {}, el('td', { text: num(i + 1) }), el('td', { text: r.username }),
        el('td', { text: num(r.bank_fitcoin) }), el('td', { text: num(r.kills) })))),
  );
}
