// تنبيه لصاحب المتجر على تيليجرام أول ما ييجي طلب جديد
// شغال بس لو متغيرات البيئة دي متظبطة في Vercel (Settings > Environment Variables):
//   TELEGRAM_BOT_TOKEN  — من @BotFather
//   TELEGRAM_CHAT_ID    — رقم المحادثة اللي هيوصلها التنبيه
// الرسالة مفيهاش اسم ولا موبايل ولا عنوان العميل: رقم الطلب والمنتجات والمحافظة بس، والتفاصيل في لوحة الإدارة.
const CFG = require('../assets/js/config.js');

const REF_RE = /^FK-[A-Z0-9]{6}$/;
const recent = new Map(); // منع تكرار نفس التنبيه من نفس النسخة

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('method not allowed'); }

    const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const ref = String((body && body.ref) || '');
    if (!REF_RE.test(ref)) { res.statusCode = 400; return res.end('bad ref'); }
    if (!token || !chatId) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ ok: true, sent: false, reason: 'not configured' })); }
    if (recent.has(ref)) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ ok: true, sent: false, reason: 'duplicate' })); }

    try {
        // نتأكد إن الطلب موجود فعلًا ولسه جديد (آخر 15 دقيقة) قبل ما نبعت
        const r = await fetch(`${CFG.firebase.databaseURL}/tracking/${ref}.json`);
        const t = r.ok ? await r.json() : null;
        if (!t || !t.createdAt || Date.now() - Number(t.createdAt) > 15 * 60 * 1000) {
            res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ ok: true, sent: false, reason: 'not found or old' }));
        }
        recent.set(ref, Date.now());
        if (recent.size > 500) recent.delete(recent.keys().next().value);

        const type = { cart: 'طلب من السلة', quote: 'طلب عرض سعر', studio: 'طلب من الاستوديو' }[t.type] || 'طلب';
        const items = (Array.isArray(t.items) ? t.items : Object.values(t.items || {})).slice(0, 10)
            .map(i => `• ${String(i.name || '').slice(0, 80)}${Number(i.qty) > 1 ? ` × ${Number(i.qty)}` : ''}`).join('\n');
        const total = t.total ? `${Number(t.total).toLocaleString('en-US')} ج.م` : 'السعر بيتحدد';
        const text = `🛎 ${type} جديد ${ref}\n${items}\nالإجمالي: ${total}${t.governorate ? `\nالمحافظة: ${t.governorate}` : ''}\n\nافتح لوحة الإدارة: ${CFG.siteUrl}/admin`;

        const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
        });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, sent: tg.ok }));
    } catch (e) {
        res.statusCode = 502; res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false }));
    }
};
