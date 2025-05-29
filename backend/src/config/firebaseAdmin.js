const admin = require('firebase-admin');
require('dotenv').config(); // Nên đặt ở đầu file app.js hoặc server.js, nhưng ở đây cũng được

let credentialToUse; // Biến để lưu trữ credential, bất kể nguồn gốc

if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY_ID && // Thêm các trường cần thiết
    process.env.FIREBASE_CLIENT_ID &&
    process.env.FIREBASE_CLIENT_X509_CERT_URL
) {
    // Sử dụng các biến môi trường riêng lẻ
    console.log("Firebase Admin SDK: Attempting to initialize using individual environment variables.");
    try {
        const serviceAccountObject = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Quan trọng: xử lý ký tự xuống dòng
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
            universe_domain: "googleapis.com" // Thường có trong service account key gần đây
        };
        credentialToUse = admin.credential.cert(serviceAccountObject);
        console.log("Firebase Admin SDK: Successfully created credential from individual environment variables.");
    } catch (e) {
        console.error("Firebase Admin SDK: Error creating credential from individual environment variables.", e);
        process.exit(1); // Thoát nếu không tạo được credential từ env vars
    }
} else if (process.env.FIREBASE_CREDENTIALS_JSON) {
    // Sử dụng một biến môi trường chứa toàn bộ JSON key
    console.log("Firebase Admin SDK: Attempting to initialize using FIREBASE_CREDENTIALS_JSON environment variable.");
    try {
        const serviceAccountJson = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);
        credentialToUse = admin.credential.cert(serviceAccountJson);
        console.log("Firebase Admin SDK: Successfully created credential from FIREBASE_CREDENTIALS_JSON.");
    } catch (e) {
        console.error("Firebase Admin SDK: Failed to parse FIREBASE_CREDENTIALS_JSON. Ensure it's a valid JSON string.", e);
        process.exit(1); // Thoát nếu JSON không hợp lệ
    }
} else {
    // Fallback: Sử dụng file serviceAccountKey.json cục bộ (chỉ cho development)
    console.warn("Firebase Admin SDK: Environment variables for credentials not fully set. Attempting to use local serviceAccountKey.json for development.");
    try {
        const path = require('path');
        // Đảm bảo tên file và đường dẫn đúng
        const serviceAccountPath = path.resolve(process.cwd(), 'speciesdetection-firebase-key.json'); // Tên file của bạn
        console.log(`Firebase Admin SDK: Attempting to load local key from: ${serviceAccountPath}`);
        const localServiceAccount = require(serviceAccountPath);
        credentialToUse = admin.credential.cert(localServiceAccount);
        console.warn("Firebase Admin SDK: Using local serviceAccountKey.json. DO NOT COMMIT THIS FILE TO GIT and ensure it's in .gitignore.");
    } catch (e) {
        console.error("Firebase Admin SDK: Credentials not found. Set individual Firebase env vars (PROJECT_ID, PRIVATE_KEY, etc.), or FIREBASE_CREDENTIALS_JSON env var, or provide 'speciesdetection-firebase-key.json' locally for dev (and gitignore it).", e);
        process.exit(1); // Thoát nếu không tìm thấy credentials nào
    }
}

// Khởi tạo Firebase Admin SDK với credential đã được xác định
if (credentialToUse) {
    admin.initializeApp({
        credential: credentialToUse
        // databaseURL: process.env.FIREBASE_DATABASE_URL // Nếu dùng Realtime DB
    });
    console.log("Firebase Admin SDK initialized successfully.");
} else {
    // Trường hợp này không nên xảy ra nếu logic ở trên đã process.exit(1) khi có lỗi
    console.error("Firebase Admin SDK: CRITICAL - Could not obtain credentials to initialize.");
    process.exit(1);
}

const db = admin.firestore();
module.exports = { db, admin };