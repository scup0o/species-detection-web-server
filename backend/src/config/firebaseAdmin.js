const admin = require('firebase-admin');
const path = require('path');

// Đảm bảo serviceAccountKey.json nằm ở thư mục gốc của project
const serviceAccountPath = path.resolve(process.cwd(), 'speciesdetection-firebase-key.json');
let serviceAccount;

try {
    serviceAccount = require(serviceAccountPath);
} catch (error) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!! Failed to load serviceAccountKey.json.                               !!!");
    console.error("!!! Make sure the file exists at the root of your project.               !!!");
    console.error("!!! Path checked: ", serviceAccountPath, "                               !!!");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    process.exit(1); // Thoát nếu không có key
}


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { db, admin };