const BASE_URL = "https://res.cloudinary.com/degflo4pi/image/upload/"
const VERSION = "v1746955323/"

const TRANSFORMATION_SQUARE = "ar_1:1,c_fill,g_auto/"
const TRANSFORMATION_THUMBNAIL = "w_100,ar_1:1,c_fill,g_auto/"
const TRANSFORMATION_BASE = "w_1080,c_scale/"

function getBaseImageURL(originalURL){
        return BASE_URL+VERSION+originalURL
    }

function getSquareImageURL(originalURL) {
    if (!originalURL) return null;

    return BASE_URL+TRANSFORMATION_SQUARE+VERSION+originalURL
}

function getThumbnailImageURL(originalURL){
    return BASE_URL+TRANSFORMATION_THUMBNAIL+VERSION+originalURL
}

function getTransformationBaseImageURL(originalURL){
    return BASE_URL+TRANSFORMATION_BASE+VERSION+originalURL
}

module.exports = { getSquareImageURL, getBaseImageURL, getThumbnailImageURL, getTransformationBaseImageURL };