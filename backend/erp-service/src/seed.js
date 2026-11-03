import { ErpCounter } from "./models/index.js";
import {
  Company,
  State,
  District,
  Taluka,
  Village,
  CollectionCentreMaster,
  Warehouse,
  ColdStorage,
  DarkStoreMaster,
  ApiRegistry,
} from "./models/index.js";

const LOCATIONS = {
  state: { code: "MH", name: "Maharashtra" },
  districts: [
    {
      code: "NK",
      name: "Nashik",
      talukas: [
        { code: "SIN", name: "Sinnar", villages: ["Nandur", "Wavi", "Gonde"] },
        { code: "YEL", name: "Yeola", villages: ["Andarsul"] },
        { code: "NIP", name: "Niphad", villages: ["Pimpalgaon"] },
      ],
    },
    {
      code: "PN",
      name: "Pune",
      talukas: [{ code: "HAV", name: "Haveli", villages: ["Wagholi"] }],
    },
    {
      code: "ND",
      name: "Nanded",
      talukas: [{ code: "NAN", name: "Nanded", villages: ["Vishnupuri"] }],
    },
  ],
};

export async function seedErpMasters() {
  const company = await Company.findOneAndUpdate(
    { companyId: "GGC" },
    {
      companyId: "GGC",
      companyName: "GreenGrocc",
      legalName: "GreenGrocc",
      email: "ceo@greengrocc.com",
      city: "Nashik",
      state: "Maharashtra",
      status: "ACTIVE",
    },
    { upsert: true, returnDocument: 'after' }
  );

  const stateId = `ST-${LOCATIONS.state.code}`;
  await State.findOneAndUpdate(
    { stateId },
    {
      stateId,
      stateCode: LOCATIONS.state.code,
      stateName: LOCATIONS.state.name,
      countryId: "IN",
      status: "ACTIVE",
    },
    { upsert: true }
  );

  for (const district of LOCATIONS.districts) {
    const districtId = `DST-${district.code}`;
    await District.findOneAndUpdate(
      { districtId },
      {
        districtId,
        stateId,
        districtCode: district.code,
        districtName: district.name,
        status: "ACTIVE",
      },
      { upsert: true }
    );
    for (const taluka of district.talukas) {
      const talukaId = `TLK-${taluka.code}`;
      await Taluka.findOneAndUpdate(
        { talukaId },
        {
          talukaId,
          stateId,
          districtId,
          talukaCode: taluka.code,
          talukaName: taluka.name,
          status: "ACTIVE",
        },
        { upsert: true }
      );
      let serial = 1;
      for (const villageName of taluka.villages) {
        const villageId = `VIL-${taluka.code}-${String(serial).padStart(4, "0")}`;
        await Village.findOneAndUpdate(
          { villageId },
          {
            villageId,
            stateId,
            districtId,
            talukaId,
            villageCode: taluka.code,
            villageName,
            status: "ACTIVE",
          },
          { upsert: true }
        );
        serial += 1;
      }
      await ErpCounter.findOneAndUpdate(
        { key: `village-${taluka.code}` },
        { $max: { sequence: serial - 1 } },
        { upsert: true }
      );
    }
  }

  await CollectionCentreMaster.findOneAndUpdate(
    { collectionCentreId: "GGC-CC-MH-NK-TLK-VIL-001" },
    {
      collectionCentreId: "GGC-CC-MH-NK-TLK-VIL-001",
      name: "Nashik Collection Centre 001",
      districtId: "DST-NK",
      talukaId: "TLK-SIN",
      address: "Sinnar, Nashik",
      status: "ACTIVE",
    },
    { upsert: true }
  );

  await Warehouse.findOneAndUpdate(
    { warehouseId: "GGC-WH-MUM-00001" },
    {
      warehouseId: "GGC-WH-MUM-00001",
      name: "Mumbai Warehouse 1",
      city: "MUM",
      capacity: 100000,
      availableCapacity: 100000,
      status: "ACTIVE",
    },
    { upsert: true }
  );

  await ColdStorage.findOneAndUpdate(
    { coldStorageId: "GGC-CS-MUM-001" },
    {
      coldStorageId: "GGC-CS-MUM-001",
      name: "Mumbai Cold Storage 1",
      city: "MUM",
      capacity: 25000,
      occupiedCapacity: 0,
      temperature: 4,
      humidity: 85,
      alertStatus: "NORMAL",
      status: "ACTIVE",
    },
    { upsert: true }
  );

  await DarkStoreMaster.findOneAndUpdate(
    { darkStoreId: "GGC-DS-MUM-001" },
    {
      darkStoreId: "GGC-DS-MUM-001",
      name: "Mumbai Dark Store 1",
      city: "MUM",
      capacity: 15000,
      deliveryArea: "Mumbai Suburban",
      status: "ACTIVE",
    },
    { upsert: true }
  );

  await ApiRegistry.findOneAndUpdate(
    { apiId: "GGC-API-ERP-V1-000001" },
    {
      apiId: "GGC-API-ERP-V1-000001",
      apiName: "GreenGrocc ERP API",
      vendor: "GreenGrocc",
      system: "ERP",
      version: "V1",
      endpoint: "/api/erp",
      status: "ACTIVE",
    },
    { upsert: true }
  );

  return { companyId: company.companyId };
}
