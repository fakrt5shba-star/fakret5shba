// /meta-catalog.csv — كتالوج ميتا بيتولّد من قاعدة البيانات في كل طلب (مع كاش 5 دقايق)
// الأسعار والخصومات والصور من قاعدة البيانات، والعناوين والأوصاف من data/meta-catalog.json لو موجودة
const { CFG, toArr, loadProducts, productImages, parsePrice, isHttps } = require('./_shared');
const CONTENT = require('../data/meta-catalog.json').products || {};

const COLUMNS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'brand', 'item_group_id', 'size', 'custom_label_0'];
const LABEL_BY_KEYWORD = [['نيون', 'نيون'], ['دعاية', 'دعاية'], ['qr', 'دعاية'], ['شركة', 'شركة'], ['لوجو', 'شركة'], ['مكتب', 'مكتب'], ['office', 'مكتب'], ['منزل', 'ديكور'], ['ڤيلا', 'ديكور'], ['ديكور', 'ديكور']];

const csvCell = v => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const money = n => `${(Math.round(n * 100) / 100).toFixed(2)} EGP`;
const cleanText = s => String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s*[\r\n]+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

function fallbackLabel(p) {
    const hay = (String(p.label || '') + ' ' + String(p.name || '')).toLowerCase();
    const hit = LABEL_BY_KEYWORD.find(([k]) => hay.includes(k));
    return hit ? hit[1] : '';
}
function fallbackDescription(p) {
    const desc = cleanText(p.desc || p.description);
    if (desc) return desc.slice(0, 4900);
    const materials = String(p.material || '').split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
    return materials.length ? `${cleanText(p.name)} من ${materials.join('، ')}.` : cleanText(p.name);
}

function imageLink(p) {
    const first = productImages(p)[0];
    if (!first) return '';
    return isHttps(first) ? first : `${CFG.siteUrl}/api/product-image?id=${encodeURIComponent(p.id)}&n=0`;
}

function rowsFor(p) {
    const id = String(p.id);
    const price = parsePrice(p.price, p.discount);
    const image = imageLink(p);
    if (price.kind === 'quote' || !image) return []; // ميتا بيطلب سعر وصورة
    const content = CONTENT[id] || {};
    const base = {
        availability: 'in stock', condition: 'new', link: `${CFG.siteUrl}/?product=${encodeURIComponent(id)}`,
        image_link: image, brand: 'فكرة خشبة', custom_label_0: content.label || fallbackLabel(p)
    };
    if (price.kind === 'range') {
        const variants = Array.isArray(content.variants) && content.variants.length === price.options.length ? content.variants : null;
        const labels = toArr(p.optionLabels).map(s => String(s).trim()).filter(Boolean);
        if (!variants && labels.length === price.options.length) {
            // اختيارات من لوحة الإدارة (optionLabels): سطر لكل اختيار. المقاسات بس هي اللي بتتجمع كـ variants
            return labels.map((label, i) => {
                const isSize = /سم|×|متر|cm/i.test(label);
                return {
                    ...base, id: `${id}-${i + 1}`, title: `${content.title || cleanText(p.name)} — ${label}`,
                    description: content.description || fallbackDescription(p), price: money(price.options[i]), sale_price: '',
                    item_group_id: isSize ? id : '', size: isSize ? label : ''
                };
            });
        }
        if (!variants) {
            return [{ ...base, id, title: content.title || cleanText(p.name), description: content.description || fallbackDescription(p), price: money(Math.min(...price.options)), sale_price: '', item_group_id: '', size: '' }];
        }
        return variants.map((v, i) => ({
            ...base, id: `${id}-${v.key}`, title: v.title || `${cleanText(p.name)} ${v.size}`,
            description: v.description || fallbackDescription(p), price: money(price.options[i]), sale_price: '',
            item_group_id: id, size: v.size || ''
        }));
    }
    return [{
        ...base, id, title: content.title || cleanText(p.name), description: content.description || fallbackDescription(p),
        price: money(price.base), sale_price: price.discount ? money(price.final) : '', item_group_id: '', size: ''
    }];
}

module.exports = async (req, res) => {
    try {
        const products = await loadProducts();
        const rows = products.slice().sort((a, b) => Number(b.id) - Number(a.id)).flatMap(rowsFor);
        const csv = [COLUMNS.join(','), ...rows.map(r => COLUMNS.map(c => csvCell(r[c])).join(','))].join('\n') + '\n';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.status(200).send(csv);
    } catch (e) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(502).send('catalog temporarily unavailable');
    }
};
