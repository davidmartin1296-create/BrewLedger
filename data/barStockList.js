export const barStockList = [
  {
    category: "Whites & Sparkling",
    items: [
      "Haus Prosecco",
      "Sea Change Rosé",
      "Sea Change AF",
      "Chandon Garden",
      "Di Vici",
      "Whispering Angel",
      "Campillo",
      "Veuve Clicquot",
      "Sensi 18K",
      "Grillo",
      "Boundary",
      "MiAo",
      "Vignoble",
      "Lemongrass",
      "Chablis",
      "Los Gansos",
      "Routas",
      "Ōrange",
      "McGuigan S.B."
    ]
  },
  {
    category: "Reds",
    items: [
      "D’Avola",
      "Cove",
      "Ataliva",
      "Blueboy",
      "McGuigan C.S.",
      "Versant",
      "Torreón De Paredes",
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
      "Stewart’s IPA",
      "Vault City Irn Bru",
      "Corona Cero",
      "Budvar Nealko",
      "Paulaner 0.0",
      "Staropramen 0.0",
      "Fire Island",
      "Brulo",
      "Thistly Cross Strawberry",
      "Thistly Cross Elderflower",
      "Augustiner",
      "Flensburger",
      "Old Mout NA",
      "Guinness 0.0",
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
      "English Elderflower",
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
