// ============================================
// model/firebase-config.js
// ============================================
const firebaseConfig = {
    apiKey:            'AIzaSyCxcM4BgmGk62qIC7KbM_7nrrjMKwS_TOc',
    authDomain:        'ofertas-vendedores.firebaseapp.com',
    databaseURL:       'https://ofertas-vendedores-default-rtdb.firebaseio.com',
    projectId:         'ofertas-vendedores',
    storageBucket:     'ofertas-vendedores.firebasestorage.app',
    messagingSenderId: '811095753027',
    appId:             '1:811095753027:web:155270bef73de3e28b2ff6'
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const database   = firebase.database();
const ofertasRef = database.ref('ofertasMartinello');
