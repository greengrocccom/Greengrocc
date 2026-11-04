import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

// Define Category Schema
const categorySchema = new mongoose.Schema(
  {
    categoryName: { type: String, required: true },
    slug: { type: String, required: true },
    section: { type: String, default: 'greengrocc', lowercase: true },
    sectionName: { type: String, default: 'GreenGrocc' },
    categoryImage: { type: String },
    itemCount: { type: String, default: '50+ items' },
    emoji: { type: String, default: '🛒' },
    bg: { type: String, default: '#E8F5E9' },
    subcategories: [{ type: String }],
    storeType: { type: String, default: 'main' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Category = mongoose.model('Category', categorySchema);

const REAL_IMAGES_MAP = {
  // GreenGrocc core categories
  'vegetables': {
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#EAF7EE',
    itemCount: '120+ items',
    subcategories: ['Leafy Greens', 'Root Veggies', 'Exotics', 'Organic Veggies']
  },
  'fruits': {
    image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FDF2F0',
    itemCount: '95+ items',
    subcategories: ['Fresh Apples', 'Citrus & Berries', 'Tropical Fruits', 'Seasonal Special']
  },
  'dairy': {
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#F0F9FF',
    itemCount: '80+ items',
    subcategories: ['Fresh Milk', 'Paneer & Tofu', 'Butter & Cheese', 'Curd & Yogurt']
  },
  'bakery': {
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FDF6ED',
    itemCount: '65+ items',
    subcategories: ['Artisan Breads', 'Buns & Pav', 'Cookies & Rusk', 'Cakes & Muffins']
  },
  'beverages': {
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#EFF6FF',
    itemCount: '85+ items',
    subcategories: ['Cold Pressed Juices', 'Energy Drinks', 'Soft Drinks', 'Syrups & Mixers']
  },
  'dry fruits': {
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FAF4EB',
    itemCount: '70+ items',
    subcategories: ['California Almonds', 'Cashews & Pista', 'Walnuts & Figs', 'Mixed Seeds']
  },
  'organic': {
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#F0FDF4',
    itemCount: '50+ items',
    subcategories: ['Raw Forest Honey', 'Cold Pressed Oils', 'Organic Millets', 'Herbal Extracts']
  },
  'grains': {
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FDF8EC',
    itemCount: '75+ items',
    subcategories: ['Basmati Rice', 'Whole Wheat Atta', 'Millets & Ragi', 'Oats & Quinoa']
  },
  'pulses': {
    image: 'https://images.unsplash.com/photo-1585994192730-9886b1e5d5d7?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FEF9F0',
    itemCount: '60+ items',
    subcategories: ['Toor & Moong Dal', 'Chana & Rajma', 'Urad & Masoor', 'Organic Dals']
  },
  'grocery': {
    image: 'https://images.unsplash.com/photo-1584473457406-6240486418e9?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#F3F4F6',
    itemCount: '150+ items',
    subcategories: ['Salt & Sugar', 'Pooja Essentials', 'Cleaning & Household', 'Daily Staples']
  },
  'oils': {
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FEFCE8',
    itemCount: '45+ items',
    subcategories: ['Cold Pressed Mustard Oil', 'Pure Desi Ghee', 'Sunflower & Groundnut', 'Olive Oil']
  },
  'spices': {
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FFF7ED',
    itemCount: '90+ items',
    subcategories: ['Whole Garam Masala', 'Chilli & Turmeric', 'Cumin & Coriander', 'Special Blends']
  },

  // Ready2Cook Categories
  'chopped': {
    image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cf?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#F0FDF4',
    itemCount: '35+ items',
    subcategories: ['Chopped Onions', 'Diced Tomatoes', 'Mix Veg Curry Pack', 'Salad Cuts']
  },
  'cut & sliced': {
    image: 'https://images.unsplash.com/photo-1598170845058-12ef4a457c39?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FFF7ED',
    itemCount: '30+ items',
    subcategories: ['Sliced Carrots', 'Julienned Bell Peppers', 'Cut Pumpkin', 'Sliced Cucumbers']
  },
  'peeled & cleaned': {
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#F8FAFC',
    itemCount: '25+ items',
    subcategories: ['Peeled Garlic Pods', 'Peeled Sambar Onions', 'Scraped Ginger', 'Peeled Potatoes']
  },
  'cleaned bhaji': {
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#ECFDF5',
    itemCount: '20+ items',
    subcategories: ['Cleaned Palak', 'Cleaned Methi Leaves', 'Washed Coriander', 'Cleaned Shepu']
  },
  'veggie mix': {
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FDF4FF',
    itemCount: '25+ items',
    subcategories: ['Sambhar Veggie Kit', 'Pav Bhaji Cut Mix', 'Fried Rice Veggie Mix', 'Soup Veggie Pack']
  },

  // SuperMall Categories
  'packaged grocery': {
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#EFF6FF',
    itemCount: '500+ items',
    subcategories: ['Branded Atta & Rice', 'Premium Spices', 'Cooking Sauces', 'Instant Noodles']
  },
  'mall grains': {
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FEF9C3',
    itemCount: '120+ items',
    subcategories: ['Bulk Grain Bags', 'Organic Millets', 'Dietary Flours', 'Export Rice']
  },
  'snacks & munchies': {
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#FFF1F2',
    itemCount: '200+ items',
    subcategories: ['Potato Chips & Crisps', 'Indian Namkeen', 'Biscuits & Cookies', 'Chocolates & Candies']
  },
  'mall beverages': {
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&h=600&q=85',
    bg: '#F0FDF4',
    itemCount: '180+ items',
    subcategories: ['Cold Drinks & Soda', 'Fruit Juices Pack', 'Energy Drinks', 'Flavored Milk']
  }
};

async function run() {
  if (!MONGODB_URI) throw new Error('Set MONGODB_URI before running the seed script.');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const categories = await Category.find({});
  console.log(`Found ${categories.length} categories to update.`);

  let updatedCount = 0;
  for (const cat of categories) {
    const nameKey = cat.categoryName.toLowerCase();
    const slugKey = cat.slug.toLowerCase();

    // Find match
    let match = null;
    for (const [key, data] of Object.entries(REAL_IMAGES_MAP)) {
      if (nameKey.includes(key) || slugKey.includes(key) || key.includes(nameKey) || key.includes(slugKey)) {
        match = data;
        break;
      }
    }

    if (match) {
      cat.categoryImage = match.image;
      cat.bg = match.bg;
      cat.itemCount = match.itemCount || cat.itemCount;
      if (match.subcategories && (!cat.subcategories || cat.subcategories.length === 0)) {
        cat.subcategories = match.subcategories;
      }
      await cat.save();
      console.log(`Updated [${cat.section}] "${cat.categoryName}" -> ${cat.categoryImage}`);
      updatedCount++;
    } else {
      console.log(`No match for: "${cat.categoryName}" (${cat.slug})`);
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} categories with real images!`);
  await mongoose.disconnect();
}

run().catch(console.error);
