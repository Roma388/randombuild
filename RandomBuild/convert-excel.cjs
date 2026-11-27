const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const EXCEL_FILE = path.join(ROOT, "Hunt.xlsx");
const DATA_DIR = path.join(ROOT, "src", "data");

if (!fs.existsSync(EXCEL_FILE)) {
    console.error("Ошибка: файл Hunt.xlsx не найден.");
    process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Используем ТОЛЬКО первый лист Excel
const workbook = XLSX.readFile(EXCEL_FILE);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: ""
});

console.log(`Используется лист: "${sheetName}"`);
console.log(`Строк прочитано: ${rows.length}`);

// --------------------------------------------------
// ОРУЖИЕ
// --------------------------------------------------

const weapons = [];

for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const type = String(row[0] || "").trim();
    const name = String(row[1] || "").trim();
    const cells = Number(row[2]) || 0;

    if (!name) {
        continue;
    }

    weapons.push({
        name,
        type,
        cells
    });
}

// --------------------------------------------------
// ОРУЖИЕ БЛИЖНЕГО БОЯ
// --------------------------------------------------

const meleeWeapons = [];

for (let i = 1; i < rows.length; i++) {
    const value = String(rows[i][4] || "").trim();

    if (value && !meleeWeapons.includes(value)) {
        meleeWeapons.push(value);
    }
}

// --------------------------------------------------
// АПТЕЧКИ
// --------------------------------------------------

const medkits = [];

for (let i = 1; i < rows.length; i++) {
    const value = String(rows[i][5] || "").trim();

    if (value && !medkits.includes(value)) {
        medkits.push(value);
    }
}

// --------------------------------------------------
// ШПРИЦЫ
// --------------------------------------------------

const syringes = [];

for (let i = 1; i < rows.length; i++) {
    const value = String(rows[i][6] || "").trim();

    if (value && !syringes.includes(value)) {
        syringes.push(value);
    }
}

// --------------------------------------------------
// РАСХОДНИКИ
// --------------------------------------------------

const consumables = [];

for (let i = 1; i < rows.length; i++) {
    const value = String(rows[i][7] || "").trim();

    if (value && !consumables.includes(value)) {
        consumables.push(value);
    }
}

// --------------------------------------------------
// ПЕРКИ
// --------------------------------------------------

const perks = [];

for (let i = 1; i < rows.length; i++) {
    const name = String(rows[i][9] || "").trim();
    const cost = Number(rows[i][10]);

    if (!name || !Number.isFinite(cost)) {
        continue;
    }

    if (!perks.some(perk => perk.name === name)) {
        perks.push({
            name,
            cost
        });
    }
}

// --------------------------------------------------
// СОХРАНЕНИЕ
// --------------------------------------------------

function writeJs(filename, variableName, data) {
    const content =
`// Файл сгенерирован автоматически из Hunt.xlsx
// Используется только первый лист Excel.

export const ${variableName} = ${JSON.stringify(data, null, 4)};
`;

    fs.writeFileSync(
        path.join(DATA_DIR, filename),
        content,
        "utf8"
    );
}

writeJs("weapons.js", "weapons", weapons);
writeJs("meleeWeapons.js", "meleeWeapons", meleeWeapons);
writeJs("medkits.js", "medkits", medkits);
writeJs("syringes.js", "syringes", syringes);
writeJs("consumables.js", "consumables", consumables);
writeJs("perks.js", "perks", perks);

console.log("");
console.log("Готово.");
console.log(`Оружие: ${weapons.length}`);
console.log(`Оружие ближнего боя: ${meleeWeapons.length}`);
console.log(`Аптечки: ${medkits.length}`);
console.log(`Шприцы: ${syringes.length}`);
console.log(`Расходники: ${consumables.length}`);
console.log(`Перки: ${perks.length}`);
console.log("");
console.log("Созданы файлы:");
console.log("src/data/weapons.js");
console.log("src/data/meleeWeapons.js");
console.log("src/data/medkits.js");
console.log("src/data/syringes.js");
console.log("src/data/consumables.js");
console.log("src/data/perks.js");