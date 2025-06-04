const { db, admin } = require('../../../config/firebaseAdmin');
const { getSquareImageURL, getThumbnailImageURL, getBaseImageURL, getTransformationBaseImageURL } = require('../../../helpers/cloudinaryHelpers');
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

 
        for (let i = 0; i < originalImageUrls.length; i++) {
            processedImageURLs.push(getTransformationBaseImageURL(originalImageUrls[i]));
        }
    
    let thumbnailImageURL= getThumbnailImageURL(originalImageUrls[0])

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
        thumbnailImageURL,
        imageURL: processedImageURLs.length > 0 ? processedImageURLs : null,
    };
};

const getSpeciesList = async (options) => {
    const { pageSize = 5, searchQuery: originalSearchQuery, classId, languageCode = 'en', lastVisibleDocId: clientLastVisibleDocId, page = 1 } = options;
    const actualPageSize = parseInt(pageSize);

    let lastQuery = "";
    let remainingQueryTokens = [];
    const hasSearchConditions = originalSearchQuery && originalSearchQuery.trim() !== "";

    if (hasSearchConditions) {
        const queryParts = originalSearchQuery.toLowerCase().trim().split(/[\s,-]+/).filter(token => token.length > 0);
        if (queryParts.length > 0) {
            lastQuery = queryParts.pop() || "";
            remainingQueryTokens = queryParts;
        }
    }
    console.log(`[SVC_GET_LIST] Init: Page=${page}, ClientCursor='${clientLastVisibleDocId}', Query='${originalSearchQuery}', Last='${lastQuery}', Tokens=[${remainingQueryTokens.join(',')}]`);

    let accumulatedFilteredData = [];
    let currentFirestoreCursorDocSnapshot = null;
    let hasMoreDataInFirestoreOverall = true;
    let totalFirestoreFetchesMade = 0;
    const MAX_RETRY_FETCHES_IF_PAGE_EMPTY = 2;

    if (clientLastVisibleDocId) {
        const initialCursorDoc = await firestoreService.getCollection(SPECIES_COLLECTION).doc(clientLastVisibleDocId).get();
        if (initialCursorDoc.exists) {
            currentFirestoreCursorDocSnapshot = initialCursorDoc;
        } else {
            console.warn(`[SVC_GET_LIST] clientLastVisibleDocId '${clientLastVisibleDocId}' not found. Will start from beginning for this query attempt.`);
        }
    }

    for (let fetchAttempt = 0; fetchAttempt <= MAX_RETRY_FETCHES_IF_PAGE_EMPTY; fetchAttempt++) {
        if (!hasMoreDataInFirestoreOverall && fetchAttempt > 0) { break; }
        if (accumulatedFilteredData.length >= actualPageSize && fetchAttempt > 0) { break; }

        let firestoreQuery = firestoreService.getCollection(SPECIES_COLLECTION);
        if (classId && classId !== "0") { firestoreQuery = firestoreQuery.where('classId', '==', classId); }

        // >>>>> PHẦN ĐƯỢC SỬA <<<<<
        if (remainingQueryTokens.length > 0) {
            const tokensForFirestore = remainingQueryTokens.slice(0, 10); // Giới hạn 10 token cho array-contains-any
            if (tokensForFirestore.length > 0) {
                firestoreQuery = firestoreQuery.where(admin.firestore.Filter.or(
                    admin.firestore.Filter.where(`nameTokens.${languageCode}`, 'array-contains-any', tokensForFirestore),
                    admin.firestore.Filter.where('scientificNameToken', 'array-contains-any', tokensForFirestore)
                ));
                
            }
        }
        // >>>>> KẾT THÚC PHẦN SỬA <<<<<
        firestoreQuery = firestoreQuery.orderBy(`name.${languageCode}`,'asc')
        //firestoreQuery = firestoreQuery.orderBy(admin.firestore.FieldPath.documentId());

        if (currentFirestoreCursorDocSnapshot) {
            firestoreQuery = firestoreQuery.startAfter(currentFirestoreCursorDocSnapshot);
        }

        const itemsToFetchInThisBatch = actualPageSize + 1;
        totalFirestoreFetchesMade++;
        console.log(`[SVC_GET_LIST] Firestore Fetch #${totalFirestoreFetchesMade} (Retry ${fetchAttempt}): Fetching up to ${itemsToFetchInThisBatch} items, starting after '${currentFirestoreCursorDocSnapshot?.id || 'beginning'}'.`);

        const snapshot = await firestoreQuery.select("classId", "family", "imageURL", "name", "scientificName").limit(itemsToFetchInThisBatch).get();
        const fetchedDocsInThisBatch = snapshot.docs;
        console.log(`[SVC_GET_LIST] Firestore Fetch #${totalFirestoreFetchesMade}: Fetched ${fetchedDocsInThisBatch.length} raw documents.`);

        if (fetchedDocsInThisBatch.length === 0) {
            hasMoreDataInFirestoreOverall = false;
            if (fetchAttempt === 0 && accumulatedFilteredData.length === 0) { /* ... log ... */ }
            continue;
        }
        currentFirestoreCursorDocSnapshot = fetchedDocsInThisBatch[fetchedDocsInThisBatch.length - 1];

        let detailedFilteredForThisBatch = [];
        if (hasSearchConditions) {
            for (const doc of fetchedDocsInThisBatch) {
                const speciesData = doc.data();
                let matchesToken = true;
                if (remainingQueryTokens.length > 0) {
                    const nameTokens = speciesData.nameTokens?.[languageCode]?.map(t => t.toLowerCase()) || [];
                    const sciTokens = speciesData.scientificNameToken?.map(t => t.toLowerCase()) || [];
                    const combinedTokens = [...nameTokens, ...sciTokens];
                    matchesToken = remainingQueryTokens.every(reqToken => combinedTokens.some(itemToken => itemToken.includes(reqToken)));
                }
                let matchesText = true;
                if (lastQuery) {
                    const nameLocalized = speciesData.name?.[languageCode] || "";
                    const scientificName = speciesData.scientificName || "";
                    matchesText = nameLocalized.toLowerCase().includes(lastQuery) || scientificName.toLowerCase().includes(lastQuery);
                    //const text = "Canis Famil"
                    //console.log(nameLocalized, scientificName, lastQuery, nameLocalized.toLowerCase().includes("c"), "c");

                }
                if (matchesToken && matchesText) {
                    detailedFilteredForThisBatch.push({ id: doc.id, data: speciesData });
                }
            }
        } else {
            fetchedDocsInThisBatch.forEach(doc => detailedFilteredForThisBatch.push({ id: doc.id, data: doc.data() }));
        }
        console.log(`[SVC_GET_LIST] Firestore Fetch #${totalFirestoreFetchesMade}: After detailed filter, ${detailedFilteredForThisBatch.length} items in this batch matched.`);
        accumulatedFilteredData.push(...detailedFilteredForThisBatch);

        if (fetchAttempt === 0 && detailedFilteredForThisBatch.length > 0) { break; }
        if (detailedFilteredForThisBatch.length > 0 && fetchAttempt > 0) { break; }
        if (fetchedDocsInThisBatch.length < itemsToFetchInThisBatch) {
            hasMoreDataInFirestoreOverall = false;
        }
    }

    const itemsForCurrentPageData = accumulatedFilteredData.slice(0, actualPageSize);
    const displayableItems = await Promise.all(
        itemsForCurrentPageData.map(item => toDisplayableSpecies(item.data, item.id, languageCode))
    );

    let newLastVisibleDocIdForClient = null;
    if (itemsForCurrentPageData.length > 0) {
        newLastVisibleDocIdForClient = itemsForCurrentPageData[itemsForCurrentPageData.length - 1].id;
    } else if (currentFirestoreCursorDocSnapshot) {
        newLastVisibleDocIdForClient = currentFirestoreCursorDocSnapshot.id;
    } else {
        newLastVisibleDocIdForClient = clientLastVisibleDocId;
    }

    let hasNextPage = false;
    if (accumulatedFilteredData.length > actualPageSize) {
        hasNextPage = true;
    } else if (accumulatedFilteredData.length === actualPageSize && hasMoreDataInFirestoreOverall) {
        hasNextPage = true;
    }
    console.log(`[SVC_GET_LIST] Finalizing: Returning ${displayableItems.length} items. HasNextPage=${hasNextPage}. NewClientCursor='${newLastVisibleDocIdForClient}'`);

    // Tính toán totalItems dựa trên query Firestore sơ bộ ban đầu
    let countQueryForTotal = firestoreService.getCollection(SPECIES_COLLECTION);
    if (classId && classId !== "0") { countQueryForTotal = countQueryForTotal.where('classId', '==', classId); }

    // >>>>> PHẦN ĐƯỢC SỬA <<<<<
    if (remainingQueryTokens.length > 0) {
        const tokensForFirestoreCount = remainingQueryTokens.slice(0, 10);
        if (tokensForFirestoreCount.length > 0) {
            countQueryForTotal = countQueryForTotal.where(admin.firestore.Filter.or(
                admin.firestore.Filter.where(`nameTokens.${languageCode}`, 'array-contains-any', tokensForFirestoreCount),
                admin.firestore.Filter.where('scientificNameToken', 'array-contains-any', tokensForFirestoreCount)
            ));
        }
    }
    // >>>>> KẾT THÚC PHẦN SỬA <<<<<

    const totalItemsSnapshotAfterAll = await countQueryForTotal.count().get();
    const finalEstimatedTotal = totalItemsSnapshotAfterAll.data().count;

    return {
        items: displayableItems,
        pagination: {
            totalItems: finalEstimatedTotal,
            currentPage: parseInt(page),
            pageSize: actualPageSize,
            totalPages: Math.ceil(finalEstimatedTotal / actualPageSize),
            lastVisibleDocId: newLastVisibleDocIdForClient,
            hasNextPage: hasNextPage
        }
    };
};

