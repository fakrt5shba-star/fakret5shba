// إعدادات الموقع في مكان واحد — لما ننقل Firebase نغيّر firebase بس
// الملف ده بيشتغل في المتصفح (window.FK_CONFIG) وفي دوال Vercel (require)
(function (root) {
    const CFG = {
        siteUrl: 'https://fakret5shba.com',
        firebase: {
            apiKey: "AIzaSyAvVMu2xPpZGY2acNzn2A9QfxnQy_J3IZI",
            authDomain: "open-close-11f8d.firebaseapp.com",
            databaseURL: "https://open-close-11f8d-default-rtdb.firebaseio.com",
            projectId: "open-close-11f8d"
        },
        // رقم المبيعات المستخدم في زر "اعمل تصميمك" وأسعار "تواصل للسعر" في قاعدة البيانات
        whatsappSales: '201094324500',
        phoneSalesDisplay: '0109 432 4500',
        // الرقم الموجود في فوتر الموقع الحالي
        whatsappSupport: '201069222150',
        socials: {
            facebook: 'https://www.facebook.com/fkrt.khshbh',
            instagram: 'https://www.instagram.com/fkrt.khshbh',
            tiktok: 'https://www.tiktok.com/@fkret.khshba'
        }
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = CFG;
    else root.FK_CONFIG = CFG;
})(typeof window !== 'undefined' ? window : globalThis);
