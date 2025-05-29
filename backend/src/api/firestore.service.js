const { db, admin } = require('../config/firebaseAdmin'); // Cần admin cho FieldPath

const getCollection = (collectionName) => db.collection(collectionName);

const getDocumentById = async (collectionName, docId) => {
    const docRef = db.collection(collectionName).doc(docId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
};

const getDocumentsByIds = async (collectionName, idList) => {
    if (!idList || idList.length === 0) return [];
    if (idList.length > 30) { // Giới hạn hiện tại của Firestore `in` query
        console.warn(`Attempted to fetch ${idList.length} documents by ID. Firestore 'in' query limit is 30. Truncating.`);
        idList = idList.slice(0, 30); // Cắt bớt để tránh lỗi
    }
    const collectionRef = db.collection(collectionName);
    // Firestore whereIn query
    const snapshot = await collectionRef.where(admin.firestore.FieldPath.documentId(), 'in', idList).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

module.exports = {
    getCollection,
    getDocumentById,
    getDocumentsByIds,
};