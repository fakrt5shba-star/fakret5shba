// فكرة خشبة — حالات الطلب، العربون، الشحن، رسائل واتساب للعميل، وسجل تتبع الطلب
// مشترك بين الموقع (store.js) وصفحة "تابع طلبك" (track.html) ولوحة الإدارة (admin.html)
// القيم اللي بتتغير (نسبة العربون، طرق الدفع، الشحن، مدة التنفيذ) في config.js → orders
(function (root) {
    const CFG = root.FK_CONFIG || {};
    const OC = CFG.orders || {};
    const O = root.FK_ORDERS = {};

    const money = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ج.م';
    O.money = money;

    // ---------- حالات الطلب ----------
    O.STATUSES = [
        { id: 'new', label: 'طلب جديد', icon: 'fa-inbox', customer: 'استلمنا طلبك، وهنكلمك قريب نأكد التفاصيل والسعر.' },
        { id: 'confirmed', label: 'اتأكد', icon: 'fa-circle-check', customer: 'اتفقنا على التفاصيل والسعر. مستنيين العربون عشان نبدأ التنفيذ.' },
        { id: 'deposit_paid', label: 'العربون اتدفع', icon: 'fa-wallet', customer: 'وصلنا العربون، وطلبك داخل التنفيذ.' },
        { id: 'in_production', label: 'في التنفيذ', icon: 'fa-screwdriver-wrench', customer: 'طلبك بيتنفذ دلوقتي في الورشة.' },
        { id: 'ready', label: 'جاهز', icon: 'fa-camera', customer: 'طلبك جاهز، وهنبعتلك صورته قبل الشحن.' },
        { id: 'shipped', label: 'اتشحن', icon: 'fa-truck', customer: 'طلبك خرج للشحن وفي الطريق ليك.' },
        { id: 'delivered', label: 'اتسلم', icon: 'fa-house-circle-check', customer: 'طلبك اتسلم. نتمنى يعجبك!' }
    ];
    O.CANCELED = { id: 'canceled', label: 'اتلغى', icon: 'fa-ban', customer: 'الطلب ده اتلغى. لو ده حصل بالغلط كلمنا واتساب.' };
    O.statusById = id => O.STATUSES.find(s => s.id === id) || (id === 'canceled' ? O.CANCELED : O.STATUSES[0]);
    O.statusIndex = id => O.STATUSES.findIndex(s => s.id === id);

    // ---------- الفلوس ----------
    O.depositPercent = () => { const p = Number(OC.depositPercent); return p > 0 && p <= 100 ? p : 0; };
    // العربون المقترح: نسبة من الإجمالي، مقربة لأقرب 10 جنيه لفوق
    O.suggestDeposit = total => { const p = O.depositPercent(); return p && total > 0 ? Math.ceil(total * p / 100 / 10) * 10 : 0; };
    // الشحن: null = بيتحدد في مكالمة التأكيد
    O.shippingFor = gov => {
        const s = OC.shippingFees;
        if (s == null || s === '') return null;
        if (typeof s === 'number') return s;
        if (typeof s === 'object' && gov && Object.prototype.hasOwnProperty.call(s, gov)) return Number(s[gov]) || 0;
        return null;
    };
    O.depositMethods = () => (Array.isArray(OC.depositMethods) ? OC.depositMethods : []).filter(m => m && m.value);
    O.productionTime = () => String(OC.productionTime || '').trim();
    O.methodsText = () => O.depositMethods().map(m => `• ${m.label}: ${m.value}`).join('\n');

    // إجماليات أي طلب (طلبات قديمة وجديدة): السعر النهائي + الشحن - المدفوع
    O.orderMoney = (o) => {
        const items = parseFloat(o.price || o.totalPrice || 0) || 0;
        const shipping = o.shippingFee != null && o.shippingFee !== '' ? (parseFloat(o.shippingFee) || 0) : null;
        const total = items + (shipping || 0);
        const paid = parseFloat(o.paid || 0) || 0;
        const deposit = parseFloat(o.depositAmount || 0) || 0;
        return { items, shipping, total, paid, deposit, remaining: Math.max(0, total - paid), depositDue: Math.max(0, deposit - paid) };
    };

    // ---------- رقم الطلب والتحقق ----------
    const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    O.makeRef = () => {
        const a = new Uint32Array(6);
        (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 1e9); });
        return 'FK-' + Array.from(a, n => REF_CHARS[n % REF_CHARS.length]).join('');
    };
    O.isRef = r => /^FK-[A-Z0-9]{6}$/.test(String(r || ''));
    O.cleanRef = r => String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FK/, '').slice(0, 6).replace(/^/, 'FK-');
    O.sha256 = async (text) => {
        const buf = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    };
    // رقم الموبايل بصيغة واحدة 01xxxxxxxxx (يقبل أرقام عربي و+20 و0020)
    O.normPhone = raw => {
        let p = String(raw || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
        if (p.startsWith('0020')) p = p.slice(4);
        if (p.startsWith('20') && p.length === 12) p = p.slice(2);
        if (p.length === 10 && p.startsWith('1')) p = '0' + p;
        return p;
    };
    // بصمة الموبايل: صفحة التتبع بتطلب رقم الطلب + الموبايل، والسجل العام مفيهوش الرقم نفسه
    O.phoneHash = (phone, ref) => O.sha256(O.normPhone(phone) + '|' + ref);
    O.trackUrl = ref => `${CFG.siteUrl || ''}/track?ref=${encodeURIComponent(ref)}`;

    // سجل التتبع العام (tracking/<ref>) — بدون اسم ولا موبايل ولا عنوان
    O.buildTracking = async ({ ref, phone, type, items, total, estimate, shippingFee, governorate }) => ({
        ref, type: type || 'cart', status: 'new',
        createdAt: Date.now(), updatedAt: Date.now(),
        phoneHash: await O.phoneHash(phone, ref),
        items: (items || []).slice(0, 30).map(i => ({ name: String(i.name || '').slice(0, 120), qty: Number(i.qty) || 1 })),
        total: estimate ? null : (Number(total) || 0),
        estimate: !!estimate,
        shippingFee: shippingFee == null ? null : Number(shippingFee),
        governorate: governorate || '',
        history: { new: Date.now() }
    });

    // ---------- رسائل واتساب للعميل (من لوحة الإدارة) ----------
    const firstName = o => String(o.customerName || o.name || '').trim().split(/\s+/)[0] || '';
    const itemsText = o => {
        if (o.cartItems && o.cartItems.length) return o.cartItems.map(i => `• ${i.name}${i.qty > 1 ? ` × ${i.qty}` : ''}`).join('\n');
        if (o.baseDetails !== undefined) return `• لوحة 3D مفتوح/مغلق${o.qty > 1 ? ` × ${o.qty}` : ''}`;
        return o.productName ? `• ${o.productName}` : '';
    };
    const linkLine = o => O.isRef(o.orderRef) ? `\nتقدر تتابع طلبك من هنا:\n${O.trackUrl(o.orderRef)}` : '';
    const payLines = (amount) => {
        const m = O.methodsText();
        return m ? `\nتقدر تحوّل ${money(amount)} على:\n${m}\nوبعد التحويل ابعتلنا صورة التحويل هنا.` : '';
    };
    O.TEMPLATES = [
        {
            id: 'confirm', label: 'تأكيد الطلب وطلب العربون', status: 'confirmed',
            build: o => {
                const m = O.orderMoney(o), pt = O.productionTime();
                return `أهلًا ${firstName(o)}، معاك فكرة خشبة بخصوص طلبك رقم ${o.orderRef || ''}.\n${itemsText(o)}\n` +
                    (m.items ? `\nالإجمالي: ${money(m.items)}` + (m.shipping != null ? `\nالشحن: ${money(m.shipping)}\nالمطلوب كله: ${money(m.total)}` : '') : '') +
                    (m.deposit ? `\n\nعشان نبدأ التنفيذ محتاجين عربون ${money(m.deposit)}، والباقي قبل الشحن.` + payLines(m.depositDue || m.deposit) : '') +
                    (pt ? `\n\nمدة التنفيذ: ${pt}.` : '') + linkLine(o) + `\n\nلو فيه أي تعديل قولنا.`;
            }
        },
        {
            id: 'deposit_reminder', label: 'تذكير بالعربون', status: null,
            build: o => {
                const m = O.orderMoney(o);
                return `أهلًا ${firstName(o)}، طلبك رقم ${o.orderRef || ''} جاهز يدخل التنفيذ أول ما يوصلنا العربون${m.depositDue ? ` (${money(m.depositDue)})` : ''}.` + payLines(m.depositDue || m.deposit) + linkLine(o);
            }
        },
        {
            id: 'deposit_received', label: 'استلمنا العربون — بدأنا التنفيذ', status: 'in_production',
            build: o => {
                const m = O.orderMoney(o), pt = O.productionTime();
                return `وصلنا ${m.paid ? money(m.paid) : 'العربون'} لطلب ${o.orderRef || ''}، شكرًا يا ${firstName(o)}!\nطلبك دخل التنفيذ${pt ? ` وهيخلص خلال ${pt}` : ''}، وهنبعتلك صورته أول ما يجهز.` + linkLine(o);
            }
        },
        {
            id: 'ready', label: 'الطلب جاهز', status: 'ready',
            build: o => {
                const m = O.orderMoney(o);
                return `طلبك رقم ${o.orderRef || ''} جاهز يا ${firstName(o)}! هنبعتلك صورته دلوقتي.` + (m.remaining ? `\nالمتبقي ${money(m.remaining)} بتحوّله قبل ما نشحن.` + payLines(m.remaining) : '') + `\nلو العنوان اتغير ابعتهولنا.`;
            }
        },
        {
            id: 'shipped', label: 'الطلب اتشحن', status: 'shipped',
            build: o => {
                const m = O.orderMoney(o);
                return `طلبك رقم ${o.orderRef || ''} خرج للشحن وهيوصلك قريب.` + linkLine(o);
            }
        },
        {
            id: 'thanks', label: 'شكر بعد الاستلام وطلب رأي', status: 'delivered',
            build: o => `أهلًا ${firstName(o)}، طلبك رقم ${o.orderRef || ''} وصلك؟ نتمنى يكون عجبك!\nلو تقدر ابعتلنا صورته في مكانه أو رأيك في كلمتين، ده بيفرق معانا جدًا. ولو حبيت تطلب تاني إحنا موجودين.`
        }
    ];
    O.templateForStatus = status => ({ new: 'confirm', confirmed: 'deposit_reminder', deposit_paid: 'deposit_received', in_production: 'ready', ready: 'shipped', shipped: 'thanks', delivered: 'thanks' }[status] || 'confirm');
    O.waPhone = raw => { let p = String(raw || '').replace(/\D/g, '').replace(/^0+/, ''); if (!p.startsWith('20')) p = '20' + p; return p; };
    O.waLinkTo = (phone, text) => `https://wa.me/${O.waPhone(phone)}?text=${encodeURIComponent(text)}`;
})(typeof window !== 'undefined' ? window : globalThis);
