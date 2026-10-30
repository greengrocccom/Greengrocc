import mongoose from "mongoose";
import bcrypt from "bcrypt";

const deliveryManagerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Enter a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    cityId: {
      type: String,
      trim: true,
      default: "",
    },
    area: {
      type: String,
      required: [true, "Area is required"],
      trim: true,
      index: true,
    },
    storeName: {
      type: String,
      trim: true,
      default: "",
    },
    storeAddress: {
      type: String,
      trim: true,
      default: "",
    },
    pincode: {
      type: String,
      trim: true,
      default: "",
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    deliveryRadiusKm: {
      type: Number,
      default: 5,
      min: 1,
      max: 25,
    },
    geofenceRadius: {
      type: Number,
      default: 500, // 500 meters allowed radius for rider check-in
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /** Set once the starter products + inventory have been created for this store. */
    storeSeededAt: {
      type: Date,
      default: null,
    },
    fullTimeMonthlySalary: {
      type: Number,
      default: 0,
    },
    /** Vendor (collection centre) that supplies this dark store. */
    vendorId: {
      type: String,
      default: "",
      index: true,
    },
    /** Approved VendorZone this dark store belongs to ("" for stores created before zones existed). */
    zoneId: {
      type: String,
      default: "",
      index: true,
    },
    zoneName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

deliveryManagerSchema.index({ cityId: 1, area: 1 });

deliveryManagerSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

deliveryManagerSchema.methods.comparePassword = async function comparePassword(
  candidate
) {
  return bcrypt.compare(candidate, this.password);
};

deliveryManagerSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    phone: this.phone,
    state: this.state,
    city: this.city,
    cityId: this.cityId,
    area: this.area,
    storeName: this.storeName || `${this.area} Store`,
    storeAddress:
      this.storeAddress ||
      `${this.storeName || `${this.area} Store`}, ${this.area}, ${this.city}, ${this.state}`,
    pincode: this.pincode || "",
    latitude: this.latitude ?? null,
    longitude: this.longitude ?? null,
    deliveryRadiusKm: this.deliveryRadiusKm ?? 5,
    geofenceRadius: this.geofenceRadius ?? 500,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    fullTimeMonthlySalary: this.fullTimeMonthlySalary || 0,
    vendorId: this.vendorId || "",
    zoneId: this.zoneId || "",
    zoneName: this.zoneName || "",
  };
};

if (mongoose.models.DeliveryManager) {
  delete mongoose.models.DeliveryManager;
}

const DeliveryManager = mongoose.model(
  "DeliveryManager",
  deliveryManagerSchema
);

export default DeliveryManager;

