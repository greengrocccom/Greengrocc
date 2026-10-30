// Mongoose projections for list/poll endpoints. They only exclude inline base64
// media that list screens never render; detail endpoints keep loading full documents.

export const FARMER_LIST_EXCLUDE = "-password -profileImage -farm.farmPhotos -farm.farmVideos -fcmTokens";

export const PICKUP_LIST_EXCLUDE = "-confirmationPhotos -receiving.photos";

export const DRIVER_LIST_EXCLUDE = "-password -documents -fcmTokens";

export const CROP_LIST_EXCLUDE = "-photos -certificates.fileUrl";

// media.mainPhoto and image stay: panel product tables use them as the row thumbnail.
export const PRODUCT_LIST_EXCLUDE = "-images -media.farmPhotos -media.cropPhotos -media.harvestPhotos -media.videos";

// gradeQuality is Mixed and keyed by grade label (keys contain spaces), so this must be an object.
export const INSPECTION_LIST_EXCLUDE = {
  qualityPhotos: 0,
  "gradeQuality.Grade A.photos": 0,
  "gradeQuality.Grade B.photos": 0,
  "gradeQuality.Grade C.photos": 0,
};
