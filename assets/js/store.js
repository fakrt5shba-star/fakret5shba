// فكرة خشبة — المكتبة المشتركة: البيانات، التصنيفات، الأسعار، السلة، الهيدر والفوتر
(function () {
    const CFG = window.FK_CONFIG;
    const FK = window.FK = {};

    // ---------- أدوات عامة ----------
    const esc = FK.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toLatinDigits = s => String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    FK.money = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ج.م';
    FK.waLink = (text, number) => `https://wa.me/${number || CFG.whatsappSales}?text=${encodeURIComponent(text || '')}`;
    FK.qs = (k) => new URLSearchParams(location.search).get(k);
    // نقطة واحدة لأحداث التحليلات — لا ترسل لأي أداة حاليًا ولا تحتوي بيانات شخصية
    FK.track = (event, params) => { (window.fkEvents = window.fkEvents || []).push({ event, ...(params || {}), t: Date.now() }); };

    FK.normalizePhone = raw => {
        let p = toLatinDigits(raw).replace(/[\s\-()]/g, '');
        if (p.startsWith('+20')) p = '0' + p.slice(3);
        else if (p.startsWith('0020')) p = '0' + p.slice(4);
        else if (p.startsWith('20') && p.length === 12) p = '0' + p.slice(2);
        return p;
    };
    FK.isValidPhone = raw => /^01[0125]\d{8}$/.test(FK.normalizePhone(raw));
    FK.makeRef = () => window.FK_ORDERS ? FK_ORDERS.makeRef() : 'FK-' + Date.now().toString(36).toUpperCase().slice(-6);

    FK.GOVERNORATES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء'];
    FK.govOptions = (selected) => '<option value="">اختار المحافظة</option>' + FK.GOVERNORATES.map(g => `<option ${g === selected ? 'selected' : ''}>${g}</option>`).join('');

    // ---------- التصنيفات الموحدة (راجع PRODUCT_AUDIT.md) ----------
    FK.CATEGORIES = [
        { id: 'neon', name: 'لوحات نيون', img: '/assets/img/cat-neon.jpeg', match: ['نيون', 'neon'] },
        { id: 'business', name: 'لوحات الشركات والدعاية', img: '/assets/img/cat-business.jpeg', match: ['دعاية', 'شركة', 'لوجو', 'logo', 'لايت بوكس'] },
        { id: 'qr', name: 'استاندات QR و NFC', img: '/assets/img/cat-qr.jpeg', match: ['qr', 'nfc', 'stand'] },
        { id: 'home', name: 'لوحات المنازل والفلل', img: '/assets/img/cat-home.jpeg', match: ['منزل', 'ڤيلا', 'فيلا', 'فندق'] },
        { id: 'office', name: 'منتجات المكاتب', img: '/assets/img/cat-office.jpeg', match: ['مكتب', 'office'] },
        { id: 'decor', name: 'ديكور وهدايا', img: '/assets/img/cat-decor.jpeg', match: ['ديكور', 'هدية', 'ابجورة', 'مزهرية', 'مناديل'] }
    ];
    FK.categoryById = id => FK.CATEGORIES.find(c => c.id === id);

    // ---------- الأسعار ----------
    // ثابت: رقم · نطاق: "2600 - 3000" · اختيارات: نطاق + optionLabels بنفس العدد · عرض سعر: رابط واتساب أو فاضي
    // priceUnit (اختياري) زي "م²" بيظهر جنب السعر
    function priceInfo(rawPrice, rawDiscount, optionLabels, unit) {
        const str = toLatinDigits(String(rawPrice == null ? '' : rawPrice)).trim();
        const discount = Math.max(0, Math.min(90, parseFloat(rawDiscount) || 0));
        unit = unit ? String(unit) : '';
        if (!str || /^(https?:|wa\.me)/i.test(str)) {
            const link = str ? (str.startsWith('wa.me') ? 'https://' + str : str) : '';
            return { kind: 'quote', value: 0, link, text: 'اطلب عرض سعر' };
        }
        const nums = (str.match(/\d+(\.\d+)?/g) || []).map(Number);
        if (nums.length > 1) {
            const min = Math.min(...nums);
            if (optionLabels && optionLabels.length === nums.length) {
                return { kind: 'options', value: min, min, unit, options: nums.map((price, i) => ({ label: optionLabels[i], price })), text: 'يبدأ من ' + FK.money(min) };
            }
            return { kind: 'range', value: min, min, unit, options: nums, text: 'يبدأ من ' + FK.money(min) };
        }
        const base = nums[0] || 0;
        if (!base) return { kind: 'quote', value: 0, link: '', text: 'اطلب عرض سعر' };
        const final = discount ? Math.round(base * (100 - discount)) / 100 : base;
        return { kind: 'fixed', value: final, base, discount, unit, text: FK.money(final) };
    }
    FK.priceInfo = priceInfo;
    FK.priceHTML = (pi, big) => {
        if (pi.kind === 'quote') return `<span class="quote"><i class="fa-brands fa-whatsapp"></i> اطلب عرض سعر</span>`;
        const unit = pi.unit ? ` <span class="from">/ ${esc(pi.unit)}</span>` : '';
        if (pi.kind === 'range' || pi.kind === 'options') return `<span class="from">يبدأ من</span> ${FK.money(pi.min)}${unit}`;
        if (pi.discount) return `${FK.money(pi.value)}${unit} <del>${FK.money(pi.base)}</del>${big ? ` <span class="badge">خصم ${pi.discount}%</span>` : ''}`;
        return FK.money(pi.value) + unit;
    };
    // سعر الوحدة لاختيار معيّن (أو أقل سعر لو مفيش اختيار)
    FK.unitPrice = (p, opt) => (p.price.kind === 'options' && p.price.options[opt]) ? p.price.options[opt].price : p.price.value;
    FK.optionLabel = (p, opt) => (p.price.kind === 'options' && p.price.options[opt]) ? p.price.options[opt].label : '';

    // ---------- الميديا ----------
    const isGoodSrc = s => typeof s === 'string' && ((s.startsWith('data:') && s.includes(',') && s.length > 100) || /^https?:\/\//.test(s));
    const isVideo = s => s.startsWith('data:video') || /\.(mp4|webm|ogg)(\?|$)/i.test(s);
    FK.PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='#16161A'/><text x='200' y='158' font-size='26' text-anchor='middle' fill='#D4AF37' font-family='Cairo,Arial' font-weight='700'>فكرة خشبة</text></svg>");
    FK.mediaHTML = (src, alt, opts = {}) => {
        if (!isGoodSrc(src)) return `<img src="${FK.PLACEHOLDER}" alt="${esc(alt)}">`;
        if (src.includes('drive.google.com')) {
            const m = src.match(/\/d\/(.+?)\//) || src.match(/id=(.+?)(&|$)/);
            if (m) return `<iframe src="https://drive.google.com/file/d/${esc(m[1])}/preview" title="${esc(alt)}" allow="autoplay" loading="lazy"></iframe>`;
        }
        if (isVideo(src)) return `<video src="${esc(src)}" muted playsinline ${opts.loop === false ? '' : 'loop'} ${opts.autoplay ? 'autoplay' : ''} ${opts.controls ? 'controls' : ''} aria-label="${esc(alt)}"></video>`;
        return `<img src="${esc(src)}" alt="${esc(alt)}" ${opts.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="this.onerror=null;this.src=FK.PLACEHOLDER">`;
    };

    // ---------- المنتجات ----------
    function normalizeProduct(p) {
        const labels = String(p.label || '').split(/[,،]/).map(s => s.trim()).filter(Boolean);
        const hay = (labels.join(' ') + ' ' + (p.name || '')).toLowerCase();
        const categories = FK.CATEGORIES.filter(c => c.match.some(m => hay.includes(m.toLowerCase()))).map(c => c.id);
        const images = [p.image, ...(Array.isArray(p.extraImages) ? p.extraImages : Object.values(p.extraImages || {}))].filter(isGoodSrc);
        const name = String(p.name || '').replace(/[✨🏠]/gu, '').replace(/\s+/g, ' ').trim();
        const optionLabels = (Array.isArray(p.optionLabels) ? p.optionLabels : Object.values(p.optionLabels || {})).map(s => String(s).trim()).filter(Boolean);
        return {
            raw: p, id: String(p.id), name, labels, categories,
            images, cover: images[0] || '', video: isGoodSrc(p.video) ? p.video : '', mediaLoop: p.mediaLoop,
            desc: String(p.desc || p.description || '').trim(),
            materials: String(p.material || '').split(/\n|\r/).map(s => s.trim()).filter(Boolean),
            price: priceInfo(p.price, p.discount, optionLabels, p.priceUnit),
            designMockup: !!p.designMockup,
            created: Number(p.id) || 0
        };
    }
    FK.cardHTML = (p) => {
        const cat = p.categories[0] ? FK.categoryById(p.categories[0]).name : '';
        const badge = p.price.discount ? `<span class="badge">خصم ${p.price.discount}%</span>` : '';
        return `<article class="p-card">
            ${badge}
            <div class="p-media">${FK.mediaHTML(p.cover, p.name)}</div>
            <div class="p-body">
                ${cat ? `<span class="p-cat">${esc(cat)}</span>` : ''}
                <h3 class="p-name"><a href="/product?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
                <div class="p-price">${FK.priceHTML(p.price)}</div>
            </div>
        </article>`;
    };
    FK.skeletonCards = n => Array.from({ length: n }, () => '<div class="skeleton skeleton-card" aria-hidden="true"></div>').join('');
    FK.errorHTML = (msg) => `<div class="state-error" role="alert"><i class="fa-solid fa-triangle-exclamation"></i>${esc(msg || 'حصلت مشكلة في تحميل المنتجات.')}<br><button class="btn btn-outline btn-sm" onclick="location.reload()">حاول تاني</button></div>`;

    // ---------- Firebase ----------
    let database = null;
    FK.db = () => {
        if (database) return database;
        if (!window.firebase) throw new Error('Firebase SDK not loaded');
        if (!firebase.apps.length) firebase.initializeApp(CFG.firebase);
        database = firebase.database();
        return database;
    };
    const toArr = v => (Array.isArray(v) ? v : Object.values(v || {})).filter(x => x != null);

    // تسجيل أي طلب (سلة / عرض سعر / الاستوديو): الطلب الكامل في orders (للأدمن بس)
    // وسجل تتبع عام في tracking/<رقم الطلب> بدون بيانات شخصية — الاتنين في كتابة واحدة
    FK.submitOrder = async ({ key, data, tracking }) => {
        const db = FK.db(), O = window.FK_ORDERS;
        const orderKey = key || db.ref('orders').push().key;
        const phone = data.customerPhone || data.phone || '';
        data.status = 'new';
        data.statusHistory = { new: data.timestamp || Date.now() };
        const updates = { ['orders/' + orderKey]: data };
        if (O && tracking && O.isRef(data.orderRef)) updates['tracking/' + data.orderRef] = await O.buildTracking({ ref: data.orderRef, phone, ...tracking });
        await db.ref().update(updates);
        try {
            localStorage.setItem('fk_last_order', String(orderKey)); localStorage.setItem('fk_last_notif_time', Date.now());
            const mine = JSON.parse(localStorage.getItem('fk_my_orders') || '[]').filter(o => o.ref !== data.orderRef);
            mine.unshift({ ref: data.orderRef, phone, at: Date.now() });
            localStorage.setItem('fk_my_orders', JSON.stringify(mine.slice(0, 10)));
        } catch (e) { }
        // تنبيه لصاحب المتجر (لو اتظبط) — مش بيأثر على الطلب لو فشل
        try { fetch('/api/notify-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: data.orderRef }), keepalive: true }).catch(() => { }); } catch (e) { }
        listenToMyOrder();
        return { key: orderKey, ref: data.orderRef };
    };
    FK.myOrders = () => { try { return JSON.parse(localStorage.getItem('fk_my_orders') || '[]'); } catch (e) { return []; } };

    let storePromise = null;
    FK.loadStore = () => {
        if (storePromise) return storePromise;
        storePromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), 30000);
            FK.db().ref('storeData').once('value').then(snap => {
                clearTimeout(timer);
                const data = snap.val() || {};
                const products = toArr(data.products).map(normalizeProduct);
                FK.store = { products, design: toArr(data.design), promoCodes: toArr(data.promoCodes) };
                resolve(FK.store);
            }).catch(err => { clearTimeout(timer); reject(err); });
        });
        storePromise.catch(() => { storePromise = null; });
        return storePromise;
    };
    FK.productById = id => FK.store && FK.store.products.find(p => p.id === String(id));

    // ---------- السلة (محفوظة على جهاز العميل) ----------
    const CART_KEY = 'fk_cart_v2';
    const readCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; } };
    let cart = readCart();
    const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { } updateCartCount(); };
    function updateCartCount() {
        const n = cart.reduce((s, i) => s + i.qty, 0);
        document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = n; el.dataset.count = n; });
    }
    FK.addToCart = (productId, qty, note, opt) => {
        qty = Math.max(1, parseInt(qty) || 1);
        opt = (opt === undefined || opt === null || opt === '') ? null : Number(opt);
        const existing = cart.find(i => i.id === String(productId) && (i.note || '') === (note || '') && (i.opt ?? null) === opt);
        if (existing) existing.qty += qty; else cart.push({ id: String(productId), qty, note: note || '', opt });
        saveCart();
        const p = FK.productById(productId);
        FK.track('add_to_cart', { item_id: String(productId), quantity: qty });
        FK.toast(`اتضاف للسلة: ${p ? p.name : ''}`, 'fa-cart-shopping', { label: 'افتح السلة', onClick: () => FK.openCart() });
    };

    // ---------- Toast ----------
    FK.toast = (msg, icon, action) => {
        let wrap = document.querySelector('.toast-wrap');
        if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
        const t = document.createElement('div'); t.className = 'toast';
        t.innerHTML = `<i class="fa-solid ${icon || 'fa-circle-check'}"></i><span>${esc(msg)}</span>`;
        if (action) { const b = document.createElement('button'); b.className = 'btn btn-gold btn-sm'; b.textContent = action.label; b.onclick = () => { t.remove(); action.onClick(); }; t.appendChild(b); }
        wrap.appendChild(t);
        setTimeout(() => t.remove(), 5000);
    };

    // ---------- الهيدر والفوتر ----------
    const NAV = [
        { href: '/', label: 'الرئيسية', key: 'home' },
        { href: '/products', label: 'المنتجات', key: 'products' },
        { href: '/index2', label: 'صمّم منتجك', key: 'studio', cls: 'nav-studio' },
        { href: '/business', label: 'للشركات', key: 'business' },
        { href: '/quote', label: 'اطلب عرض سعر', key: 'quote' }
    ];
    FK.renderChrome = (active) => {
        const header = document.getElementById('site-header');
        if (header) {
            header.className = 'site-header';
            header.innerHTML = `
            <div class="container header-inner">
                <a class="brand" href="/" aria-label="فكرة خشبة - الرئيسية"><span class="brand-mark" aria-hidden="true">ف</span><span>فكرة خشبة</span></a>
                <nav class="main-nav" aria-label="القائمة الرئيسية">
                    ${NAV.map(n => `<a href="${n.href}" class="${n.cls || ''}" ${n.key === active ? 'aria-current="page"' : ''}>${n.label}</a>`).join('')}
                </nav>
                <div class="header-actions">
                    <a class="icon-btn" href="/products#search" aria-label="بحث"><i class="fa-solid fa-magnifying-glass"></i></a>
                    <button class="icon-btn" type="button" data-open-cart aria-label="السلة"><i class="fa-solid fa-bag-shopping"></i><span class="cart-count" data-cart-count data-count="0">0</span></button>
                    <a class="btn btn-gold btn-sm header-quote" href="/quote">اطلب عرض سعر</a>
                    <button class="icon-btn menu-toggle" type="button" aria-label="القائمة" aria-expanded="false" aria-controls="mobileNav"><i class="fa-solid fa-bars"></i></button>
                </div>
            </div>
            <nav class="mobile-nav" id="mobileNav" aria-label="قائمة الموبايل">
                ${NAV.map(n => `<a href="${n.href}" ${n.key === active ? 'aria-current="page"' : ''}>${n.label}</a>`).join('')}
                <a href="/track" ${active === 'track' ? 'aria-current="page"' : ''}>تابع طلبك</a>
                <a class="btn btn-gold btn-block" href="/quote">اطلب عرض سعر</a>
                <a class="btn btn-wa btn-block" href="${FK.waLink('السلام عليكم، عندي استفسار عن منتجات فكرة خشبة')}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> كلمنا واتساب</a>
            </nav>`;
            const toggle = header.querySelector('.menu-toggle'); const mnav = header.querySelector('.mobile-nav');
            toggle.addEventListener('click', () => {
                const open = mnav.classList.toggle('is-open');
                toggle.setAttribute('aria-expanded', open);
                toggle.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
                document.body.style.overflow = open ? 'hidden' : '';
            });
        }
        const footer = document.getElementById('site-footer');
        if (footer) {
            footer.className = 'site-footer';
            footer.innerHTML = `
            <div class="container">
                <div class="footer-grid">
                    <div class="footer-brand">
                        <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">ف</span><span>فكرة خشبة</span></a>
                        <p style="margin-top:12px; max-width:340px;">لوحات نيون وأكريليك ولايت بوكس وديكورات خشب، تصميم وتنفيذ حسب الطلب.</p>
                        <div class="socials">
                            <a href="${CFG.socials.facebook}" target="_blank" rel="noopener" aria-label="فيسبوك"><i class="fa-brands fa-facebook-f"></i></a>
                            <a href="${CFG.socials.instagram}" target="_blank" rel="noopener" aria-label="إنستجرام"><i class="fa-brands fa-instagram"></i></a>
                            <a href="${CFG.socials.tiktok}" target="_blank" rel="noopener" aria-label="تيك توك"><i class="fa-brands fa-tiktok"></i></a>
                            <a href="https://wa.me/${CFG.whatsappSales}" target="_blank" rel="noopener" aria-label="واتساب"><i class="fa-brands fa-whatsapp"></i></a>
                        </div>
                    </div>
                    <div><h4>المتجر</h4><ul>${FK.CATEGORIES.slice(0, 4).map(c => `<li><a href="/products?cat=${c.id}">${c.name}</a></li>`).join('')}</ul></div>
                    <div><h4>خدماتنا</h4><ul><li><a href="/index2">صمّم منتجك</a></li><li><a href="/business">حلول الشركات</a></li><li><a href="/quote">اطلب عرض سعر</a></li></ul></div>
                    <div><h4>تواصل معنا</h4><ul><li><a href="/track">تابع طلبك</a></li><li><a href="https://wa.me/${CFG.whatsappSales}" target="_blank" rel="noopener" dir="ltr">${CFG.phoneSalesDisplay}</a></li><li><a href="/privacy">سياسة الخصوصية</a></li></ul></div>
                </div>
                <div class="footer-bottom"><span>© ${new Date().getFullYear()} فكرة خشبة. جميع الحقوق محفوظة.</span><span>صُنع في مصر</span></div>
            </div>`;
        }
        if (!document.querySelector('.wa-float')) {
            const wa = document.createElement('a'); wa.className = 'wa-float'; wa.target = '_blank'; wa.rel = 'noopener';
            wa.href = FK.waLink('السلام عليكم، عندي استفسار عن منتجات فكرة خشبة'); wa.setAttribute('aria-label', 'كلمنا على واتساب');
            wa.innerHTML = '<i class="fa-brands fa-whatsapp"></i>';
            document.body.appendChild(wa);
        }
        document.addEventListener('click', e => { if (e.target.closest('[data-open-cart]')) FK.openCart(); });
        buildDrawer();
        updateCartCount();
        listenToMyOrder();
    };

    // ---------- درج السلة وإتمام الطلب ----------
    let step = 'cart', appliedPromo = null, customer = { name: '', phone: '', gov: '', address: '', note: '' };
    let drawer, overlay, lastFocus;
    function buildDrawer() {
        if (document.getElementById('cartDrawer')) return;
        overlay = document.createElement('div'); overlay.className = 'overlay'; overlay.addEventListener('click', FK.closeCart);
        drawer = document.createElement('aside'); drawer.className = 'drawer'; drawer.id = 'cartDrawer';
        drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-labelledby', 'drawerTitle');
        drawer.innerHTML = `
            <div class="drawer-head"><h2 class="h3" id="drawerTitle">سلة المشتريات</h2><button class="icon-btn" type="button" aria-label="إغلاق" data-close-drawer><i class="fa-solid fa-xmark"></i></button></div>
            <div class="drawer-steps" aria-hidden="true"><span data-s="cart">السلة</span><span data-s="details">البيانات</span><span data-s="review">المراجعة</span><span data-s="done">تم</span></div>
            <div class="drawer-body" id="drawerBody"></div>
            <div class="drawer-foot" id="drawerFoot"></div>`;
        document.body.append(overlay, drawer);
        drawer.querySelector('[data-close-drawer]').addEventListener('click', FK.closeCart);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) FK.closeCart(); });
    }
    FK.openCart = () => {
        lastFocus = document.activeElement;
        step = step === 'done' ? 'cart' : step;
        drawer.classList.add('is-open'); overlay.classList.add('is-open'); document.body.style.overflow = 'hidden';
        renderDrawer();
        drawer.querySelector('[data-close-drawer]').focus();
        if (!FK.store) FK.loadStore().then(renderDrawer).catch(() => renderDrawer());
    };
    FK.closeCart = () => {
        drawer.classList.remove('is-open'); overlay.classList.remove('is-open'); document.body.style.overflow = '';
        if (step === 'done') step = 'cart';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    function cartLines() {
        return cart.map((item, index) => {
            const p = FK.productById(item.id);
            if (!p) return { item, index, p: null, unit: 0, total: 0 };
            const unit = FK.unitPrice(p, item.opt);
            const label = FK.optionLabel(p, item.opt);
            return { item, index, p, unit, total: unit * item.qty, label, displayName: label ? `${p.name} — ${label}` : p.name };
        });
    }
    function totals() {
        const lines = cartLines();
        const subtotal = lines.reduce((s, l) => s + l.total, 0);
        let discount = 0;
        if (appliedPromo && subtotal > 0) discount = appliedPromo.type === 'percent' ? subtotal * (Number(appliedPromo.value) / 100) : Number(appliedPromo.value) || 0;
        discount = Math.min(subtotal, Math.round(discount * 100) / 100);
        const isEstimate = l => l.p && (l.p.price.kind === 'quote' || l.p.price.kind === 'range' || !!l.p.price.unit || (l.p.price.kind === 'options' && !l.label));
        const total = Math.max(0, subtotal - discount);
        const O = window.FK_ORDERS;
        const shipping = O && customer.gov ? O.shippingFor(customer.gov) : null;
        const hasQuote = lines.some(isEstimate);
        return { lines, subtotal, discount, total, shipping, grand: total + (shipping || 0), hasQuote, deposit: O && !hasQuote ? O.suggestDeposit(total + (shipping || 0)) : 0 };
    }
    // سطر الدفع: مفيش دفع دلوقتي، عربون بعد التأكيد، والباقي عند الاستلام
    function paymentNotice(t) {
        const O = window.FK_ORDERS, pt = O ? O.productionTime() : '';
        const dep = t.deposit ? `عربون ${FK.money(t.deposit)}` : 'عربون بنتفق عليه';
        return `<div class="notice"><i class="fa-solid fa-circle-info"></i><span>مش هتدفع حاجة دلوقتي. هنكلمك نأكد التفاصيل والسعر، وبعدها بتدفع ${dep} عشان نبدأ التنفيذ، والباقي عند الاستلام.${pt ? ` مدة التنفيذ: ${esc(pt)}.` : ''}</span></div>`;
    }
    function setStepIndicator() {
        const order = ['cart', 'details', 'review', 'done'];
        drawer.querySelectorAll('.drawer-steps span').forEach(s => {
            const i = order.indexOf(s.dataset.s), cur = order.indexOf(step);
            s.classList.toggle('is-current', i === cur); s.classList.toggle('is-done', i < cur);
        });
    }
    function totalsHTML(t) {
        return `<div class="totals">
            <div><span>إجمالي المنتجات</span><strong>${FK.money(t.subtotal)}</strong></div>
            ${t.discount ? `<div class="discount"><span>خصم (${esc(appliedPromo.code)})</span><strong>- ${FK.money(t.discount)}</strong></div>` : ''}
            ${t.shipping != null ? `<div><span>الشحن (${esc(customer.gov)})</span><strong>${t.shipping ? FK.money(t.shipping) : 'مجاني'}</strong></div>` : ''}
            <div class="grand"><span>الإجمالي</span><span>${FK.money(t.grand)}</span></div>
            ${t.hasQuote ? '<p class="small muted">بعض المنتجات سعرها حسب المقاس أو بعرض سعر، هنأكد السعر النهائي معاك قبل التنفيذ.</p>' : ''}
            ${t.shipping == null ? '<p class="small muted">مصاريف الشحن بتتحدد حسب المحافظة وبنأكدها معاك في مكالمة التأكيد.</p>' : ''}
        </div>`;
    }
    function renderDrawer() {
        const body = drawer.querySelector('#drawerBody'), foot = drawer.querySelector('#drawerFoot');
        setStepIndicator();
        const title = drawer.querySelector('#drawerTitle');
        title.textContent = { cart: 'سلة المشتريات', details: 'بيانات التوصيل', review: 'راجع طلبك', done: 'تم استلام طلبك' }[step];

        if (step === 'cart') {
            if (!cart.length) {
                body.innerHTML = `<div class="state-empty"><i class="fa-solid fa-bag-shopping"></i>السلة فاضية.<br><a class="btn btn-dark btn-sm" style="margin-top:16px" href="/products">تصفح المنتجات</a></div>`;
                foot.innerHTML = ''; return;
            }
            if (!FK.store) { body.innerHTML = FK.skeletonCards(2).replace(/skeleton-card/g, 'skeleton-card" style="aspect-ratio:5/1'); foot.innerHTML = ''; return; }
            const t = totals();
            body.innerHTML = t.lines.map(l => !l.p ? `<div class="cart-item"><img src="${FK.PLACEHOLDER}" alt=""><div><div class="ci-name">منتج لم يعد متاحًا</div></div><button class="icon-btn" type="button" data-remove="${l.index}" aria-label="حذف"><i class="fa-solid fa-trash"></i></button></div>` : `
                <div class="cart-item">
                    <img src="${esc(l.p.cover || FK.PLACEHOLDER)}" alt="">
                    <div>
                        <div class="ci-name">${esc(l.displayName)}</div>
                        ${l.item.note ? `<div class="ci-note">ملاحظة: ${esc(l.item.note)}</div>` : ''}
                        <div class="qty" role="group" aria-label="الكمية"><button type="button" data-qty="${l.index}" data-d="1" aria-label="زيادة">+</button><span>${l.item.qty}</span><button type="button" data-qty="${l.index}" data-d="-1" aria-label="تقليل">−</button></div>
                    </div>
                    <div style="display:grid; justify-items:end; gap:4px;">
                        <span class="ci-price">${l.p.price.kind === 'quote' ? 'عرض سعر' : FK.money(l.total)}</span>
                        <button class="icon-btn" type="button" data-remove="${l.index}" aria-label="حذف ${esc(l.p.name)}"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </div>`).join('') + `
                <div class="field"><label for="promoInput">كود خصم</label>
                    <div style="display:flex; gap:8px;"><input id="promoInput" class="input" placeholder="لو معاك كود اكتبه هنا" value="${appliedPromo ? esc(appliedPromo.code) : ''}" style="text-transform:uppercase"><button class="btn btn-outline btn-sm" type="button" id="applyPromo">تطبيق</button></div>
                    <div id="promoMsg" class="small" aria-live="polite"></div>
                </div>` + totalsHTML(t);
            foot.innerHTML = `<button class="btn btn-gold btn-block" type="button" id="toDetails">متابعة لبيانات التوصيل</button><button class="btn btn-ghost btn-sm" type="button" data-close-drawer2>كمّل تسوق</button>`;
            foot.querySelector('#toDetails').onclick = () => { step = 'details'; FK.track('begin_checkout', { value: t.total }); renderDrawer(); };
            foot.querySelector('[data-close-drawer2]').onclick = FK.closeCart;
            body.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { cart.splice(+b.dataset.remove, 1); saveCart(); renderDrawer(); });
            body.querySelectorAll('[data-qty]').forEach(b => b.onclick = () => { const it = cart[+b.dataset.qty]; it.qty = Math.max(1, it.qty + (+b.dataset.d)); saveCart(); renderDrawer(); });
            body.querySelector('#applyPromo').onclick = applyPromo;
            body.querySelector('#promoInput').addEventListener('keydown', e => { if (e.key === 'Enter') applyPromo(); });
            return;
        }

        if (step === 'details') {
            body.innerHTML = `
                <form id="detailsForm" novalidate class="form-grid" style="grid-template-columns:1fr">
                    <div class="field"><label for="cName">الاسم بالكامل</label><input id="cName" autocomplete="name" value="${esc(customer.name)}" required><span class="field-error">اكتب اسمك</span></div>
                    <div class="field"><label for="cPhone">رقم الموبايل</label><input id="cPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx" dir="ltr" style="text-align:right" value="${esc(customer.phone)}" required><span class="field-error">اكتب رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01)</span></div>
                    <div class="field"><label for="cGov">المحافظة</label><select id="cGov" required>${FK.govOptions(customer.gov)}</select><span class="field-error">اختار المحافظة</span></div>
                    <div class="field"><label for="cAddress">العنوان بالتفصيل</label><input id="cAddress" autocomplete="street-address" placeholder="المنطقة، الشارع، رقم العمارة" value="${esc(customer.address)}" required><span class="field-error">اكتب العنوان</span></div>
                    <div class="field"><label for="cNote">ملاحظات على الطلب <span class="muted">(اختياري)</span></label><textarea id="cNote" rows="2">${esc(customer.note)}</textarea></div>
                </form>`;
            foot.innerHTML = `<button class="btn btn-gold btn-block" type="button" id="toReview">مراجعة الطلب</button><button class="btn btn-ghost btn-sm" type="button" id="backCart">رجوع للسلة</button>`;
            foot.querySelector('#backCart').onclick = () => { readDetails(); step = 'cart'; renderDrawer(); };
            foot.querySelector('#toReview').onclick = () => { readDetails(); if (validateDetails()) { step = 'review'; renderDrawer(); } };
            body.querySelector('#cName').focus();
            return;
        }

        if (step === 'review') {
            const t = totals();
            body.innerHTML = `
                <dl class="review-list">
                    <div><dt>الاسم</dt><dd>${esc(customer.name)}</dd></div>
                    <div><dt>الموبايل</dt><dd dir="ltr" style="text-align:right">${esc(FK.normalizePhone(customer.phone))}</dd></div>
                    <div><dt>العنوان</dt><dd>${esc(customer.gov)} — ${esc(customer.address)}</dd></div>
                    ${customer.note ? `<div><dt>ملاحظات</dt><dd>${esc(customer.note)}</dd></div>` : ''}
                </dl>
                <div class="review-list">${t.lines.filter(l => l.p).map(l => `<div style="display:flex; justify-content:space-between; gap:8px"><span>${esc(l.displayName)} × ${l.item.qty}${l.item.note ? `<br><span class="small muted">${esc(l.item.note)}</span>` : ''}</span><strong>${l.p.price.kind === 'quote' ? 'عرض سعر' : FK.money(l.total)}</strong></div>`).join('')}</div>
                ${totalsHTML(t)}
                ${paymentNotice(t)}
                <div id="submitMsg" aria-live="assertive"></div>`;
            foot.innerHTML = `<button class="btn btn-gold btn-block" type="button" id="placeOrder">تأكيد وإرسال الطلب</button><button class="btn btn-ghost btn-sm" type="button" id="backDetails">تعديل البيانات</button>`;
            foot.querySelector('#backDetails').onclick = () => { step = 'details'; renderDrawer(); };
            foot.querySelector('#placeOrder').onclick = placeOrder;
            return;
        }

        if (step === 'done') {
            const ref = drawer.dataset.lastRef;
            body.innerHTML = `
                <div class="success-box">
                    <div class="check"><i class="fa-solid fa-check"></i></div>
                    <h3 class="h3">طلبك اتسجل بنجاح</h3>
                    <p class="muted">رقم طلبك</p>
                    <div class="ref">${esc(ref)}</div>
                    <p class="muted small">هنكلمك على رقمك قريب لتأكيد التفاصيل والسعر النهائي ومصاريف الشحن. احتفظ برقم الطلب عشان تتابعه.</p>
                </div>
                <div class="notice"><i class="fa-brands fa-whatsapp"></i><span>عايز تبعت صورة أو لوجو أو تستعجل الطلب؟ ابعتلنا على واتساب ومعاك رقم الطلب. (ده اختياري — طلبك متسجل خلاص.)</span></div>`;
            foot.innerHTML = `<a class="btn btn-gold btn-block" href="/track?ref=${encodeURIComponent(ref)}"><i class="fa-solid fa-location-crosshairs"></i> تابع طلبك</a><a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${FK.waLink(`السلام عليكم، عملت طلب من الموقع ورقمه ${ref}`)}"><i class="fa-brands fa-whatsapp"></i> ابعت رقم الطلب على واتساب</a><button class="btn btn-ghost btn-sm" type="button" id="doneClose">تمام</button>`;
            foot.querySelector('#doneClose').onclick = FK.closeCart;
        }
    }
    function applyPromo() {
        const input = drawer.querySelector('#promoInput'), msg = drawer.querySelector('#promoMsg');
        const code = input.value.trim().toUpperCase();
        if (!code) { appliedPromo = null; renderDrawer(); return; }
        const promo = (FK.store.promoCodes || []).find(p => String(p.code || '').toUpperCase() === code && p.active !== false);
        const today = new Date().toISOString().split('T')[0];
        if (!promo) { appliedPromo = null; renderDrawer(); drawer.querySelector('#promoMsg').innerHTML = '<span style="color:var(--error)">الكود غير صحيح أو مش مفعل.</span>'; return; }
        if (promo.expiry && promo.expiry < today) { appliedPromo = null; renderDrawer(); drawer.querySelector('#promoMsg').innerHTML = '<span style="color:var(--error)">الكود ده انتهت صلاحيته.</span>'; return; }
        appliedPromo = promo; renderDrawer();
        drawer.querySelector('#promoMsg').innerHTML = '<span style="color:#15803D">تم تطبيق الخصم.</span>';
        if (msg) msg.blur();
    }
    function readDetails() {
        const v = id => (drawer.querySelector('#' + id) || {}).value || '';
        customer = { name: v('cName').trim(), phone: v('cPhone').trim(), gov: v('cGov'), address: v('cAddress').trim(), note: v('cNote').trim() };
    }
    function validateDetails() {
        const checks = [['cName', !!customer.name], ['cPhone', FK.isValidPhone(customer.phone)], ['cGov', !!customer.gov], ['cAddress', customer.address.length >= 5]];
        let first = null;
        checks.forEach(([id, ok]) => { const f = drawer.querySelector('#' + id).closest('.field'); f.classList.toggle('has-error', !ok); if (!ok && !first) first = id; });
        if (first) drawer.querySelector('#' + first).focus();
        return !first;
    }
    function placeOrder() {
        const btn = drawer.querySelector('#placeOrder'), msg = drawer.querySelector('#submitMsg');
        btn.classList.add('is-loading'); msg.innerHTML = '';
        const t = totals(), ref = FK.makeRef();
        const cartItems = t.lines.filter(l => l.p).map(l => ({
            id: l.p.id, name: l.displayName, image: l.p.cover || '', qty: l.item.qty,
            option: l.label || null,
            note: [l.item.qty > 1 ? `الكمية: ${l.item.qty}${l.p.price.unit ? ' ' + l.p.price.unit : ''}` : '', l.item.note].filter(Boolean).join(' — '),
            isLink: l.p.price.kind === 'quote',
            priceText: l.p.price.kind === 'quote' ? 'تواصل للسعر' : ((l.p.price.kind === 'range' || (l.p.price.kind === 'options' && !l.label)) ? `يبدأ من ${l.total}` : String(l.total)),
            finalPrice: l.total
        }));
        const orderData = {
            orderRef: ref,
            customerName: customer.name, customerPhone: FK.normalizePhone(customer.phone),
            governorate: customer.gov, address: `${customer.gov} — ${customer.address}`,
            cartItems, note: customer.note || 'لا توجد تفاصيل إضافية',
            totalPrice: t.total, subTotal: t.subtotal,
            shippingFee: t.shipping,
            promoCode: appliedPromo ? appliedPromo.code : null, promoDiscount: t.discount,
            quantity: cart.reduce((s, i) => s + i.qty, 0),
            timestamp: Date.now(), orderState: 'active', source: 'web-v2'
        };
        FK.submitOrder({
            data: orderData,
            tracking: { type: 'cart', items: cartItems, total: t.total, estimate: t.hasQuote, shippingFee: t.shipping, governorate: customer.gov }
        }).then(() => {
            FK.track('purchase_request', { value: t.total, items: cartItems.length });
            cart = []; saveCart(); appliedPromo = null;
            drawer.dataset.lastRef = ref; step = 'done'; renderDrawer();
        }).catch(() => {
            btn.classList.remove('is-loading');
            msg.innerHTML = `<div class="notice error"><i class="fa-solid fa-triangle-exclamation"></i><span>الطلب ماتسجلش بسبب مشكلة في الاتصال. جرّب تاني، أو ابعتلنا على واتساب.</span></div>`;
        });
    }

    // إشعارات حالة الطلب اللي بيبعتها الأدمن (نفس سلوك الموقع القديم)
    let notifRef = null;
    function listenToMyOrder() {
        let id; try { id = localStorage.getItem('fk_last_order'); } catch (e) { }
        if (!id || !window.firebase) return;
        try {
            if (notifRef) notifRef.off();
            notifRef = FK.db().ref('orders/' + id + '/latestNotification');
            notifRef.on('value', snap => {
                const n = snap.val(); if (!n) return;
                let last = 0; try { last = +localStorage.getItem('fk_last_notif_time') || 0; } catch (e) { }
                if (n.timestamp > last) { FK.toast(n.message, 'fa-bell'); try { localStorage.setItem('fk_last_notif_time', n.timestamp); } catch (e) { } }
            }, () => { });
        } catch (e) { }
    }
})();