const getSpeciesByIdsList = async (idList, languageCode) => {
    if (!idList || idList.length === 0) return { items: [], pagination: { totalItems: 0, currentPage: 1, pageSize: 0, totalPages: 0, lastVisibleDocId: null, hasNextPage: false } };
    const fieldsToFetch = ["classId, family, imageURL, name, scientificName"];

    
    const rawSpeciesList = await firestoreService.getDocumentsByIds(SPECIES_COLLECTION, idList, fieldsToFetch);
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

const getSpeciesByIdDetailed = async (id, languageCode) =>{
    const rawSpeciesList = await firestoreService.getDocumentsByIds(SPECIES_COLLECTION, id);
    if (rawSpeciesList.length === 0) return { items: [], pagination: { totalItems: 0, currentPage: 1, pageSize: idList.length, totalPages: 0, lastVisibleDocId: null, hasNextPage: false } };

    const displayableItems = await Promise.all(
        rawSpeciesList.map(sRaw => toDisplayableSpecies(sRaw, sRaw.id, languageCode)) // sRaw is {id, ...data}
    );

    return {
        items: displayableItems,
        pagination: { totalItems: displayableItems.length, currentPage: 1, pageSize: displayableItems.length, totalPages: 1, lastVisibleDocId: displayableItems.length > 0 ? displayableItems[displayableItems.length - 1].id : null, hasNextPage: false }
    };
}

module.exports = { getSpeciesList, getSpeciesByIdsList, getSpeciesClassesList, getSpeciesByIdDetailed };