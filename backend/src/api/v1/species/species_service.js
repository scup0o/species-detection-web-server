const { raw } = require('express');
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

const getObservation = async (uid, speciesId) => {
  try {
    
    // Truy vấn các document có uid và speciesId phù hợp, và sắp xếp theo dateFound
    const querySnapshot = await firestoreService.getCollection('observations')
      .where('uid', '==', uid)
      .where('speciesId', '==', speciesId)
      .orderBy('dateFound', 'asc')  // Sắp xếp theo dateFound (ngày sớm nhất)
      .limit(1).get()  // Lấy chỉ 1 document đầu tiên
    
    if (!querySnapshot.empty) {
      // Lấy document đầu tiên
      const observation = querySnapshot.docs[0].data();
      console.log('Observation found:', observation);
      return observation;
    } else {
      console.log('No observation found matching criteria.');
      return null;
    }
  } catch (error) {
    console.error('Error getting observation:', error);
  }
};

const toDisplayableSpecies = async (speciesRawData, speciesId, languageCode,uid) => {
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

    let haveObservation = false;
    let firstFound = null
    console.log(uid)
    let observationCheck = {}

    if (uid!=null && uid!=""){
        
        observationCheck = await getObservation(uid, speciesId);
        if (observationCheck!=null){
            haveObservation = true;
                firstFound = observationCheck.dateFound.toISOString()
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
        thumbnailImageURL,
        imageURL: processedImageURLs.length > 0 ? processedImageURLs : null,
        haveObservation,
        firstFound
    };
};

function ensureArray(value) {
    if (Array.isArray(value)) {
        return value; // Đã là mảng, giữ nguyên
    }
    if (value && typeof value === 'string' && value.trim() !== "") {
        return [value]; // Là chuỗi không rỗng, tạo mảng với một phần tử là chuỗi đó
    }
    return []; // Là null, undefined, hoặc chuỗi rỗng, trả về mảng rỗng
}

function ensureObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        // value tồn tại, là kiểu 'object', và không phải là mảng
        return value;
    }
    return {}; // Trả về object rỗng cho các trường hợp khác (null, undefined, primitive, array)
}

const toDisplayableSpeciesDetailed = async (speciesRawData, speciesId, languageCode) => {
    // Luôn kiểm tra speciesRawData trước tiên
    if (!speciesRawData) {
        console.warn(`[toDisplayableSpeciesDetailed] speciesRawData is undefined for ID: ${speciesId}`);
        // Trả về một cấu trúc mặc định hoặc null/undefined tùy theo yêu cầu của bạn
        // Ở đây, tôi sẽ trả về null để báo hiệu không thể xử lý
        return null;
    }
    console.log(`[DEBUG toDisplayableSpeciesDetailed] Received languageCode: '${languageCode}' for speciesId: ${speciesId}`);

    const internalClassMap = await getSpeciesClassMapInternal();
    const speciesData = speciesRawData; // speciesData giờ chắc chắn không undefined

    // Lấy classNameMapForSpecies, đảm bảo speciesData.classId tồn tại
    const classNameMapForSpecies = speciesData.classId ? (internalClassMap[speciesData.classId] || {}) : {};

    // Sử dụng optional chaining (?.) và nullish coalescing (??) để xử lý undefined/null
    const localizedName = speciesData.name?.[languageCode] ?? speciesData.name?.['en'] ?? "";
    const localizedFamily = speciesData.family?.[languageCode] ?? speciesData.family?.['en'] ?? "";
    const scientificFamily = speciesData.family?.scientific ?? "";

    const localizedClassName = classNameMapForSpecies[languageCode] ?? classNameMapForSpecies['en'] ?? speciesData.classId ?? "";

    // Xử lý scientificClass cẩn thận hơn
    let scientificClass = "";
    if (speciesData.classId && typeof speciesData.classId === 'string' && speciesData.classId.length > 0) {
        scientificClass = speciesData.classId.charAt(0).toUpperCase() + speciesData.classId.slice(1).toLowerCase();
    }

    const originalImageUrls = speciesData.imageURL || []; // Đảm bảo originalImageUrls là mảng
    let processedImageURLs = [];
    if (Array.isArray(originalImageUrls)) {
        for (let i = 0; i < originalImageUrls.length; i++) {
            if (originalImageUrls[i]) { // Kiểm tra url có tồn tại không
                processedImageURLs.push(getTransformationBaseImageURL(originalImageUrls[i]));
            }
        }
    }

    let thumbnailImageURL = null; // Mặc định là null
    if (originalImageUrls.length > 0 && originalImageUrls[0]) {
        thumbnailImageURL = getThumbnailImageURL(originalImageUrls[0]);
    }

    // Kiểm tra các trường text có thể là object theo ngôn ngữ
    const rawSummary = speciesData.summary?.[languageCode] ?? speciesData.summary?.['en'];
    const rawPhysicalDescription = speciesData.physicalDescription?.[languageCode] ?? speciesData.physicalDescription?.['en'];
    const rawHabitat = speciesData.habitat?.[languageCode] ?? speciesData.habitat?.['en'];
    const rawDistribution = speciesData.distribution?.[languageCode] ?? speciesData.distribution?.['en']; // Sửa lỗi chính tả nếu cần
    const rawBehavior = speciesData.behavior?.[languageCode] ?? speciesData.behavior?.['en'];

    // Áp dụng hàm helper để đảm bảo kết quả là mảng
    const localizedSummary = ensureArray(rawSummary);
    const localizedPhysical = ensureArray(rawPhysicalDescription);
    const localizedHabitat = ensureArray(rawHabitat);
    const localizedDistribution = ensureArray(rawDistribution);
    const localizedBehavior = ensureArray(rawBehavior);

    return {
        id: speciesId,
        localizedName,
        localizedClass: localizedClassName,
        scientific: {
            name: speciesData.scientificName ?? "",
            family: scientificFamily,
            class: scientificClass, // scientificClass đã được xử lý
        },
        localizedFamily,
        thumbnailImageURL, // Có thể là null
        imageURL: processedImageURLs, // Trả về null nếu không có ảnh đã xử lý
        info: ensureObject(speciesData.info), // Giả sử info có thể không tồn tại
        conservation: speciesData.conservation ?? "", // Giả sử conservation có thể không tồn tại

        // Các trường mô tả chi tiết, trả về null nếu không có bản dịch phù hợp
        localizedSummary,
        localizedPhysical,
        localizedHabitat,
        localizedDistribution,
        localizedBehavior
    };
};

