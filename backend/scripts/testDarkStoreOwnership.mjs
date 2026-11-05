import assert from 'node:assert/strict';
import { createDarkStoreAdmin, approveDarkStoreRequestAdmin, createHrStaff } from '../admin-ops-service/src/opsControllers.js';
import { createAccount } from '../staff-service/src/controllers/staffController.js';
import { createVendor } from '../farmer-manager-service/src/controllers.js';
import { Vendor, DarkStoreRequest } from '../farmer-manager-service/src/models.js';
import DeliveryManager from '../delivery-service/src/models/DeliveryManager.js';
import { hasActiveMultivendor } from '../delivery-service/src/services/multivendorAccess.js';
import { requireDeliveryManager } from '../delivery-service/src/middleware/requireDeliveryManager.js';
import { register, login } from '../delivery-service/src/controllers/managerAuthController.js';
import { createVendorDarkStoreRequest } from '../farmer-manager-service/src/darkStoreRequestControllers.js';
function response(){return {code:200,body:null,status(code){this.code=code;return this},json(body){this.body=body;return this}}}
const originalExists=Vendor.exists, originalFind=DeliveryManager.findById, originalFindOne=DeliveryManager.findOne, originalCreate=DeliveryManager.create;
const originalRequestFind = DarkStoreRequest.findOne;
let queries=[]; Vendor.exists=async q=>{queries.push(q);return q.id==='valid'&&q.status==='Active'?{_id:'parent'}:null};
try {
 for(const handler of [createDarkStoreAdmin, createVendor]){const res=response();await handler({body:{}},res);assert.equal(res.code,403)}
 for(const role of ['admin','vendor','product_manager']){const res=response();await createAccount({user:{id:'actor',role},body:{role:'delivery_manager'}},res,e=>{throw e});assert.equal(res.code,403)}
 let hrRes=response();await createHrStaff({user:{id:'admin',role:'admin'},body:{role:'delivery_manager',name:'Manager',phone:'9876543210',email:'manager@example.com',password:'secret123'}},hrRes,e=>{throw e});assert.equal(hrRes.code,403);
 DarkStoreRequest.findOne=async()=>({id:'request',status:'Pending',vendorId:'missing'});const approvalRes=response();await approveDarkStoreRequestAdmin({params:{requestId:'request'}},approvalRes,e=>{throw e});assert.equal(approvalRes.code,400);
 assert.equal(await hasActiveMultivendor({vendorId:''}),false);
 assert.equal(await hasActiveMultivendor({vendorId:'missing'}),false);
 assert.equal(await hasActiveMultivendor({vendorId:'valid'}),true);
 DeliveryManager.create=()=>{throw Error('Must not create an account')};
 for(const body of [{},{vendorId:'valid',email:'forged@example.com'}]){let res=response();await register({body},res);assert.equal(res.code,403)}
 for(const manager of [null,{isActive:false,vendorId:'valid'},{isActive:true,vendorId:''},{isActive:true,vendorId:'missing'}]){DeliveryManager.findById=async()=>manager;let res=response(),next=false;await requireDeliveryManager({user:{id:'manager',role:'delivery_manager'}},res,()=>{next=true});assert.equal(res.code,403);assert.equal(next,false)}
 DeliveryManager.findById=async()=>({isActive:true,vendorId:'valid'});let next=false;await requireDeliveryManager({user:{id:'manager',role:'delivery_manager'}},response(),()=>{next=true});assert.equal(next,true);
 let res=response();await createVendorDarkStoreRequest({user:{vendorId:'missing'},body:{}},res);assert.equal(res.code,403);
 DeliveryManager.findOne=()=>({select:async()=>({isActive:true,vendorId:'',comparePassword:async()=>true})});res=response();await login({body:{email:'orphan@example.com',password:'correct'}},res,e=>{throw e});assert.equal(res.code,403);
 console.log('PASS: public signup blocked; active parent required for requests, login, and existing sessions.');
} finally {DarkStoreRequest.findOne=originalRequestFind;Vendor.exists=originalExists;DeliveryManager.findById=originalFind;DeliveryManager.findOne=originalFindOne;DeliveryManager.create=originalCreate}
