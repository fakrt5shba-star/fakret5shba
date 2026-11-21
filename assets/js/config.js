// إعدادات الموقع في مكان واحد — لما ننقل Firebase نغيّر firebase بس
// الملف ده بيشتغل في المتصفح (window.FK_CONFIG) وفي دوال Vercel (require)
(function (root) {
    const CFG = {
        siteUrl: 'https://fakret5shba.com',
        // مشروع fekra-store على حساب صاحب المتجر (قاعدة البيانات في بلجيكا europe-west1)
        firebase: {
            apiKey: "AIzaSyC8dRXkbwqXO1rTZpnv9aNccGlfc9QQ2QM",
            authDomain: "fekra-store-1d289.firebaseapp.com",
            databaseURL: "https://fekra-store-1d289-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "fekra-store-1d289",
            storageBucket: "fekra-store-1d289.firebasestorage.app",
            messagingSenderId: "917571201181",
            appId: "1:917571201181:web:846a8c483c142b0473cc74"
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
