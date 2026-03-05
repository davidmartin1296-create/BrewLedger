export const barStockList = [
  {
    category: "Whites & Sparkling",
    items: [
      "Miles Prosecco",
      "Sea Change Rose",
      "Sea Change AF",
      "Chandon Garden",
      "Ni Hci",
      "Whispering Angel",
      "Chivello",
      "Velue Clicquot",
      "Sensi 18K",
      "Gavi",
      "Boundary",
      "MiAo",
      "Vignoble",
      "Lemongrass",
      "Chablis",
      "Los Chantos",
      "Ruttas",
      "Orange",
      "McGuigan S.B."
    ]
  },
  {
    category: "Reds",
    items: [
      "D'Arenberg",
      "Cove",
      "Altavia",
      "Blueboy",
      "McGuigan C.S.",
      "Vergant",
      "Torren De Paredes",
      "Wildflower",
      "Pablo",
      "Port",
      "Sherry"
    ]
  },
  {
    category: "Beer / Bottles",
    items: [
      "Pilot Peach",
      "Leith Lager",
      "Stones Throw",
      "Stewart's IPA",
      "Vault City",
      "Corona",
      "Norklko",
      "Paulaner",
      "Staro",
      "Fire Island",
      "Bello",
      "T.C. Streku",
      "T.C. Elder",
      "Augustiner",
      "Flensburger",
      "Cordon Coro",
      "Old Mout",
      "Guinness",
      "Ghost Ship Blue",
      "Ghost Ship Red"
    ]
  },
  {
    category: "Soft Drinks",
    items: [
      "Pepsi",
      "Pepsi Max",
      "Irn Bru",
      "Diet Irn Bru",
      "Red Bull",
      "Raspberry Lemonade",
      "Stylish Elderflower",
      "S.P Lemon",
      "S.P Orange",
      "Sparkling Water",
      "Still Water",
      "I&G Original"
    ]
  },
  {
    category: "Tonics / Mixers",
    items: [
      "Tonic",
      "Tonic Lite",
      "Elderflower Tonic",
      "Mediterranean Tonic",
      "Ginger Ale",
      "Ginger Beer"
    ]
  },
  {
    category: "Juices",
    items: [
      "Pineapple",
      "Orange",
      "Apple",
      "Cranberry",
      "Grapefruit"
    ]
  }
];

export function getAllMasterDrinks() {
  return barStockList.flatMap((group) =>
    group.items.map((name) => ({
      name,
      category: group.category
    }))
  );
}
