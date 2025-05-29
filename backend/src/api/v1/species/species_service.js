const { db, admin } = require('../../../config/firebaseAdmin');
const { getSquareImageURL, getThumbnailImageURL } = require('../../../helpers/cloudinaryHelpers');
const firestoreService = require('../../firestore.service');

const SPECIES_COLLECTION = 'species';
const SPECIES_CLASSES_COLLECTION = 'speciesClass';

let speciesClassMapCache = { data: null, lastFetched: 0, ttl: 5 * 60 * 1000 };

const getSpeciesClassMapInternal = async () => {
    const now = Date.now();
    if (speciesClassMapCache.data && (now - speciesClassMapCache.lastFetched < speciesClassMapCache.ttl)) {
        return speciesClassMapCache.data;
    }
    const classCollectionData = {};
    try {
        const snapshot = await firestoreService.getCollection(SPECIES_CLASSES_COLLECTION).get();
        snapshot.forEach(doc => {
            classCollectionData[doc.id] = doc.data().name || {};
        });
        speciesClassMapCache.data = classCollectionData;
        speciesClassMapCache.lastFetched = now;
        return classCollectionData;
    } catch (err) {
        console.error("Error fetching species classes for internal map:", err);
        return {};
    }
};

const toDisplayableSpecies = async (speciesRawData, speciesId, languageCode) => {
    const internalClassMap = await getSpeciesClassMapInternal();
    const speciesData = speciesRawData;

    const classNameMapForSpecies = internalClassMap[speciesData.classId] || {};

    const localizedName = speciesData.name?.[languageCode] || speciesData.name?.['en'] || "N/A";
    const localizedFamily = speciesData.family?.[languageCode] || speciesData.family?.['en'] || "N/A";
    const scientificFamily = speciesData.family?.scientific || "N/A";
    const localizedClassName = classNameMapForSpecies[languageCode] || classNameMapForSpecies['en'] || speciesData.classId || "N/A";
    const scientificClass = speciesData.classId.charAt(0).toUpperCase() + speciesData.classId.slice(1).toLowerCase()

    const originalImageUrls = speciesData.imageURL || []; 
    let processedImageURLs = [];

    if (originalImageUrls.length > 0) {
        processedImageURLs.push(getThumbnailImageURL(originalImageUrls[0]));

        for (let i = 1; i < originalImageUrls.length; i++) {
            processedImageURLs.push(getSquareImageURL(originalImageUrls[i]));
        }
    }

    return {
        id: speciesId,
        localizedName,
        localizedClass: localizedClassName,
        scientific: {
            name: speciesData.scientificName || "N/A",
            family: scientificFamily,
            class: scientificClass,
        },
        localizedFamily,
        imageURL: processedImageURLs.length > 0 ? processedImageURLs : null,
    };
};

const getSpeciesList = async (options) => {
    const { pageSize = 10, searchQuery, classId, languageCode = 'en', lastVisibleDocId, page = 1 } = options;
    const limit = parseInt(pageSize);
    let query = firestoreService.getCollection(SPECIES_COLLECTION);

    if (classId && classId !== "0") {
        query = query.where('classId', '==', classId);
    }

    let searchTokens = [];
    if (searchQuery) {
        searchTokens = searchQuery.toLowerCase().trim().split(/[\s,-]+/).filter(token => token.length > 0);
    }

    if (searchTokens.length > 0) {
        const maxTokensForQuery = 10;
        const tokensForFirestoreQuery = searchTokens.slice(0, maxTokensForQuery);
        if (tokensForFirestoreQuery.length > 0) {
            const tokenFieldLang = `nameTokens.${languageCode}`;
            const tokenFieldSci = 'scientificNameToken';
            query = query.where(admin.firestore.Filter.or(
                admin.firestore.Filter.where(tokenFieldLang, 'array-contains-any', tokensForFirestoreQuery),
                admin.firestore.Filter.where(tokenFieldSci, 'array-contains-any', tokensForFirestoreQuery)
            ));
        }
    }

    const countQuery = query;
    const totalItemsSnapshot = await countQuery.count().get();
    const totalItems = totalItemsSnapshot.data().count;

    query = query.orderBy(admin.firestore.FieldPath.documentId());

    if (lastVisibleDocId) {
        const actualDocSnapshot = await firestoreService.getCollection(SPECIES_COLLECTION).doc(lastVisibleDocId).get();
        if (actualDocSnapshot.exists) {
            query = query.startAfter(actualDocSnapshot);
        }
    }
    query = query.limit(limit);

    const snapshot = await query.get();
    let fetchedRawData = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

    if (searchTokens.length > 0) { // Client-side (server-side) filtering for all tokens
        fetchedRawData = fetchedRawData.filter(item => {
            const speciesDocData = item.data;
            const nameTokensLower = speciesDocData.nameTokens?.[languageCode]?.map(t => t.toLowerCase()) || [];
            const sciTokensLower = speciesDocData.scientificNameToken?.map(t => t.toLowerCase()) || [];
            const combinedItemTokens = [...nameTokensLower, ...sciTokensLower];
            return searchTokens.every(st => combinedItemTokens.some(ct => ct.includes(st)));
        });
    }

    const displayableItems = await Promise.all(
        fetchedRawData.map(item => toDisplayableSpecies(item.data, item.id, languageCode))
    );

    const currentPageNumber = parseInt(page);
    const lastDocInPage = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    const newLastVisibleDocId = lastDocInPage ? lastDocInPage.id : null;
    const hasNextPage = (currentPageNumber * limit) < totalItems && displayableItems.length === limit;

    return {
        items: displayableItems,
        pagination: { totalItems, currentPage: currentPageNumber, pageSize: limit, totalPages: Math.ceil(totalItems / limit), lastVisibleDocId: newLastVisibleDocId, hasNextPage }
    };
};

const getSpeciesByIdsList = async (idList, languageCode) => {
    if (!idList || idList.length === 0) return { items: [], pagination: { totalItems: 0, currentPage: 1, pageSize: 0, totalPages: 0, lastVisibleDocId: null, hasNextPage: false } };
    const rawSpeciesList = await firestoreService.getDocumentsByIds(SPECIES_COLLECTION, idList);
    if (rawSpeciesList.length === 0) return { items: [], pagination: { totalItems: 0, currentPage: 1, pageSize: idList.length, totalPages: 0, lastVisibleDocId: null, hasNextPage: false } };

    const displayableItems = await Promise.all(
        rawSpeciesList.map(sRaw => toDisplayableSpecies(sRaw, sRaw.id, languageCode)) // sRaw is {id, ...data}
    );

    return {
        items: displayableItems,
        pagination: { totalItems: displayableItems.length, currentPage: 1, pageSize: displayableItems.length, totalPages: 1, lastVisibleDocId: displayableItems.length > 0 ? displayableItems[displayableItems.length - 1].id : null, hasNextPage: false }
    };
};

const getSpeciesClassesList = async () => {
    try {
        const classCollection = firestoreService.getCollection(SPECIES_CLASSES_COLLECTION);
        const snapshot = await classCollection.orderBy(admin.firestore.FieldPath.documentId()).get();
        return snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
    } catch (err) {
        console.error("Error fetching species classes list:", err);
        throw err;
    }
};

module.exports = { getSpeciesList, getSpeciesByIdsList, getSpeciesClassesList };