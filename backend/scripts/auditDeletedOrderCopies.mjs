// Read-only production audit of store copies whose customer order was deleted.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
const cfg=dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true}).parsed||{};
if(!cfg.MONGODB_PRODUCTION_URI)throw Error('Production URI unavailable');
const conn=await mongoose.createConnection(cfg.MONGODB_PRODUCTION_URI,{dbName:cfg.MONGODB_PRODUCTION_DB_NAME||undefined,autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:10000,socketTimeoutMS:10000}).asPromise();
try{
const [orders,storeCopies,orphans]=await Promise.all([
 conn.db.collection('orders').countDocuments({}),
 conn.db.collection('storeorders').countDocuments({}),
 conn.db.collection('storeorders').aggregate([
 {$match:{sourceOrderId:{$exists:true,$ne:null}}},
 {$lookup:{from:'orders',localField:'sourceOrderId',foreignField:'_id',as:'source'}},
 {$match:{source:{$size:0}}},
 {$project:{_id:1,orderNumber:1,status:1,managerId:1,sourceOrderId:1}},
 ]).toArray()
]);
console.log(JSON.stringify({database:conn.name,readOnly:true,customerOrderCount:orders,storeOrderCount:storeCopies,orphanCount:orphans.length,orphans},null,2));
}finally{await conn.close()}
