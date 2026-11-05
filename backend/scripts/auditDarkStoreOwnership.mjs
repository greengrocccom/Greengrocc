import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
const cfg = dotenv.config({path:fileURLToPath(new URL('../.env', import.meta.url)),quiet:true}).parsed || {};
const uri=cfg.MONGODB_PRODUCTION_URI;
if (!uri) throw new Error('Production database URI is not configured');
const watchdog=setTimeout(()=>{console.error('Production database audit timed out; no writes were performed.');process.exit(2)},25000);
try {
 const conn=await mongoose.createConnection(uri,{dbName:cfg.MONGODB_PRODUCTION_DB_NAME||undefined,autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:10000,connectTimeoutMS:10000,socketTimeoutMS:10000,readPreference:'secondaryPreferred'}).asPromise();
 try {
 const names=(await conn.db.listCollections({}, {nameOnly:true}).toArray()).map(c=>c.name);
 const vendorCollection=names.find(n=>n==='vendors') || names.find(n=>/^fm_?vendors$/i.test(n));
 if (!vendorCollection) throw new Error('Vendor collection not found; refusing to infer ownership');
 const vendors=await conn.db.collection(vendorCollection).find({}, {projection:{id:1,status:1,vendorName:1,ownerName:1,createdAt:1}}).maxTimeMS(10000).toArray();
 const managers=await conn.db.collection('deliverymanagers').find({}, {projection:{storeName:1,vendorId:1,isActive:1,createdAt:1}}).maxTimeMS(10000).toArray();
 const byId=new Map(vendors.map(v=>[v.id,v]));
 const issues=managers.flatMap(m=>{const v=byId.get(m.vendorId);const reason=!m.vendorId?'missing multivendor':!v?'multivendor does not exist':v.status!=='Active'?'multivendor is not active':null;return reason?[{id:String(m._id),storeName:m.storeName,vendorId:m.vendorId||'',isActive:m.isActive,createdAt:m.createdAt,reason}]:[]});
 console.log(JSON.stringify({database:conn.name,readOnly:true,checkedAt:new Date(),vendorCollection,vendorCount:vendors.length,activeVendorCount:vendors.filter(v=>v.status==='Active').length,managerCount:managers.length,issues},null,2));
 } finally {await conn.close()}
} catch(e){console.error('Production audit failed: '+(e.code||e.name)+'. No database writes were performed.');process.exitCode=1} finally {clearTimeout(watchdog)}