const getSpeciesList = async (options) => {
    const { pageSize = 5, 
        searchQuery: originalSearchQuery, 
        classId, 
        languageCode = 'en', 
        lastVisibleDocId: clientLastVisibleDocId, page = 1,uid } = options;
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
        itemsForCurrentPageData.map(item => toDisplayableSpecies(item.data, item.id, languageCode, uid))
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

const getSpeciesByIdsList = async (idList, languageCode, uid) => {
    if (!idList || idList.length === 0) return { items: [], pagination: { totalItems: 0, currentPage: 1, pageSize: 0, totalPages: 0, lastVisibleDocId: null, hasNextPage: false } };
    const fieldsToFetch = ["classId, family, imageURL, name, scientificName"];

    
    const rawSpeciesList = await firestoreService.getDocumentsByIds(SPECIES_COLLECTION, idList, fieldsToFetch);
    if (rawSpeciesList.length === 0) return { items: [], pagination: { totalItems: 0, currentPage: 1, pageSize: idList.length, totalPages: 0, lastVisibleDocId: null, hasNextPage: false } };

    const displayableItems = await Promise.all(
        rawSpeciesList.map(sRaw => toDisplayableSpecies(sRaw, sRaw.id, languageCode,uid)) // sRaw is {id, ...data}
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

const getSpeciesByDocumentId = async (speciesId, languageCode) => {
    if (!speciesId) {
        console.warn("getSpeciesByDocumentId: speciesId is required.");
        return null;
    }

    try {
        const speciesDoc = await firestoreService.getDocumentById(SPECIES_COLLECTION, speciesId);

        if (speciesDoc) {
            // speciesDoc đã bao gồm { id: doc.id, ...data } từ firestoreService.getDocumentById
            // Giờ chúng ta cần map nó sang DisplayableSpecies
            // Hàm toDisplayableSpecies đã được cập nhật để nhận (speciesData, speciesId, languageCode)
            // speciesData ở đây là speciesDoc (không bao gồm id nữa vì đã truyền riêng speciesId)
            const { id, ...speciesDataOnly } = speciesDoc; // Tách id ra khỏi data
            console.log(speciesDoc)
            return await toDisplayableSpeciesDetailed(speciesDataOnly, speciesId, languageCode);
        } else {
            console.log(`getSpeciesByDocumentId: No species found with ID: ${speciesId}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching species by document ID ${speciesId}:`, error);
        throw error; // Hoặc trả về null tùy theo cách bạn muốn xử lý lỗi ở controller
    }
};

module.exports = { getSpeciesList, getSpeciesByIdsList, getSpeciesClassesList, getSpeciesByDocumentId };