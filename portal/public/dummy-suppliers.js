export const dummySuppliers=[
 {id:'dummy-knit',name:'Willow Knit Studio',departments:['Knitwear'],country:'Portugal',contact:'Clara M.',leadTime:'12–18 days',moq:24,shipping:'UK / EU',returns:'30 days for unused samples',status:'Sample requested',sample:'In transit',rating:4.7},
 {id:'dummy-tops',name:'Linen Lane Apparel',departments:['Tops'],country:'Turkey',contact:'Elif K.',leadTime:'10–14 days',moq:30,shipping:'UK / EU',returns:'14 days; approval required',status:'Contacted',sample:'Requested',rating:4.5},
 {id:'dummy-bottoms',name:'Form & Thread Works',departments:['Bottoms'],country:'China',contact:'Mei L.',leadTime:'18–25 days',moq:50,shipping:'UK / EU / US',returns:'Faulty items within 30 days',status:'Researching',sample:'Not requested',rating:4.6},
 {id:'dummy-dress',name:'Meadow Dress Collective',departments:['Dresses'],country:'India',contact:'Priya S.',leadTime:'14–21 days',moq:20,shipping:'UK / EU',returns:'Unused samples within 14 days',status:'Sample requested',sample:'Awaiting review',rating:4.8},
 {id:'dummy-outer',name:'Northline Outerwear',departments:['Outerwear'],country:'Vietnam',contact:'Linh T.',leadTime:'21–28 days',moq:40,shipping:'UK / EU / US',returns:'Defects reported within 14 days',status:'Contacted',sample:'Requested',rating:4.4},
 {id:'dummy-bags',name:'Woven Arc Accessories',departments:['Accessories'],country:'Indonesia',contact:'Ayu P.',leadTime:'14–20 days',moq:25,shipping:'UK / EU',returns:'Unused samples within 30 days',status:'Researching',sample:'Not requested',rating:4.6},
 {id:'dummy-shoes',name:'Elm Street Footwear',departments:['Footwear'],country:'Spain',contact:'Lucia R.',leadTime:'10–16 days',moq:18,shipping:'UK / EU',returns:'Unworn pairs within 30 days',status:'Sample requested',sample:'Received',rating:4.7}
];
export const supplierForProduct=p=>dummySuppliers.find(s=>s.departments.includes(p.department));
