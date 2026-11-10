class FarmerConstants {
  // Brand & Storage
  static const String appTitle = 'Haritsetu';
  static const String storageKey = 'greengrocc_farmer_auth';

  // Gender & Languages
  static const List<String> genderOptions = ['Male', 'Female', 'Other'];
  static const List<String> preferredLanguages = ['मराठी (Marathi)', 'हिंदी (Hindi)', 'English'];

  // Farm attributes
  static const List<String> areaUnits = ['Acre', 'Hectare'];
  static const List<String> soilTypes = ['Black Soil (काळी माती)', 'Red Soil (तांबडी माती)', 'Sandy (रेताड)', 'Loamy (गाळाची)', 'Laterite (जांभा)', 'Other'];
  static const List<String> irrigationTypes = ['Drip (ठिबक)', 'Sprinkler (तुषार)', 'Flood (पाटपाणी)', 'Rainfed (पावसावर)', 'Canal (कालवा)'];
  static const List<String> waterSources = ['Borewell (बोअरवेल)', 'Well (विहीर)', 'Canal (कालवा)', 'River (नदी)', 'Pond (तळे)', 'Rainwater (शेततळे)'];
  static const List<String> farmingMethods = ['Conventional (पारंपारिक)', 'Mixed (मिश्र)', 'Natural (नैसर्गिक)'];
  static const List<String> farmingTypes = ['Organic (सेंद्रिय)', 'Conventional (रासायनिक)'];

  // Crops
  static const List<String> cropOptions = [
    'Tomato (टोमॅटो)',
    'Onion (कांदा)',
    'Potato (बटाटा)',
    'Capsicum (ढोबळी मिरची)',
    'Brinjal (वांगी)',
    'Cabbage (कोबी)',
    'Cauliflower (फ्लॉवर)',
    'Okra (भेंडी)',
    'Chilli (मिरची)',
    'Cotton (कापूस)',
    'Soybean (सोयाबीन)',
    'Wheat (गहू)',
    'Rice (भात)',
    'Sugarcane (ऊस)',
    'Grapes (द्राक्षे)',
    'Pomegranate (डाळिंब)',
    'Banana (केळी)',
    'Maize (मका)',
    'Groundnut (भुईमूग)',
    'Turmeric (हळद)',
    'Other (इतर)',
  ];

  static const Map<String, List<String>> cropVarieties = {
    'Tomato (टोमॅटो)': ['Abhinav', 'Bajeerao', 'Sahoo', 'Namdhari', 'Heemsohna', 'Hybrid', 'Local'],
    'Onion (कांदा)': ['Nashik Red', 'Agrifound Light Red', 'Pusa Red', 'Hybrid', 'Local'],
    'Potato (बटाटा)': ['Kufri Jyoti', 'Kufri Pukhraj', 'Kufri Chandramukhi', 'Hybrid', 'Local'],
    'Capsicum (ढोबळी मिरची)': ['California Wonder', 'Indra', 'Hybrid', 'Local'],
    'Brinjal (वांगी)': ['Pusa Purple Long', 'Manjari Gota', 'Hybrid', 'Local'],
    'Cabbage (कोबी)': ['Golden Acre', 'Hybrid', 'Local'],
    'Cauliflower (फ्लॉवर)': ['Pusa Snowball', 'Hybrid', 'Local'],
    'Okra (भेंडी)': ['Parbhani Kranti', 'Radhika', 'Hybrid', 'Local'],
    'Chilli (मिरची)': ['Guntur', 'Byadgi', 'Teja', 'Hybrid', 'Local'],
    'Cotton (कापूस)': ['Bt Hybrid', 'Desi', 'Local'],
    'Soybean (सोयाबीन)': ['JS 335', 'JS 9305', 'MAUS 71', 'Local'],
    'Wheat (गहू)': ['Lokwan', 'HD 2967', 'Sharbati', 'Local'],
    'Rice (भात)': ['Indrayani', 'Kolam', 'Basmati', 'Wada Kolam'],
    'Sugarcane (ऊस)': ['Co 86032', 'Co 0265', 'Local'],
    'Grapes (द्राक्षे)': ['Thompson Seedless', 'Sharad Seedless', 'Tas-A-Ganesh'],
    'Pomegranate (डाळिंब)': ['Bhagwa', 'Ganesh', 'Arakta'],
    'Banana (केळी)': ['Grand Naine (G9)', 'Robusta', 'Basrai'],
    'Maize (मका)': ['Hybrid Cargill', 'Pioneer', 'Local'],
    'Groundnut (भुईमूग)': ['TAG 24', 'JL 24', 'Local'],
    'Turmeric (हळद)': ['Salem', 'Rajapore', 'Prabha', 'Local'],
  };

  static List<String> getVarietiesForCrop(String cropName) {
    if (cropVarieties.containsKey(cropName)) {
      return [...cropVarieties[cropName]!, 'Other'];
    }
    return ['Hybrid', 'Local', 'Desi', 'Improved', 'Other'];
  }

  // 22 Crop Planning Stages
  static const List<String> cropStatuses = [
    'Planning Created',
    'Land Preparation',
    'Soil Testing',
    'Land Preparation Completed',
    'Seed Selection',
    'Seed Treatment',
    'Sowing / Plantation',
    'Germination Started',
    'First Fertilizer Application',
    'Irrigation',
    'Crop Growth',
    'Spray / Pest Control',
    'Weeding / Intercultivation',
    'Second Fertilizer Application',
    'Spray / Disease Control',
    'Second Irrigation',
    'Crop Monitoring',
    'Nutrient / Micronutrient Spray',
    'Flowering / Fruiting',
    'Final Fertilizer / Required Treatment',
    'Pre-Harvest Stage',
    'Ready for Harvest',
  ];

  static const List<Map<String, dynamic>> cropPlanning22Stages = [
    {
      'stage': 1,
      'name': 'Planning Created',
      'marathi': 'नियोजन तयार केले',
      'display': 'Planning Date',
      'icon': '📝',
      'fields': ['planningDate'],
      'canRepeat': false,
    },
    {
      'stage': 2,
      'name': 'Land Preparation',
      'marathi': 'मशागत / जमीन तयार करणे',
      'display': 'Date + काम',
      'icon': '🚜',
      'fields': ['date', 'activity'],
      'canRepeat': false,
    },
    {
      'stage': 3,
      'name': 'Soil Testing',
      'marathi': 'माती परीक्षण',
      'display': 'Date + Soil Report',
      'icon': '🧪',
      'fields': ['date', 'soilReport'],
      'canRepeat': false,
    },
    {
      'stage': 4,
      'name': 'Land Preparation Completed',
      'marathi': 'मशागत पूर्ण',
      'display': 'Date',
      'icon': '✅',
      'fields': ['date'],
      'canRepeat': false,
    },
    {
      'stage': 5,
      'name': 'Seed Selection',
      'marathi': 'बियाणे निवड',
      'display': 'Seed Name + Date',
      'icon': '🌱',
      'fields': ['seedName', 'date'],
      'canRepeat': false,
    },
    {
      'stage': 6,
      'name': 'Seed Treatment',
      'marathi': 'बीजप्रक्रिया',
      'display': 'Treatment + Date',
      'icon': '💊',
      'fields': ['treatment', 'date'],
      'canRepeat': false,
    },
    {
      'stage': 7,
      'name': 'Sowing / Plantation',
      'marathi': 'पेरणी / लागवड',
      'display': 'Date + Seed/Variety',
      'icon': '🌾',
      'fields': ['date', 'variety'],
      'canRepeat': false,
    },
    {
      'stage': 8,
      'name': 'Germination Started',
      'marathi': 'उगवण सुरू',
      'display': 'Date',
      'icon': '🌱',
      'fields': ['date'],
      'canRepeat': false,
    },
    {
      'stage': 9,
      'name': 'First Fertilizer Application',
      'marathi': 'पहिली खत मात्रा',
      'display': 'Fertilizer Name + Quantity + Date',
      'icon': '🧪',
      'fields': ['fertilizerName', 'quantity', 'date'],
      'canRepeat': false,
    },
    {
      'stage': 10,
      'name': 'Irrigation',
      'marathi': 'पाणी व्यवस्थापन १',
      'display': 'Irrigation Date + Type',
      'icon': '💧',
      'fields': ['date', 'irrigationType'],
      'canRepeat': false,
    },
    {
      'stage': 11,
      'name': 'Crop Growth',
      'marathi': 'पीक वाढ',
      'display': 'Date + Growth Observation',
      'icon': '🌿',
      'fields': ['date', 'observation'],
      'canRepeat': false,
    },
    {
      'stage': 12,
      'name': 'Spray / Pest Control',
      'marathi': 'कीड नियंत्रण फवारणी 🔄',
      'display': 'Spray Name + Date + Dose + Repeat Spray',
      'icon': '🔄',
      'fields': ['sprayName', 'date', 'dose', 'repeatCount'],
      'canRepeat': true,
    },
    {
      'stage': 13,
      'name': 'Weeding / Intercultivation',
      'marathi': 'तणनियंत्रण / खुरपणी / कोळपणी',
      'display': 'Date',
      'icon': '🌿',
      'fields': ['date'],
      'canRepeat': false,
    },
    {
      'stage': 14,
      'name': 'Second Fertilizer Application',
      'marathi': 'दुसरी खत मात्रा',
      'display': 'Fertilizer Name + Quantity + Date',
      'icon': '🧪',
      'fields': ['fertilizerName', 'quantity', 'date'],
      'canRepeat': false,
    },
    {
      'stage': 15,
      'name': 'Spray / Disease Control',
      'marathi': 'रोग नियंत्रण फवारणी 🔄',
      'display': 'Medicine/Fungicide + Date + Dose + Repeat Spray',
      'icon': '🔄',
      'fields': ['sprayName', 'date', 'dose', 'repeatCount'],
      'canRepeat': true,
    },
    {
      'stage': 16,
      'name': 'Second Irrigation',
      'marathi': 'पाणी व्यवस्थापन २',
      'display': 'Date + Type',
      'icon': '💧',
      'fields': ['date', 'irrigationType'],
      'canRepeat': false,
    },
    {
      'stage': 17,
      'name': 'Crop Monitoring',
      'marathi': 'पीक पाहणी',
      'display': 'Height/Growth + Observation',
      'icon': '🔍',
      'fields': ['height', 'observation', 'date'],
      'canRepeat': false,
    },
    {
      'stage': 18,
      'name': 'Nutrient / Micronutrient Spray',
      'marathi': 'सूक्ष्म अन्नद्रव्य फवारणी 🔄',
      'display': 'Product + Date + Dose + Repeat Spray',
      'icon': '🔄',
      'fields': ['sprayName', 'date', 'dose', 'repeatCount'],
      'canRepeat': true,
    },
    {
      'stage': 19,
      'name': 'Flowering / Fruiting',
      'marathi': 'फुलोरा / फळधारणा',
      'display': 'Date + Observation',
      'icon': '🌸',
      'fields': ['date', 'observation'],
      'canRepeat': false,
    },
    {
      'stage': 20,
      'name': 'Final Fertilizer / Required Treatment',
      'marathi': 'शेवटची खत मात्रा / आवश्यक उपचार',
      'display': 'Product + Date',
      'icon': '🧪',
      'fields': ['product', 'date'],
      'canRepeat': false,
    },
    {
      'stage': 21,
      'name': 'Pre-Harvest Stage',
      'marathi': 'कापणीपूर्व टप्पा',
      'display': 'Date + Expected Harvest Date',
      'icon': '🌾',
      'fields': ['date', 'expectedHarvestDate'],
      'canRepeat': false,
    },
    {
      'stage': 22,
      'name': 'Ready for Harvest',
      'marathi': 'काढणीस तयार ✅',
      'display': 'Harvest Date + Expected Quantity',
      'icon': '✅',
      'fields': ['harvestDate', 'expectedQuantity'],
      'canRepeat': false,
    },
  ];

  // Document types matching user requirements
  static const List<Map<String, dynamic>> documentTypes = [
    {'id': 'aadhaar', 'name': 'Aadhaar Card', 'marathi': 'आधार कार्ड', 'icon': 'badge', 'required': true},
    {'id': 'farmer_id', 'name': 'Farmer ID', 'marathi': 'शेतकरी ओळखपत्र', 'icon': 'card_membership', 'required': true},
    {'id': 'land_712', 'name': '7/12 Extract', 'marathi': '७/१२ उतारा', 'icon': 'assignment', 'required': true},
    {'id': 'land_8a', 'name': '8A Extract', 'marathi': '८-अ उतारा', 'icon': 'description', 'required': true},
    {'id': 'bank', 'name': 'Bank Passbook', 'marathi': 'बँक पासबुक', 'icon': 'account_balance', 'required': true},
    {'id': 'farmer_photo', 'name': 'Farmer Photo', 'marathi': 'शेतकरी फोटो', 'icon': 'face', 'required': true},
    {'id': 'address_proof', 'name': 'Address Proof', 'marathi': 'रहिवासी दाखला', 'icon': 'home', 'required': true},
    {'id': 'pan', 'name': 'PAN Card', 'marathi': 'पॅन कार्ड', 'icon': 'credit_card', 'required': true},
  ];

  // Certificate Types for Crop Planning
  static const List<Map<String, String>> certificateTypes = [
    {'type': 'Soil Testing Report', 'label': 'Soil Testing Report (मृदा परीक्षण अहवाल)', 'icon': '🧪'},
    {'type': 'Organic Farming Certificate', 'label': 'Organic Farming Certificate (सेंद्रिय शेती प्रमाणपत्र)', 'icon': '🌿'},
    {'type': '7/12 & 8-A Extract', 'label': '7/12 & 8-A Extract (७/१२ व ८-अ उतारा)', 'icon': '📜'},
    {'type': 'Crop Insurance Certificate', 'label': 'Crop Insurance Certificate (पीक विमा पावती)', 'icon': '🛡️'},
    {'type': 'Water Testing Report', 'label': 'Water Testing Report (पाणी चाचणी अहवाल)', 'icon': '💧'},
    {'type': 'GAP / APEDA Quality Certificate', 'label': 'GAP / APEDA Quality Certificate (जीएपी / गुणवत्ता)', 'icon': '🏅'},
    {'type': 'Pesticide Residue Free Certificate', 'label': 'Pesticide Residue Free (कीटकनाशक अवशेषमुक्त अहवाल)', 'icon': '🌱'},
    {'type': 'Pre-Harvest Inspection Report', 'label': 'Pre-Harvest Inspection Report (कापणीपूर्व तपासणी अहवाल)', 'icon': '📋'},
  ];

  // Order status filters
  static const List<String> orderTabs = [
    'New Orders',
    'Preparing',
    'Ready for Pickup',
    'Completed',
    'Rejected',
  ];

  // Product units & grades
  static const List<String> productUnits = ['Kg', 'Quintal', 'Ton', 'Piece', 'Box', 'Crate'];
  static const List<String> productGrades = ['Grade A', 'Grade B', 'Grade C'];
  static const List<String> productStatuses = ['Active', 'Pending Approval', 'Draft', 'Low Stock', 'Out of Stock'];
}
