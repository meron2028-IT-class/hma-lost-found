// email-config.js - SIMPLE VERSION
(function() {
    if (typeof emailjs !== 'undefined') {
        emailjs.init('bRVHUE9wFV4psMnIu');
        console.log('✅ EmailJS initialized');
    } else {
        console.error('❌ EmailJS not loaded');
    }
})();