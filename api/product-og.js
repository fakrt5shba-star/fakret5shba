// معاينة المنتج لما الرابط يتشارك على فيسبوك/واتساب/إنستجرام/تيليجرام:
// بوتات السوشيال مش بتشغّل JavaScript، فبنرجعلها صفحة فيها صورة واسم وسعر المنتج (vercel.json بيوجّه البوتات بس هنا)
const { CFG, loadProducts, productImages, parsePrice, isHttps } = require('./_shared');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = s => String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();

module.exports = async (req, res) => {
    const id = String(req.query.id || '');
    const pageUrl = `${CFG.siteUrl}/product?id=${encodeURIComponent(id)}`;
    let title = 'فكرة خشبة | لوحات نيون وأكريليك ولايت بوكس', desc = 'لوحات نيون وأكريليك ولايت بوكس وديكورات حسب الطلب.', image = `${CFG.siteUrl}/assets/img/hero-neon-coffee.jpeg`, priceTags = '';
    try {
        const p = (await loadProducts()).find(x => String(x.id) === id);
        if (p) {
            const price = parsePrice(p.price, p.discount);
            const priceText = price.kind === 'fixed' ? `${price.final.toLocaleString('en-US')} ج.م` : price.kind === 'range' ? `يبدأ من ${Math.min(...price.options).toLocaleString('en-US')} ج.م` : 'اطلب عرض سعر';
            title = `${clean(p.name)} — ${priceText} | فكرة خشبة`;
            desc = clean(p.desc || p.description || String(p.material || '').replace(/[\r\n]+/g, '، ')).slice(0, 200) || desc;
            const first = productImages(p)[0];
            if (first) image = isHttps(first) ? first : `${CFG.siteUrl}/api/product-image?id=${encodeURIComponent(id)}&n=0`;
            if (price.kind === 'fixed') priceTags = `<meta property="product:price:amount" content="${price.final}"><meta property="product:price:currency" content="EGP">`;
        }
    } catch (e) { /* بنرجع المعاينة العامة */ }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="فكرة خشبة"><meta property="og:locale" content="ar_EG">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${esc(pageUrl)}">${priceTags}
<meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=${esc(pageUrl)}">
</head><body><a href="${esc(pageUrl)}">${esc(title)}</a></body></html>`);
};
