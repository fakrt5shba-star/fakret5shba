// أدوات مشتركة لدوال Vercel — الملفات اللي بتبدأ بـ _ مش بتتنشر كـ endpoint
const CFG = require('../assets/js/config.js');

const toArr = v => (Array.isArray(v) ? v : Object.values(v || {})).filter(x => x != null);
const latinDigits = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const isHttps = s => typeof s === 'string' && /^https:\/\//.test(s);
const isDataImage = s => typeof s === 'string' && /^data:image\/[\w+.-]+;base64,/.test(s) && s.length > 100;

async function loadProducts() {
    const res = await fetch(`${CFG.firebase.databaseURL}/storeData/products.json`);
    if (!res.ok) throw new Error('firebase ' + res.status);
    return toArr(await res.json());
}

// كل صور المنتج الصالحة بالترتيب (الرئيسية ثم الإضافية)
const productImages = p => [p.image, ...toArr(p.extraImages)].filter(s => isHttps(s) || isDataImage(s));

// نفس قواعد السعر اللي في assets/js/store.js
function parsePrice(rawPrice, rawDiscount) {
    const str = latinDigits(rawPrice).trim();
    const discount = Math.max(0, Math.min(90, parseFloat(rawDiscount) || 0));
    if (!str || /^(https?:|wa\.me)/i.test(str)) return { kind: 'quote' };
    const nums = (str.match(/\d+(\.\d+)?/g) || []).map(Number).filter(n => n > 0);
    if (!nums.length) return { kind: 'quote' };
    if (nums.length > 1) return { kind: 'range', options: nums };
    const base = nums[0];
    return { kind: 'fixed', base, discount, final: discount ? Math.round(base * (100 - discount)) / 100 : base };
}

module.exports = { CFG, toArr, isHttps, isDataImage, loadProducts, productImages, parsePrice };
