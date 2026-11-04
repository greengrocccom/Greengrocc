const { MongoClient } = require('mongodb');
require('dotenv').config({ path: './backend/.env' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  
  const inGreenGrocc = await db.collection('GreenGroccproducts').findOne({ sku: 'GR-TOM-001' });
  console.log('GR-TOM-001 in GreenGroccproducts:', inGreenGrocc ? inGreenGrocc.name : 'Not found');
  
  const inProducts = await db.collection('products').findOne({ sku: 'GR-TOM-001' });
  console.log('GR-TOM-001 in products:', inProducts ? inProducts.name : 'Not found');
  
  // Find any product with /categories/ across both
  const anyLocal1 = await db.collection('GreenGroccproducts').find({ productImages: { $regex: 'categories' } }).toArray();
  console.log('GreenGroccproducts matching categories:', anyLocal1.length);
  
  const anyLocal2 = await db.collection('products').find({ productImages: { $regex: 'categories' } }).toArray();
  console.log('products matching categories:', anyLocal2.length);

  // Let's check categories collection as well
  const cat1 = await db.collection('greengrocccategories').find({ categoryImage: { $regex: 'categories' } }).toArray();
  console.log('greengrocccategories matching categories:', cat1.length);
  
  const cat2 = await db.collection('categories').find({ categoryImage: { $regex: 'categories' } }).toArray();
  console.log('categories matching categories:', cat2.length);

  // Let's check total counts of both collections
  console.log('Total in GreenGroccproducts:', await db.collection('GreenGroccproducts').countDocuments());
  console.log('Total in products:', await db.collection('products').countDocuments());
  console.log('Total in greengrocccategories:', await db.collection('greengrocccategories').countDocuments());
  if (await db.listCollections({ name: 'categories' }).hasNext()) {
    console.log('Total in categories:', await db.collection('categories').countDocuments());
  }

  await client.close();
}
check().catch(console.error);

