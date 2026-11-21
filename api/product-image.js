// /api/product-image?id=ID&n=0 — لينك https لصورة منتج لسه متخزنة base64 في قاعدة البيانات
// (المنتجات الجديدة اللي بتترفع من لوحة الإدارة قبل تفعيل Firebase Storage)
const { loadProducts, productImages, isHttps } = require('./_shared');

module.exports = async (req, res) => {
    const id = String(req.query.id || '');
    const n = Math.max(0, parseInt(req.query.n, 10) || 0);
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return res.status(400).send('bad id');
    try {
        const p = (await loadProducts()).find(x => String(x.id) === id);
        const src = p && productImages(p)[n];
        if (!src) return res.status(404).send('not found');
        if (isHttps(src)) { res.setHeader('Cache-Control', 'public, s-maxage=3600'); return res.redirect(302, src); }
        const m = src.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
        res.setHeader('Content-Type', m[1]);
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
        res.status(200).send(Buffer.from(m[2], 'base64'));
    } catch (e) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(502).send('image temporarily unavailable');
    }
};
