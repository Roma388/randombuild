import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import ReactDOM from "react-dom/client";

import { weapons } from "./data/weapons";
import { perks } from "./data/perks";
import { meleeWeapons } from "./data/meleeWeapons";
import { medkits } from "./data/medkits";
import { syringes } from "./data/syringes";
import { consumables } from "./data/consumables";
import {
  translateItemName,
  translateSlotLabel,
} from "./data/translations";

import { filterItemsByRank } from "./data/itemRanks";
import { itemPrices } from "./data/itemPrices";

import "./style.css";

const imageFiles = import.meta.glob(
  "../Images/**/*.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

// PNG-интерфейсные изображения собираются Vite как статические ресурсы.
// Это важно для production: условный new URL(path, import.meta.url)
// не преобразуется сборщиком и даёт битые ссылки после публикации.
const uiPngFiles = import.meta.glob(
  "../Images/ui/*.png",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

function getUiPng(fileName) {
  return uiPngFiles[`../Images/ui/${fileName}`] || "";
}

function getItemImage(name, folder) {
  /*
   * Сначала ищем изображение по исходному имени.
   */
  const target =
    `../Images/${folder}/${name}.webp`;

  if (imageFiles[target]) {
    return imageFiles[target];
  }

  /*
   * Если файла с русским названием нет, ищем английский.
   * translateItemName принимает тип предмета и язык отдельно.
   */
  const translationTypeByFolder = {
    Weapons: "weapon",
    meleeWeapons: "melee",
    medkits: "medkit",
    syringes: "syringe",
    consumables: "consumable",
    Perks: "perk",
  };

  const translationType =
    translationTypeByFolder[folder] || "weapon";

  const englishName =
    translateItemName(
      name,
      translationType,
      "en"
    );

  const translatedTarget =
    `../Images/${folder}/${englishName}.webp`;

  return (
    imageFiles[translatedTarget] ||
    null
  );
}

const SPECIAL_PERKS = new Set([
  "Сторукий",
  "Арбалетчик",
  "Амбидекстер",
  "Быстрые пальцы",
  "Ловкие Пальцы",
  "Мастер",
  "На Мушке",
  "Рычажный Механизм",
  "Точная Стрельба",
  "Интендант",
  "Шквальный Огонь",
]);

/*
 * Правила десяти уровней контракта.
 * Пустые слоты остаются в интерфейсе, но не получают результат и пул предметов.
 */
const CONTRACT_LEVEL_RULES = {
  1: {
    maxPerkPoints: 10,
    maxPerkSlots: 4,
    allowSecondWeapon: true,
    allowMelee: true,
    allowMedkit: true,
    allowSyringes: true,
    consumableSlots: [true, true, true, true],
  },
  2: {
    maxPerkPoints: 8,
    maxPerkSlots: 3,
    allowSecondWeapon: true,
    allowMelee: true,
    allowMedkit: true,
    allowSyringes: true,
    consumableSlots: [true, true, true, true],
  },
  3: {
    maxPerkPoints: 6,
    maxPerkSlots: 2,
    allowSecondWeapon: true,
    allowMelee: true,
    allowMedkit: true,
    allowSyringes: true,
    consumableSlots: [true, true, true, true],
  },
  4: {
    maxPerkPoints: 4,
    maxPerkSlots: 1,
    allowSecondWeapon: true,
    allowMelee: true,
    allowMedkit: true,
    allowSyringes: true,
    consumableSlots: [true, true, true, true],
  },
  5: {
    maxPerkPoints: 0,
    maxPerkSlots: 0,
    allowSecondWeapon: true,
    allowMelee: true,
    allowMedkit: true,
    allowSyringes: true,
    consumableSlots: [true, true, true, true],
  },
  6: {
    maxPerkPoints: 0,
    maxPerkSlots: 0,
    allowSecondWeapon: true,
    allowMelee: true,
    allowMedkit: true,
    allowSyringes: true,
    consumableSlots: [true, true, true, false],
  },
  7: {
    maxPerkPoints: 0,
    maxPerkSlots: 0,
    allowSecondWeapon: true,
    allowMelee: true,
    allowMedkit: true,
    allowSyringes: true,
    consumableSlots: [true, true, false, false],
  },
  8: {
    maxPerkPoints: 0,
    maxPerkSlots: 0,
    allowSecondWeapon: true,
    allowMelee: true,
    allowMedkit: true,
    allowSyringes: false,
    consumableSlots: [false, false, false, false],
  },
  9: {
    maxPerkPoints: 0,
    maxPerkSlots: 0,
    allowSecondWeapon: true,
    allowMelee: true,
    allowMedkit: false,
    allowSyringes: false,
    consumableSlots: [false, false, false, false],
  },
  10: {
    maxPerkPoints: 0,
    maxPerkSlots: 0,
    allowSecondWeapon: false,
    allowMelee: false,
    allowMedkit: false,
    allowSyringes: false,
    consumableSlots: [false, false, false, false],
  },
};

function getContractLevelRules(level) {
  return CONTRACT_LEVEL_RULES[level] || CONTRACT_LEVEL_RULES[1];
}

function randomItem(array) {
  if (
    !array ||
    array.length === 0
  ) {
    return null;
  }

  return array[
    Math.floor(
      Math.random() * array.length
    )
  ];
}

function shuffle(array) {
  return [...array].sort(
    () => Math.random() - 0.5
  );
}

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );
}

function itemName(item) {
  if (!item) {
    return "—";
  }

  return item.name || item;
}

function weaponName(weapon) {
  return itemName(weapon);
}

function weaponCategory(weapon) {
  return weapon?.type || "";
}

function weaponSlots(weapon) {
  return Number(
    weapon?.cells || 0
  );
}

function isPistol(weapon) {
  return weaponCategory(
    weapon
  )
    .toLowerCase()
    .includes("пистолет");
}

function isNitro(weapon) {
  return weaponName(
    weapon
  )
    .toLowerCase()
    .includes(
      "nitro express"
    );
}

function isForbiddenForRapidFire(
  weapon
) {
  const name =
    weaponName(
      weapon
    ).toLowerCase();

  return (
    name.includes(
      "армейский"
    ) ||
    name.includes(
      "dolch 96"
    ) ||
    name.includes(
      "bornheim № 3"
    ) ||
    name.includes(
      "офицерский"
    )
  );
}

function weaponMatchesPerk(
  weapon,
  perkName
) {
  const name =
    weaponName(weapon);

  switch (perkName) {
    case "Сторукий":
      return (
        name ===
        "Охотничий лук"
      );

    case "Арбалетчик":
      return (
        name.includes(
          "Арбалет"
        ) ||
        name.includes(
          "Копье со взрывчаткой"
        ) ||
        name.includes(
          "Бомбомет"
        )
      );

    case "Амбидекстер":
      return isPistol(
        weapon
      );

    case "Быстрые пальцы":
      return (
        name.includes(
          "Scottfield"
        ) ||
        name.includes(
          "Кавалерийская 1890"
        ) ||
        name.includes(
          "Sparks"
        ) ||
        name.includes(
          "Снайперская винтовка Мейнарда"
        ) ||
        name.includes(
          "Martini-Henry"
        )
      );

    case "Ловкие Пальцы":
      return (
        name.includes(
          "Берджес"
        ) ||
        name.includes(
          "Lebel 1886"
        ) ||
        name.includes(
          "Mosin"
        ) ||
        name.includes(
          "Specter 1882"
        ) ||
        name.includes(
          "Терминус"
        ) ||
        name.includes(
          "Bornheim № 3"
        ) ||
        name.includes(
          "Dolch 96"
        )
      );

    case "Мастер":
      return (
        name === "Катана"
      );

    case "На Мушке":
      return [
        "Карабин 1865",
        "Карабин 1865 с глушителем",
        "Berthier 1892",
        "Berthier 1892 «Укол»",
        "Столетие",
        "Столетие «Перелом»",
        "Фронтир 73C",
        "Фронтир 73C с глушителем",
        "Пехотная 73L",
        "Пехотная 73L со штыком",
        "Краг",
        "Краг со штыком",
        "Краг с глушителем",
        "Lebel 1886",
        "Lebel 1886 «Коготь»",
        "Карабин LeMat",
        "Карабин LeMat «Опытный стрелок»",
        "Mako 1895",
        "Mako 1895 «Клык»",
        "Marathon",
        "Marathon «Стриж»",
        "Mosin-Nagant",
        "Mosin-Nagant со штыком",
        "Поединок (Mosin «Обрез»)",
        "Рейнджер 73",
        "Рейнджер 73 «Стриж»",
        "Рейнджер 73 «Коготь»",
        "Vetterli 71",
        "Vetterli 71 со штыком",
        "Vetterli 71 с глушителем",
      ].includes(name);

    case "Рычажный Механизм":
      return (
        name.includes(
          "Столетие"
        ) ||
        name.includes(
          "Фронтир 73C"
        ) ||
        name.includes(
          "Пехотная 73L"
        ) ||
        name.includes(
          "Mako 1895"
        ) ||
        name.includes(
          "Marathon"
        ) ||
        name.includes(
          "Рейнджер 73"
        )
      );

    case "Точная Стрельба":
      return name.includes(
        "Снайпер"
      );

    case "Шквальный Огонь":
      return (
        isPistol(weapon) &&
        !isForbiddenForRapidFire(
          weapon
        )
      );

    default:
      return true;
  }
}

function getFirstWeaponPool(
  selectedPerks,
  availableWeapons = weapons
) {
  let pool = [
    ...availableWeapons,
  ];

  const hasQuartermaster =
    selectedPerks.some(
      (perk) =>
        perk.name ===
        "Интендант"
    );

  if (!hasQuartermaster) {
    pool =
      pool.filter(
        (weapon) =>
          !isNitro(
            weapon
          )
      );
  }

  for (
    const perk of
    selectedPerks
  ) {
    if (
      !SPECIAL_PERKS.has(
        perk.name
      )
    ) {
      continue;
    }

    if (
      perk.name ===
      "Интендант"
    ) {
      continue;
    }

    pool =
      pool.filter(
        (weapon) =>
          weaponMatchesPerk(
            weapon,
            perk.name
          )
      );
  }

  return pool;
}

function getSecondWeaponPool(
  firstWeapon,
  selectedPerks,
  availableWeapons = weapons
) {
  const hasQuartermaster =
    selectedPerks.some(
      (perk) =>
        perk.name ===
        "Интендант"
    );

  const requiredTotalSlots =
    hasQuartermaster
      ? 6
      : 5;

  return availableWeapons.filter(
    (weapon) => {
      if (
        weaponName(
          weapon
        ) ===
        weaponName(
          firstWeapon
        )
      ) {
        return false;
      }

      if (
        weaponCategory(
          weapon
        ) ===
        weaponCategory(
          firstWeapon
        )
      ) {
        return false;
      }

      if (
        isNitro(
          weapon
        ) &&
        !hasQuartermaster
      ) {
        return false;
      }

      return (
        weaponSlots(
          firstWeapon
        ) +
          weaponSlots(
            weapon
          ) ===
        requiredTotalSlots
      );
    }
  );
}

function getAmbidexterSecondWeaponPool(
  pistol,
  selectedPerks,
  availableWeapons = weapons
) {
  const hasQuartermaster =
    selectedPerks.some(
      (perk) =>
        perk.name ===
        "Интендант"
    );

  const requiredTotalSlots =
    hasQuartermaster
      ? 6
      : 5;

  return availableWeapons.filter(
    (weapon) => {
      if (
        weaponName(
          weapon
        ) ===
        weaponName(
          pistol
        )
      ) {
        return false;
      }

      if (
        weaponCategory(
          weapon
        ) ===
        weaponCategory(
          pistol
        )
      ) {
        return false;
      }

      if (
        isNitro(
          weapon
        ) &&
        !hasQuartermaster
      ) {
        return false;
      }

      return (
        weaponSlots(
          pistol
        ) * 2 +
          weaponSlots(
            weapon
          ) ===
        requiredTotalSlots
      );
    }
  );
}

function perksHaveValidFirstWeapon(
  selectedPerks
) {
  return (
    getFirstWeaponPool(
      selectedPerks
    ).length > 0
  );
}

function generatePerks(
  availablePerks = perks,
  maxPoints = 10,
  maxCount = 4
) {
  if (
    maxPoints <= 0 ||
    maxCount <= 0 ||
    !Array.isArray(availablePerks) ||
    availablePerks.length === 0
  ) {
    return [];
  }

  let bestSelection = [];
  let bestSpentPoints = 0;

  /*
   * Ищем случайный набор, который:
   * - не превышает лимит очков;
   * - не превышает разрешённое число слотов;
   * - не содержит повторяющихся перков;
   * - сохраняет прежнее правило: специальные перки
   *   могут занимать только первые две позиции.
   *
   * При равной стоимости предпочитаем набор с большим
   * количеством заполненных слотов.
   */
  for (let attempt = 0; attempt < 300; attempt++) {
    const selection = [];
    let remainingPoints = maxPoints;

    while (selection.length < maxCount && remainingPoints > 0) {
      const selectedNames = new Set(
        selection.map((perk) => perk.name)
      );

      const possiblePerks = availablePerks.filter((perk) => {
        const cost = Number(perk.cost);

        if (
          !Number.isFinite(cost) ||
          cost <= 0 ||
          cost > remainingPoints ||
          selectedNames.has(perk.name)
        ) {
          return false;
        }

        if (
          selection.length >= 2 &&
          SPECIAL_PERKS.has(perk.name)
        ) {
          return false;
        }

        return true;
      });

      if (possiblePerks.length === 0) {
        break;
      }

      const selectedPerk = randomItem(possiblePerks);

      if (!selectedPerk) {
        break;
      }

      selection.push(selectedPerk);
      remainingPoints -= Number(selectedPerk.cost);
    }

    const spentPoints = maxPoints - remainingPoints;

    if (remainingPoints === 0) {
      return selection;
    }

    if (
      spentPoints > bestSpentPoints ||
      (
        spentPoints === bestSpentPoints &&
        selection.length > bestSelection.length
      )
    ) {
      bestSelection = selection;
      bestSpentPoints = spentPoints;
    }
  }

  return bestSelection;
}

function generateWeapons(
  selectedPerks,
  availableWeapons = weapons,
  allowSecondWeapon = true
) {
  const firstWeaponPool =
    getFirstWeaponPool(
      selectedPerks,
      availableWeapons
    );

  /*
   * Если специальные перки требуют
   * несовместимое первое оружие —
   * такой набор перков сразу отбрасывается.
   */
  if (
    firstWeaponPool.length === 0
  ) {
    return null;
  }

  /*
   * На 10-м уровне остаётся только основное оружие.
   * Второй слот не участвует в подборе пары.
   */
  if (!allowSecondWeapon) {
    const firstWeapon = randomItem(firstWeaponPool);

    if (!firstWeapon) {
      return null;
    }

    return {
      ambidexter: false,
      firstWeapon,
      secondWeapon: null,
    };
  }

  const hasAmbidexter =
    selectedPerks.some(
      (perk) =>
        perk.name ===
        "Амбидекстер"
    );

  /*
   * Амбидекстер:
   * первое оружие — пистолет,
   * второе — другое оружие,
   * при этом два одинаковых пистолета
   * занимают два одинаковых пистолетных слота.
   */
  if (hasAmbidexter) {
    const pistolPool =
      firstWeaponPool.filter(
        (weapon) =>
          isPistol(
            weapon
          )
      );

    if (
      pistolPool.length === 0
    ) {
      return null;
    }

    for (
      const pistol of
      shuffle(
        pistolPool
      )
    ) {
      const secondPool =
        getAmbidexterSecondWeaponPool(
          pistol,
          selectedPerks,
          availableWeapons
        );

      if (
        secondPool.length === 0
      ) {
        continue;
      }

      const secondWeapon =
        randomItem(
          secondPool
        );

      if (!secondWeapon) {
        continue;
      }

      /*
       * Финальная проверка.
       */
      const hasQuartermaster =
        selectedPerks.some(
          (perk) =>
            perk.name ===
            "Интендант"
        );

      const requiredTotalSlots =
        hasQuartermaster
          ? 6
          : 5;

      const actualTotalSlots =
        weaponSlots(
          pistol
        ) * 2 +
        weaponSlots(
          secondWeapon
        );

      if (
        actualTotalSlots !==
        requiredTotalSlots
      ) {
        continue;
      }

      if (
        weaponName(
          pistol
        ) ===
        weaponName(
          secondWeapon
        )
      ) {
        continue;
      }

      if (
        weaponCategory(
          pistol
        ) ===
        weaponCategory(
          secondWeapon
        )
      ) {
        continue;
      }

      return {
        ambidexter:
          true,

        firstWeapon:
          pistol,

        secondWeapon:
          secondWeapon,
      };
    }

    return null;
  }

  /*
   * Обычный вариант.
   */
  for (
    const firstWeapon of
    shuffle(
      firstWeaponPool
    )
  ) {
    const secondPool =
      getSecondWeaponPool(
        firstWeapon,
        selectedPerks,
        availableWeapons
      );

    if (
      secondPool.length === 0
    ) {
      continue;
    }

    const secondWeapon =
      randomItem(
        secondPool
      );

    if (!secondWeapon) {
      continue;
    }

    /*
     * Финальная жёсткая проверка
     * лимита ячеек.
     */
    const hasQuartermaster =
      selectedPerks.some(
        (perk) =>
          perk.name ===
          "Интендант"
      );

    const requiredTotalSlots =
      hasQuartermaster
        ? 6
        : 5;

    const actualTotalSlots =
      weaponSlots(
        firstWeapon
      ) +
      weaponSlots(
        secondWeapon
      );

    if (
      actualTotalSlots !==
      requiredTotalSlots
    ) {
      continue;
    }

    /*
     * Оружие не может быть одинаковым.
     */
    if (
      weaponName(
        firstWeapon
      ) ===
      weaponName(
        secondWeapon
      )
    ) {
      continue;
    }

    /*
     * И тип оружия тоже должен
     * различаться.
     */
    if (
      weaponCategory(
        firstWeapon
      ) ===
      weaponCategory(
        secondWeapon
      )
    ) {
      continue;
    }

    /*
     * Nitro без Интенданта запрещён.
     */
    if (
      !hasQuartermaster &&
      (
        isNitro(
          firstWeapon
        ) ||
        isNitro(
          secondWeapon
        )
      )
    ) {
      continue;
    }

    /*
     * Если всё прошло проверки —
     * пара действительно корректная.
     */
    return {
      ambidexter:
        false,

      firstWeapon,

      secondWeapon,
    };
  }

  return null;
}

function generateBuild(
  contractLevel,
  maxRank
) {
  const rules = getContractLevelRules(contractLevel);

  const availableWeapons =
    filterItemsByRank(
      weapons,
      "weapons",
      maxRank
    );

  const availablePerks =
    filterItemsByRank(
      perks,
      "perks",
      maxRank
    );

  const availableMeleeWeapons =
    filterItemsByRank(
      meleeWeapons,
      "melee",
      maxRank
    );

  const availableMedkits =
    filterItemsByRank(
      medkits,
      "medkits",
      maxRank
    );

  const availableSyringes =
    filterItemsByRank(
      syringes,
      "syringes",
      maxRank
    );

  const availableConsumables =
    filterItemsByRank(
      consumables,
      "consumables",
      maxRank
    );

  for (
    let attempt = 0;
    attempt < 10000;
    attempt++
  ) {
    const selectedPerks =
      generatePerks(
        availablePerks,
        rules.maxPerkPoints,
        rules.maxPerkSlots
      );

    const weaponResult =
      generateWeapons(
        selectedPerks,
        availableWeapons,
        rules.allowSecondWeapon
      );

    if (!weaponResult) {
      continue;
    }

    return {
      contractLevel,
      rank: maxRank,

      perks: selectedPerks,

      weapons: weaponResult,

      melee: rules.allowMelee
        ? randomItem(availableMeleeWeapons)
        : null,

      medkit: rules.allowMedkit
        ? randomItem(availableMedkits)
        : null,

      syringes: rules.allowSyringes
        ? [
            randomItem(availableSyringes),
            randomItem(availableSyringes),
          ]
        : [null, null],

      consumables: rules.consumableSlots.map((isAllowed) =>
        isAllowed
          ? randomItem(availableConsumables)
          : null
      ),
    };
  }

  throw new Error(
    `Не удалось создать корректный билд для ранга ${maxRank}.`
  );
}
  function getFolder(type) {
  switch (type) {
    case "weapon":
      return "Weapons";

    case "melee":
      return "meleeWeapons";

    case "medkit":
      return "medkits";

    case "syringe":
      return "syringes";

    case "consumable":
      return "consumables";

    case "perk":
      return "Perks";

    default:
      return null;
  }
}

/*
 * Создаёт длинную ленту для рулетки.
 *
 * Первые 2 элемента находятся слева
 * от центральной ячейки.
 *
 * Затем идут случайные элементы.
 *
 * В конце находится заранее выбранный
 * результат.
 *
 * После него ещё 2 элемента справа.
 */
function createRouletteItems(pool, result, beforeCount = 45) {
  const before = [];

  for (let i = 0; i < beforeCount; i++) {
    before.push(randomItem(pool));
  }

  return [
    randomItem(pool),
    randomItem(pool),
    ...before,
    result,
    randomItem(pool),
    randomItem(pool),
  ];
}

const ROULETTE_BASE_DURATION = 2200;
const ROULETTE_STOP_INTERVAL = 500;

// Количество карточек, которые проходит первая рулетка.
// Чем больше число — тем больше ощущение настоящего вращения.
const ROULETTE_BASE_STEPS = 90;

// Дополнительная дистанция для каждой следующей остановки.
const ROULETTE_EXTRA_STEPS = 25;

function RouletteRow({
  label,
  type,
  result,
  pool,
  generation,
  language,
  labelCycle,
  stopOrder,
  dualPistols = false,
  rouletteStep = 154,
  slotMatch = false,
}) {
  const [items, setItems] = useState(() =>
  createRouletteItems(
    pool,
    result,
    ROULETTE_BASE_STEPS +
      stopOrder *
        ROULETTE_EXTRA_STEPS
  )
);

  const [position, setPosition] = useState(2);
  const [transition, setTransition] =
    useState("none");

    const [shownLabelCycle, setShownLabelCycle] = useState(0);

const resultLabelTimerRef = React.useRef(null);

  const centerIndexRef =
  React.useRef(2);

const generationRef =
  React.useRef(generation);

const hasSpunRef =
  React.useRef(false);

  useEffect(() => {
  if (
    generation === 0 ||
    generationRef.current === generation
  ) {
    return;
  }

  if (resultLabelTimerRef.current !== null) {
  clearTimeout(resultLabelTimerRef.current);
  resultLabelTimerRef.current = null;
}


  const isFirstSpin =
    !hasSpunRef.current;

  generationRef.current =
    generation;

  hasSpunRef.current = true;

  /*
   * Текущий центральный индекс.
   */
  const currentCenter =
    centerIndexRef.current;

  /*
   * Количество карточек,
   * которые должна пройти рулетка.
   */
  const steps =
    ROULETTE_BASE_STEPS +
    stopOrder *
      ROULETTE_EXTRA_STEPS;

  /*
   * Продолжительность анимации.
   */
  const duration =
    ROULETTE_BASE_DURATION +
    stopOrder *
      ROULETTE_STOP_INTERVAL;

  /*
   * Индекс, на котором должен
   * оказаться новый результат.
   */
  const resultIndex =
    currentCenter + steps;

  /*
   * При первом запуске результат
   * уже находится в нужном месте:
   * его подготовила createRouletteItems().
   *
   * При повторных запусках мы
   * достраиваем ленту до нужного индекса.
   */
  if (!isFirstSpin) {
    const nextItems = [
      ...items,
    ];

    while (
      nextItems.length < resultIndex
    ) {
      nextItems.push(
        randomItem(pool)
      );
    }
  }
  if (isFirstSpin) {
    setItems(
      createRouletteItems(
        pool,
        result,
        steps
      )
    );
  } else {
    const nextItems = [
      ...items,
    ];

    while (
      nextItems.length < resultIndex
    ) {
      nextItems.push(
        randomItem(pool)
      );
    }

    /*
     * Добавляем результат
     * непосредственно на целевой индекс.
     */
    nextItems.push(result);

    /*
     * Две карточки после результата.
     */
    nextItems.push(
      randomItem(pool)
    );

    nextItems.push(
      randomItem(pool)
    );

    setItems(nextItems);
  }

  /*
   * Сначала отключаем анимацию.
   */
  setTransition("none");

  /*
   * Затем запускаем движение.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTransition(
        `transform ${duration}ms cubic-bezier(
          0.015,
          0.72,
          0.08,
          1
        )`
      );

      /*
       * Центральная карточка
       * должна соответствовать resultIndex.
       */
      setPosition(
        resultIndex - 2
      );

      /*
       * Запоминаем новое положение.
       */
      centerIndexRef.current =
        resultIndex;
    });
  });

}, [
  generation,
  items,
  pool,
  result,
  stopOrder,
]);

  const imageFolder =
    getFolder(type);

  const handleRouletteTransitionEnd = (event) => {
  if (
    event.target !== event.currentTarget ||
    event.propertyName !== "transform"
  ) {
    return;
  }

  if (resultLabelTimerRef.current !== null) {
    clearTimeout(resultLabelTimerRef.current);
  }

  resultLabelTimerRef.current = setTimeout(() => {
  setShownLabelCycle(labelCycle);
  resultLabelTimerRef.current = null;
}, 500);
};

    return (
    <div className={`roulette-row${slotMatch ? " is-slot-match" : ""}`}>

      <div className="roulette-label">
  {translateSlotLabel(label, language)}
</div>

        <div className="roulette-window">

        <div className="roulette-viewport">

          <div
  className="roulette-track"
  onTransitionEnd={handleRouletteTransitionEnd}
  style={{
                        transform:
              `translate3d(
                0,
                -${position * rouletteStep}px,
                0
              )`,
            transition,
          }}
        >

          {items.map(
            (item, index) => {

              const image = 
                getItemImage(
                  itemName(item),
                  imageFolder
                );
                const showDualPistols =
  dualPistols &&
  index === position + 2 &&
  image;

              return (
                <div
                  className="roulette-card"
                  key={
                    `${index}-${itemName(item)}`
                  }
                >

                  <div className="roulette-image">

  {showDualPistols ? (
    <div className="roulette-dual-pistols">

      <img
        className="roulette-dual-pistol back"
        src={image}
        alt=""
        aria-hidden="true"
      />

      <img
        className="roulette-dual-pistol front"
        src={image}
        alt={itemName(item)}
      />

    </div>
  ) : image ? (
    <img
      src={image}
      alt={itemName(item)}
    />
  ) : null}

</div>


                </div>
              );
            }
          )}

          </div>

        </div>

                <div className="roulette-center" />

      </div>

      <div className="roulette-result-panel">
  {shownLabelCycle === labelCycle &&
  result !== null &&
  result !== undefined && (
    <span>{translateItemName(itemName(result), language)}</span>
  )}
</div>

    </div>
  );
}


function normalizePriceName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»“”„"]/g, "")
    .replace(/\s+/g, " ");
}

const normalizedItemPrices = Object.fromEntries(
  Object.entries(itemPrices).map(([group, prices]) => [
    group,
    Object.fromEntries(
      Object.entries(prices).map(([name, price]) => [
        normalizePriceName(name),
        Number(price),
      ])
    ),
  ])
);

function getItemPrice(item, group) {
  if (!item) {
    return 0;
  }

  const price = normalizedItemPrices[group]?.[normalizePriceName(itemName(item))];

  if (Number.isFinite(price)) {
    return price;
  }

  console.warn(
    `[RANDOMBUILD] Не найдена цена для "${itemName(item)}" в группе "${group}".`
  );

  return 0;
}

function calculateBuildCost(build) {
  if (!build) {
    return 0;
  }

  let total = 0;

  total += getItemPrice(build.weapons?.firstWeapon, "weapons");
  total += getItemPrice(build.weapons?.secondWeapon, "weapons");
  total += getItemPrice(build.melee, "melee");
  total += getItemPrice(build.medkit, "medkits");

  for (const syringe of build.syringes || []) {
    total += getItemPrice(syringe, "syringes");
  }

  for (const consumable of build.consumables || []) {
    total += getItemPrice(consumable, "consumables");
  }

  return total;
}

const CONTRACT_PROGRESS_STORAGE_KEY = "randomBuildContractProgressV1";

const PLAYER_SESSION_STORAGE_KEY = "randomBuildPlayerSessionV1";
const PLAYER_NICKNAME_STORAGE_KEY = "randomBuildNicknameV1";
const STATS_API_URL = `${window.location.protocol}//${window.location.hostname}:3002`;

function loadPlayerSession() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(PLAYER_SESSION_STORAGE_KEY) || "null"
    );

    if (
      !saved ||
      typeof saved !== "object" ||
      typeof saved.token !== "string" ||
      !saved.token
    ) {
      return null;
    }

    return {
      token: saved.token,
      nickname: String(saved.nickname || "").trim(),
      slot: Number(saved.slot) || 0,
    };
  } catch {
    return null;
  }
}

function savePlayerSession(session) {
  try {
    localStorage.setItem(
      PLAYER_SESSION_STORAGE_KEY,
      JSON.stringify(session)
    );
  } catch (error) {
    console.warn("Не удалось сохранить сессию игрока:", error);
  }
}

function loadSavedPlayerNickname() {
  try {
    const session = loadPlayerSession();
    return String(
      session?.nickname || localStorage.getItem(PLAYER_NICKNAME_STORAGE_KEY) || ""
    ).trim().slice(0, 24);
  } catch {
    return "";
  }
}

function normalisePlayerStats(stats) {
  return {
    kills: Math.max(0, Math.floor(Number(stats?.kills) || 0)),
    money: Math.max(0, Math.floor(Number(stats?.money) || 0)),
    // spent — все расходы, накопленные внутри текущего уровня.
    spent: Math.max(0, Math.floor(Number(stats?.spent) || 0)),
    // lastBuildCost — стоимость последнего билда; показывается в основной таблице.
    lastBuildCost: Math.max(0, Math.floor(Number(stats?.lastBuildCost) || 0)),
  };
}

function normalisePlayerLifetimeStats(stats) {
  return {
    kills: Math.max(0, Math.floor(Number(stats?.kills) || 0)),
    money: Math.max(0, Math.floor(Number(stats?.money) || 0)),
    spent: Math.max(0, Math.floor(Number(stats?.spent) || 0)),
  };
}

function emptyPlayerStats() {
  return { kills: 0, money: 0, spent: 0, lastBuildCost: 0 };
}

function emptyPlayerLifetimeStats() {
  return { kills: 0, money: 0, spent: 0 };
}

function getPlayerStatsFromList(players, slot) {
  const player = players?.[String(slot)];
  return player ? normalisePlayerStats(player.stats) : emptyPlayerStats();
}

function getPlayerLifetimeStatsFromList(players, slot) {
  const player = players?.[String(slot)];
  return player
    ? normalisePlayerLifetimeStats(player.lifetimeStats ?? player.stats)
    : emptyPlayerLifetimeStats();
}


function loadContractProgress() {
  const fallback = {
    level: 1,
    progress: emptyPlayerStats(),
    lifetimeStats: emptyPlayerLifetimeStats(),
  };

  try {
    const saved = JSON.parse(
      localStorage.getItem(CONTRACT_PROGRESS_STORAGE_KEY) || "null"
    );

    if (!saved || typeof saved !== "object") {
      return fallback;
    }

    const level = Number(saved.level);
    const kills = Number(saved.progress?.kills);
    const money = Number(saved.progress?.money);
    const spent = Number(saved.progress?.spent);
    const lastBuildCost = Number(saved.progress?.lastBuildCost);

    const savedLifetime = saved.lifetimeStats || saved.progress || {};

    return {
      level: Number.isInteger(level) && level >= 1 && level <= 10
        ? level
        : 1,
      progress: {
        kills: Number.isFinite(kills) ? Math.max(0, Math.floor(kills)) : 0,
        money: Number.isFinite(money) ? Math.max(0, Math.floor(money)) : 0,
        spent: Number.isFinite(spent) ? Math.max(0, Math.floor(spent)) : 0,
        lastBuildCost: Number.isFinite(lastBuildCost) ? Math.max(0, Math.floor(lastBuildCost)) : 0,
      },
      // Миграция старого localStorage: текущие значения становятся стартовой базой.
      lifetimeStats: normalisePlayerLifetimeStats(savedLifetime),
    };
  } catch (error) {
    console.warn("Не удалось прочитать сохранённый прогресс контракта:", error);
    return fallback;
  }
}


function PlayerStatBoard({
  slot,
  nickname,
  stats,
  lifetimeStats,
  showLifetime = false,
  editable,
  language,
  drafts,
  onDraftChange,
  onCommit,
  contractLevel = 1,
  activityEvent = "none",
}) {
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const safeStats = normalisePlayerStats(stats);
  const net = safeStats.money - safeStats.spent;
  const safeLifetimeStats = normalisePlayerLifetimeStats(lifetimeStats);
  const lifetimeNet = safeLifetimeStats.money - safeLifetimeStats.spent;

  return (
    <div
      className={`contract-side-board player-stat-board contract-side-board-player-${slot}`}
      data-player-slot={slot}
      data-last-log-event={activityEvent}
      role="group"
      aria-label={
        language === "ru"
          ? `Статистика игрока ${slot}`
          : `Player ${slot} statistics`
      }
    >
      <img
        className="contract-side-board-image"
        src={
          language === "en"
            ? new URL(
                "../Images/ui/contract-side-board-en.png",
                import.meta.url
              ).href
            : new URL(
                "../Images/ui/contract-side-board.png",
                import.meta.url
              ).href
        }
        alt=""
        aria-hidden="true"
      />

      <div className="player-stat-board-name" title={nickname || `Player ${slot}`}>
        {nickname || (language === "ru" ? `Игрок ${slot}` : `Player ${slot}`)}
      </div>

      <div className="contract-side-board-indicators">
        <div className="contract-side-board-row contract-side-board-input-row">
          {editable ? (
            <input
              className="contract-side-board-value contract-side-board-input"
              data-stat="kills"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={12}
              value={drafts.kills}
              onChange={(event) => onDraftChange("kills", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onCommit("kills");
                  event.currentTarget.blur();
                }
              }}
              aria-label={
                language === "ru" ? "Количество убийств" : "Kill count"
              }
              title={
                language === "ru"
                  ? "Введите количество убийств"
                  : "Enter kill count"
              }
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <span
              className="contract-side-board-value contract-side-board-readonly"
              data-stat="kills"
            >
              {safeStats.kills.toLocaleString(locale)}
            </span>
          )}
        </div>

        <div className="contract-side-board-row">
          <span
            className="contract-side-board-value contract-side-board-readonly"
            data-stat="spent"
          >
            {safeStats.lastBuildCost.toLocaleString(locale)}
          </span>
        </div>

        <div className="contract-side-board-row contract-side-board-input-row">
          {editable ? (
            <input
              className="contract-side-board-value contract-side-board-input"
              data-stat="money"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={12}
              value={drafts.money}
              onChange={(event) => onDraftChange("money", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onCommit("money");
                  event.currentTarget.blur();
                }
              }}
              aria-label={
                language === "ru" ? "Заработано денег" : "Money earned"
              }
              title={
                language === "ru"
                  ? "Введите заработанную сумму"
                  : "Enter money earned"
              }
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <span
              className="contract-side-board-value contract-side-board-readonly"
              data-stat="money"
            >
              {safeStats.money.toLocaleString(locale)}
            </span>
          )}
        </div>

        <div className="contract-side-board-row">
          <span
            className="contract-side-board-value contract-side-board-readonly"
            data-stat="net"
          >
            {net.toLocaleString(locale)}
          </span>
        </div>
      </div>

      {/* Правая узкая табличка показывает накопительную статистику
          текущего пользователя. Значения сохраняются при смене уровня. */}
      {showLifetime && (
        <div
          className="contract-goals-board"
          role="group"
          aria-label={language === "ru" ? "Накопительная статистика" : "Lifetime statistics"}
        >
          <img
            className="contract-goals-board-image"
            src={getUiPng("contract-goals-board-vertical.png")}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <div className="contract-goals-board-values">
            <span className="contract-goals-board-total" data-total="kills">
              {safeLifetimeStats.kills.toLocaleString(locale)}
            </span>
            <span className="contract-goals-board-total" data-total="spent">
              {safeLifetimeStats.spent.toLocaleString(locale)}
            </span>
            <span className="contract-goals-board-total" data-total="money">
              {safeLifetimeStats.money.toLocaleString(locale)}
            </span>
            <span className="contract-goals-board-total" data-total="net">
              {lifetimeNet.toLocaleString(locale)}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}

function App() {
    const [build, setBuild] =
    useState(null);

  const [generating, setGenerating] =
    useState(false);

  const [generation, setGeneration] =
  useState(0);

const [language, setLanguage] =
  useState("ru");

const [isGuideOpen, setIsGuideOpen] =
  useState(false);

// Активный уровень и накопленный прогресс текущего уровня.
// Прогресс сохраняется локально и не теряется между матчами или перезапусками приложения.
const [savedContractState] = useState(() => loadContractProgress());
const [contractLevel, setContractLevel] = useState(savedContractState.level);
const [contractProgress, setContractProgress] = useState(savedContractState.progress);
const [contractLifetimeStats, setContractLifetimeStats] = useState(
  savedContractState.lifetimeStats || normalisePlayerLifetimeStats(savedContractState.progress)
);
// Синхронный источник накопительных значений: обновляется до постановки API-запроса в очередь.
const contractLifetimeStatsRef = React.useRef(
  normalisePlayerLifetimeStats(savedContractState.lifetimeStats || savedContractState.progress)
);

function replaceContractLifetimeStats(nextStats) {
  const normalized = normalisePlayerLifetimeStats(nextStats);
  contractLifetimeStatsRef.current = normalized;
  setContractLifetimeStats(normalized);
}

const [contractStatDrafts, setContractStatDrafts] = useState({
  kills: "",
  money: "",
});
const [slotMatches, setSlotMatches] = useState({});
const [huntReaderDiagnostics, setHuntReaderDiagnostics] = useState(null);
const [huntLogDiagnostics, setHuntLogDiagnostics] = useState(null);
const [huntLogEvents, setHuntLogEvents] = useState([]);
const lastHuntLogEventSeqRef = React.useRef(0);

// OFF разрешает вручную выбирать уровень. ON включает автоматическое повышение.
const [contractModeOn, setContractModeOn] = useState(false);
const [lockedContractLevel, setLockedContractLevel] = useState(savedContractState.level);

// Общая статистика трёх игроков. Сервер является источником истины,
// localStorage хранит только сессию браузера и локальный кэш текущего игрока.
const [playerSession, setPlayerSession] = useState(() => loadPlayerSession());
const [nicknameDraft, setNicknameDraft] = useState(() => loadSavedPlayerNickname());
const [roomCodeDraft, setRoomCodeDraft] = useState("");
const [roomConnectionOpen, setRoomConnectionOpen] = useState(false);
const [registrationError, setRegistrationError] = useState("");
const [nicknameSaveError, setNicknameSaveError] = useState("");
const [statsServerReady, setStatsServerReady] = useState(false);
const [sharedPlayers, setSharedPlayers] = useState({});
const [roomInfo, setRoomInfo] = useState(null);

// Serializes this player's writes and prevents an older room poll from
// overwriting a just-entered value before the server finishes saving it.
const statsSyncQueueRef = React.useRef(Promise.resolve());
const statsSyncRequestIdRef = React.useRef(0);
const statsSyncPendingRef = React.useRef(0);

const currentPlayerSlot = playerSession?.slot || 0;
const currentPlayerNickname = playerSession?.nickname || "";
// Room actions use the visible nickname draft, falling back to the saved session nickname.
const effectiveRoomNickname = String(nicknameDraft || playerSession?.nickname || "").trim().slice(0, 24);
const roomPlayers = roomInfo?.players || {};
const sortedRoomPlayers = Object.values(roomPlayers)
  .filter(Boolean)
  .sort((a, b) => Number(a.slot) - Number(b.slot));
const localRoomPlayer = currentPlayerSlot
  ? sortedRoomPlayers.find((player) => Number(player.slot) === Number(currentPlayerSlot))
  : null;
// В локальном интерфейсе каждый участник видит себя в первом слоте.
// Номера слотов на сервере не меняются — статистика остаётся привязана к владельцу.
const roomPlayersForLocalView = localRoomPlayer
  ? [localRoomPlayer, ...sortedRoomPlayers.filter((player) => player !== localRoomPlayer)]
  : sortedRoomPlayers;
const roomPlayerCount = Object.keys(roomPlayers).length;
const isInRoom = Boolean(playerSession?.token);
// При одном участнике кнопка позволяет перейти в другую комнату.
// При двух или трёх участниках действие меняется на выход из комнаты.
const canOpenRoomConnection = !isInRoom || roomPlayerCount <= 1;

useEffect(() => {
  // Если во время открытой формы в комнату вошёл второй игрок,
  // закрываем форму: теперь основное действие — выход из комнаты.
  if (!canOpenRoomConnection && roomConnectionOpen) {
    setRoomConnectionOpen(false);
    setRoomCodeDraft("");
    setRegistrationError("");
  }
}, [canOpenRoomConnection, roomConnectionOpen]);

function updateNicknameDraft(value) {
  const nextNickname = String(value ?? "").slice(0, 24);
  setNicknameDraft(nextNickname);
  setNicknameSaveError("");
  try {
    localStorage.setItem(PLAYER_NICKNAME_STORAGE_KEY, nextNickname);
  } catch (error) {
    console.warn("Не удалось сохранить ник игрока:", error);
  }
}

async function savePlayerNickname() {
  if (!playerSession?.token) return;

  const nickname = String(nicknameDraft || "").trim().slice(0, 24);
  const previousNickname = String(playerSession.nickname || "").trim();

  if (!nickname) {
    updateNicknameDraft(previousNickname);
    setNicknameSaveError(language === "ru" ? "Ник не может быть пустым." : "Nickname cannot be empty.");
    return;
  }

  if (nickname === previousNickname) return;

  // Сразу обновляем собственный слот локально, чтобы новое имя было видно
  // без задержки, пока сервер сохраняет изменение для остальных участников.
  const previousSession = playerSession;
  const optimisticSession = { ...previousSession, nickname };
  setPlayerSession(optimisticSession);
  savePlayerSession(optimisticSession);
  setSharedPlayers((current) => ({
    ...current,
    [String(currentPlayerSlot)]: {
      ...(current[String(currentPlayerSlot)] || {}),
      slot: currentPlayerSlot,
      nickname,
    },
  }));

  try {
    const response = await fetch(`${STATS_API_URL}/api/room/nickname`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: previousSession.token, nickname }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    // Если за время запроса игрок уже вышел или перешёл в другую комнату,
    // не перезаписываем новую сессию ответом от старой.
    if (loadPlayerSession()?.token !== previousSession.token) return;

    const confirmedNickname = String(data?.player?.nickname || nickname).trim();
    const confirmedSession = {
      ...optimisticSession,
      nickname: confirmedNickname,
      slot: Number(data?.player?.slot) || currentPlayerSlot,
    };
    savePlayerSession(confirmedSession);
    setPlayerSession(confirmedSession);
    updateNicknameDraft(confirmedNickname);

    if (data?.room) {
      setRoomInfo(data.room);
      setSharedPlayers(data.room.players || {});
    }
    setNicknameSaveError("");
  } catch (error) {
    console.error("Не удалось обновить ник игрока:", error);
    if (loadPlayerSession()?.token !== previousSession.token) return;
    const restoredSession = { ...previousSession, nickname: previousNickname };
    savePlayerSession(restoredSession);
    setPlayerSession(restoredSession);
    updateNicknameDraft(previousNickname);
    setSharedPlayers((current) => ({
      ...current,
      [String(currentPlayerSlot)]: {
        ...(current[String(currentPlayerSlot)] || {}),
        slot: currentPlayerSlot,
        nickname: previousNickname,
      },
    }));
    setNicknameSaveError(error?.message || (language === "ru" ? "Не удалось сохранить ник." : "Could not save nickname."));
  }
}

function syncCurrentPlayerStats(nextStats, lifetimeDelta = {}, options = {}) {
  const normalized = normalisePlayerStats(nextStats);
  const normalizedDelta = normalisePlayerLifetimeStats(lifetimeDelta);
  const previousLifetime = normalisePlayerLifetimeStats(contractLifetimeStatsRef.current);
  const normalizedLifetime = options.resetLifetime
    ? emptyPlayerLifetimeStats()
    : {
        kills: previousLifetime.kills + normalizedDelta.kills,
        money: previousLifetime.money + normalizedDelta.money,
        spent: previousLifetime.spent + normalizedDelta.spent,
      };

  // Обновляем ref немедленно: последующий сброс уровня не сможет взять старый снимок.
  contractLifetimeStatsRef.current = normalizedLifetime;
  setContractProgress(normalized);
  setContractLifetimeStats(normalizedLifetime);
  setSharedPlayers((current) => ({
    ...current,
    [String(currentPlayerSlot || 1)]: {
      ...(current[String(currentPlayerSlot || 1)] || {}),
      slot: currentPlayerSlot || 1,
      nickname: currentPlayerNickname,
      stats: normalized,
      lifetimeStats: normalizedLifetime,
    },
  }));

  if (!playerSession?.token || !currentPlayerSlot) return;

  const requestId = ++statsSyncRequestIdRef.current;
  statsSyncPendingRef.current += 1;

  statsSyncQueueRef.current = statsSyncQueueRef.current
    .catch(() => {})
    .then(async () => {
      const response = await fetch(`${STATS_API_URL}/api/stats/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: playerSession.token,
          stats: normalized,
          lifetimeDelta: normalizedDelta,
          resetLifetime: Boolean(options.resetLifetime),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      if (requestId !== statsSyncRequestIdRef.current) return;
      if (data?.room) {
        setRoomInfo(data.room);
        setSharedPlayers(data.room.players || {});
      }
      if (data?.player) {
        replaceContractLifetimeStats(data.player.lifetimeStats ?? normalizedLifetime);
      }
      setStatsServerReady(true);
    })
    .catch((error) => {
      if (requestId === statsSyncRequestIdRef.current) {
        console.warn("Не удалось синхронизировать статистику:", error);
        setStatsServerReady(false);
      }
    })
    .finally(() => {
      statsSyncPendingRef.current = Math.max(0, statsSyncPendingRef.current - 1);
    });
}

function getDisplayedPlayerStats(slot) {
  if (
    (slot === currentPlayerSlot && currentPlayerSlot) ||
    (!currentPlayerSlot && slot === 1)
  ) {
    return normalisePlayerStats(contractProgress);
  }

  return getPlayerStatsFromList(sharedPlayers, slot);
}

function getDisplayedPlayerLifetimeStats(slot) {
  if (
    (slot === currentPlayerSlot && currentPlayerSlot) ||
    (!currentPlayerSlot && slot === 1)
  ) {
    return normalisePlayerLifetimeStats(contractLifetimeStats);
  }

  return getPlayerLifetimeStatsFromList(sharedPlayers, slot);
}

function getDisplayedPlayerNickname(slot) {
  if (Number(slot) === Number(currentPlayerSlot) && currentPlayerSlot) {
    return String(nicknameDraft || "").trim();
  }
  return String(sharedPlayers?.[String(slot)]?.nickname || "").trim();
}


// Состояние Hunt для двух индикаторов доски: hunt / rest / offline / unknown.
const [huntActivity, setHuntActivity] = useState("unknown");

useEffect(() => {
  try {
    localStorage.setItem(
      CONTRACT_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        level: contractLevel,
        progress: contractProgress,
        lifetimeStats: contractLifetimeStats,
      })
    );
  } catch (error) {
    console.warn("Не удалось сохранить прогресс контракта:", error);
  }
}, [contractLevel, contractProgress, contractLifetimeStats]);

// Комната и игрок восстанавливаются после обновления страницы.
useEffect(() => {
  if (!playerSession?.token) return;

  let active = true;

  async function refreshRoom() {
    const syncRequestIdAtStart = statsSyncRequestIdRef.current;
    const hadPendingStatsSyncAtStart = statsSyncPendingRef.current > 0;

    try {
      const response = await fetch(
        `${STATS_API_URL}/api/room?token=${encodeURIComponent(playerSession.token)}`,
        { cache: "no-store" }
      );

      if (response.status === 401) {
        localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
        if (active) {
          setPlayerSession(null);
          setSharedPlayers({});
          setRoomInfo(null);
          setStatsServerReady(false);
        }
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (!active) return;

      if (data?.room) {
        setRoomInfo(data.room);
        setSharedPlayers(data.room.players || {});
      }

      if (data?.player) {
        const serverSession = {
          token: playerSession.token,
          nickname: data.player.nickname,
          slot: Number(data.player.slot),
          roomCode: data.room?.code || playerSession.roomCode || "",
          isHost: data.room?.hostToken === playerSession.token,
        };
        setPlayerSession(serverSession);
        savePlayerSession(serverSession);

        // Не позволяем ответу старого опроса затереть локальный ввод
        // или данные, которые ещё находятся в очереди на сохранение.
        if (
          !hadPendingStatsSyncAtStart &&
          syncRequestIdAtStart === statsSyncRequestIdRef.current &&
          statsSyncPendingRef.current === 0
        ) {
          setContractProgress(normalisePlayerStats(data.player.stats));
          replaceContractLifetimeStats(data.player.lifetimeStats ?? data.player.stats);
        }
      }

      setStatsServerReady(true);
    } catch (error) {
      if (active) {
        console.warn("Не удалось получить комнату RandomBuild:", error);
        setStatsServerReady(false);
      }
    }
  }

  refreshRoom();
  const intervalId = window.setInterval(refreshRoom, 1000);
  return () => {
    active = false;
    window.clearInterval(intervalId);
  };
}, [playerSession?.token]);

async function createRoom() {
  const nickname = effectiveRoomNickname;
  const previousToken = String(playerSession?.token || "").trim();
  if (!nickname) {
    setRegistrationError(language === "ru" ? "Введите ник." : "Enter your nickname.");
    return;
  }

  setRegistrationError("");
  try {
    const response = await fetch(`${STATS_API_URL}/api/room/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname,
        legacyStats: contractProgress,
        legacyLifetimeStats: contractLifetimeStats,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);

    // При создании новой комнаты из одиночной старой комнаты
    // освобождаем прежнюю сессию только после успешного создания.
    if (previousToken) {
      fetch(`${STATS_API_URL}/api/room/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: previousToken }),
        keepalive: true,
      }).catch((leaveError) => {
        console.warn("Не удалось покинуть предыдущую комнату:", leaveError);
      });
    }

    const nextSession = {
      token: data.token,
      nickname: data.player.nickname,
      slot: Number(data.player.slot),
      roomCode: data.room.code,
      isHost: true,
    };
    savePlayerSession(nextSession);
    setPlayerSession(nextSession);
    setRoomInfo(data.room);
    setSharedPlayers(data.room.players || {});
    setContractProgress(normalisePlayerStats(data.player.stats));
    replaceContractLifetimeStats(data.player.lifetimeStats ?? data.player.stats);
    updateNicknameDraft(data.player.nickname || nickname);
    setRoomCodeDraft("");
    setRoomConnectionOpen(false);
    setRegistrationError("");
    setStatsServerReady(true);
  } catch (error) {
    console.error("Не удалось создать комнату:", error);
    setRegistrationError(error?.message || (language === "ru" ? "Не удалось создать комнату." : "Could not create room."));
  }
}

async function joinRoom() {
  const nickname = effectiveRoomNickname;
  const roomCode = String(roomCodeDraft || "").trim().toUpperCase();
  const previousToken = String(playerSession?.token || "").trim();
  const previousRoomCode = String(playerSession?.roomCode || "").trim().toUpperCase();

  if (!nickname) {
    setRegistrationError(language === "ru" ? "Введите ник." : "Enter your nickname.");
    return;
  }
  if (!roomCode) {
    setRegistrationError(language === "ru" ? "Введите ключ комнаты." : "Enter the room key.");
    return;
  }
  if (previousToken && previousRoomCode && previousRoomCode === roomCode) {
    setRegistrationError(language === "ru" ? "Вы уже находитесь в этой комнате." : "You are already in this room.");
    return;
  }

  setRegistrationError("");
  try {
    // Сначала пытаемся войти в новую комнату без старого токена.
    // Старую комнату покидаем только после успешного подключения,
    // чтобы неверный ключ не лишил игрока текущей комнаты.
    const response = await fetch(`${STATS_API_URL}/api/room/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomCode,
        nickname,
        token: null,
        legacyStats: contractProgress,
        legacyLifetimeStats: contractLifetimeStats,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);

    if (previousToken) {
      fetch(`${STATS_API_URL}/api/room/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: previousToken }),
        keepalive: true,
      }).catch((leaveError) => {
        console.warn("Не удалось покинуть предыдущую комнату:", leaveError);
      });
    }

    const nextSession = {
      token: data.token,
      nickname: data.player.nickname,
      slot: Number(data.player.slot),
      roomCode: data.room.code,
      isHost: data.room.hostToken === data.token,
    };
    savePlayerSession(nextSession);
    setPlayerSession(nextSession);
    setRoomInfo(data.room);
    setSharedPlayers(data.room.players || {});
    setContractProgress(normalisePlayerStats(data.player.stats));
    replaceContractLifetimeStats(data.player.lifetimeStats ?? data.player.stats);
    updateNicknameDraft(data.player.nickname || nickname);
    setRoomCodeDraft("");
    setRoomConnectionOpen(false);
    setRegistrationError("");
    setStatsServerReady(true);
  } catch (error) {
    console.error("Не удалось подключиться к комнате:", error);
    setRegistrationError(error?.message || (language === "ru" ? "Не удалось подключиться к комнате." : "Could not join room."));
  }
}

function leaveRoom() {
  if (!playerSession?.token) return;
  const savedNickname = playerSession.nickname || nicknameDraft;
  fetch(`${STATS_API_URL}/api/room/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: playerSession.token }),
    keepalive: true,
  }).catch(() => {});
  localStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
  setPlayerSession(null);
  setRoomInfo(null);
  setSharedPlayers({});
  setStatsServerReady(false);
  updateNicknameDraft(savedNickname);
  setRoomCodeDraft("");
  setRoomConnectionOpen(false);
  setRegistrationError("");
}

// Автоматическое повышение работает в режиме ON.
// После выполнения обеих целей уровень повышается на 1, а счётчики нового уровня сбрасываются.
useEffect(() => {
  if (!contractModeOn || contractLevel >= 10) {
    return;
  }

  const killsGoal = contractLevel * 2;
  const moneyGoal = contractLevel * 2000;
  const netProfit =
    (Number(contractProgress.money) || 0) -
    (Number(contractProgress.spent) || 0);

  const killsCompleted = contractProgress.kills >= killsGoal;
  const moneyCompleted = netProfit >= moneyGoal;

  if (!killsCompleted || !moneyCompleted) {
    return;
  }

  const nextLevel = Math.min(contractLevel + 1, 10);
  if (nextLevel === contractLevel) {
    return;
  }

  setContractLevel(nextLevel);
  setLockedContractLevel(nextLevel);
  setContractStatDrafts({ kills: "", money: "" });
  syncCurrentPlayerStats(emptyPlayerStats());
}, [contractModeOn, contractLevel, contractProgress]);

// Убийства и заработанные деньги вводятся вручную. Расходы и чистая прибыль считаются автоматически.
// Во время набора меняется только черновик; значение учитывается после Enter.
function updateContractStat(stat, rawValue) {
  const digits = String(rawValue ?? "").replace(/\D/g, "").slice(0, 12);

  setContractStatDrafts((current) => ({
    ...current,
    [stat]: digits,
  }));
}

function commitContractStat(stat) {
  const digits = String(contractStatDrafts[stat] ?? "")
    .replace(/\D/g, "")
    .slice(0, 12);

  // Пустой Enter ничего не обнуляет и оставляет поле пустым.
  if (!digits) {
    setContractStatDrafts((current) => ({
      ...current,
      [stat]: "",
    }));
    return;
  }

  const parsedValue = Number(digits);
  const value = Number.isSafeInteger(parsedValue)
    ? parsedValue
    : Number.MAX_SAFE_INTEGER;

  // Введённое значение относится к завершившемуся матчу:
  // прибавляем его к уже накопленному прогрессу, а не заменяем прогресс.
  const goal = stat === "kills"
    ? contractLevel * 2
    : contractLevel * 2000;

  const current = normalisePlayerStats(contractProgress);
  const currentValue = Math.max(0, Number(current[stat]) || 0);

  // Убийства ограничиваем самой целью.
  // Деньги ограничиваем только суммой «цель + расходы».
  const maxAllowed = stat === "kills"
    ? goal
    : goal + Math.max(0, Number(current.spent) || 0);

  const acceptedForCurrentLevel = Math.min(
    value,
    Math.max(0, maxAllowed - currentValue)
  );

  const nextProgress = {
    ...current,
    [stat]: currentValue + acceptedForCurrentLevel,
  };

  // В накопительную статистику целиком передаётся введённая сумма,
  // включая превышение цели текущего уровня.
  syncCurrentPlayerStats(nextProgress, { [stat]: value });

  setContractStatDrafts((currentDrafts) => ({
    ...currentDrafts,
    [stat]: "",
  }));
}

// Смена уровня очищает только текущие показатели. Накопительные суммы сохраняются.
function resetContractProgress() {
  syncCurrentPlayerStats(emptyPlayerStats());
  setContractStatDrafts({ kills: "", money: "" });
}

// Полный сброс очищает и прогресс уровня, и накопительную статистику игрока.
function resetAllContractStats() {
  syncCurrentPlayerStats(emptyPlayerStats(), {}, { resetLifetime: true });
  setContractStatDrafts({ kills: "", money: "" });
}

function toggleContractMode() {
  if (contractModeOn) {
    // Перед переходом в OFF сохраняем текущий зафиксированный уровень.
    setLockedContractLevel(contractLevel);
    setContractModeOn(false);
    return;
  }

  // При переходе OFF -> ON возвращаем сохранённый уровень.
  // При первом включении сохраняем текущий выбранный пользователем уровень.
  const levelToRestore = lockedContractLevel ?? contractLevel;
  setContractLevel(levelToRestore);
  setLockedContractLevel(levelToRestore);
  setContractModeOn(true);
}

function selectContractLevel(level) {
  if (contractModeOn) {
    return;
  }

  setContractLevel(level);
  setLockedContractLevel(level);
  resetContractProgress();
}

const [rankInput, setRankInput] =
  useState("");

const isRankValid =
  /^\d{1,3}$/.test(rankInput) &&
  Number(rankInput) >= 1 &&
  Number(rankInput) <= 100;

function changeRank(delta) {
  const parsedRank = Number.parseInt(rankInput, 10);
  const currentRank = Number.isFinite(parsedRank)
    ? parsedRank
    : 0;
  const nextRank = Math.min(
    100,
    Math.max(1, currentRank + delta)
  );

  setRankInput(String(nextRank));
}

/* Открытая инструкция закрывается клавишей Esc. */
useEffect(() => {
  if (!isGuideOpen) {
    return;
  }

  const previousOverflow = document.body.style.overflow;

  function handleGuideKeyDown(event) {
    if (event.key === "Escape") {
      setIsGuideOpen(false);
    }
  }

  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", handleGuideKeyDown);

  return () => {
    document.body.style.overflow = previousOverflow;
    window.removeEventListener("keydown", handleGuideKeyDown);
  };
}, [isGuideOpen]);

const [labelCycle, setLabelCycle] =
  useState(0);

const [rouletteStep, setRouletteStep] =
  useState(154);

const GAME_STATUS_URL = "http://localhost:3001/api/game/status";
const GAME_EVENTS_URL = "http://localhost:3001/api/game/events";
const GAME_LOADOUT_URL = "http://localhost:3001/api/game/expected-loadout";

// Получаем состояние Hunt с локального сервера. Никаких внешних запросов.
useEffect(() => {
  let active = true;
  let requestPending = false;

  async function refreshHuntActivity() {
    if (requestPending) return;
    requestPending = true;

    try {
      const response = await fetch(GAME_STATUS_URL, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const nextActivity = ["hunt", "rest", "offline"].includes(data.activity)
        ? data.activity
        : "unknown";

      if (active) {
        setHuntActivity(nextActivity);
        if (data.slotMatches && typeof data.slotMatches === "object") {
          setSlotMatches(data.slotMatches);
        }
        setHuntReaderDiagnostics(data.screenReader || null);
        setHuntLogDiagnostics({
          gameLog: data.logPath || null,
          backupDirectory: data.backupDirectory || null,
          backupError: data.backupLogError || null,
          latestBackupLogs: Array.isArray(data.latestBackupLogs) ? data.latestBackupLogs : [],
          backupEventCount: Number(data.backupEventCount) || 0,
          liveLogEventCount: Number(data.liveLogEventCount) || 0,
        });

        // Consume lifecycle events from both Game.log and the newest LogBackups
        // file. These events are diagnostic/session data; death screens are
        // deliberately not counted as enemy kills.
        try {
          const eventsResponse = await fetch(
            `${GAME_EVENTS_URL}?after=${lastHuntLogEventSeqRef.current}`,
            { method: "GET", cache: "no-store" }
          );
          if (eventsResponse.ok) {
            const eventData = await eventsResponse.json();
            const newEvents = Array.isArray(eventData.events) ? eventData.events : [];
            if (active && newEvents.length > 0) {
              setHuntLogEvents((current) => [...current, ...newEvents].slice(-60));
            }
            const nextSeq = Number(eventData.nextAfter);
            if (Number.isFinite(nextSeq)) {
              // If Node restarted, its in-memory event sequence starts at 0 again.
              if (nextSeq < lastHuntLogEventSeqRef.current) {
                lastHuntLogEventSeqRef.current = 0;
              } else {
                lastHuntLogEventSeqRef.current = nextSeq;
              }
            }
          }
        } catch (eventError) {
          // Status/indicators continue to work if the optional event feed is unavailable.
        }
      }
    } catch (error) {
      if (active) setHuntActivity("unknown");
    } finally {
      requestPending = false;
    }
  }

  refreshHuntActivity();
  const timer = window.setInterval(refreshHuntActivity, 1200);

  return () => {
    active = false;
    window.clearInterval(timer);
  };
}, []);

useEffect(() => {
  const updateStep = () => {
    const track = document.querySelector(".roulette-track");

    if (!track) {
      return;
    }

    const cards = track.querySelectorAll(":scope > .roulette-card");

    if (cards.length < 2) {
      return;
    }

    /*
     * ВАЖНО: .app масштабируется внешним CSS transform: scale().
     * getBoundingClientRect() возвращает уже уменьшенные координаты,
     * а translate3d() задаёт смещение в исходных CSS-пикселях.
     * Если использовать getBoundingClientRect(), масштаб применяется
     * дважды и лента не доезжает до результата.
     *
     * offsetTop возвращает координаты исходной раскладки и включает
     * межкарточный gap flex-контейнера. Поэтому расстояние остаётся
     * правильным при любом масштабе всего игрового экрана.
     */
    const firstTop = cards[0].offsetTop;
    const secondTop = cards[1].offsetTop;
    const measuredStep = secondTop - firstTop;

    if (
      Number.isFinite(measuredStep) &&
      measuredStep > 0
    ) {
      setRouletteStep(measuredStep);
    }
  };

  updateStep();

  const track = document.querySelector(".roulette-track");
  const cards = track
    ? track.querySelectorAll(":scope > .roulette-card")
    : [];

  const observer =
    "ResizeObserver" in window
      ? new ResizeObserver(updateStep)
      : null;

  if (track) {
    observer?.observe(track);
  }

  if (cards.length >= 2) {
    observer?.observe(cards[0]);
    observer?.observe(cards[1]);
  }

  window.addEventListener("resize", updateStep);

  return () => {
    observer?.disconnect();
    window.removeEventListener("resize", updateStep);
  };
}, [build]);

  /*
   * Здесь формируется именно порядок
   * ОСТАНОВКИ рулеток.
   *
   * Все строки появляются одновременно,
   * но stopOrder задаёт, когда каждая
   * из них остановится.
   */
    
const rows = useMemo(() => {
  const activeContractLevel =
    build?.contractLevel ?? contractLevel;

  const rules = getContractLevelRules(activeContractLevel);
  const perkCount = rules.maxPerkSlots;

  /*
   * До генерации всегда показываем все 14 пустых слотов.
   * Ограничения уровня влияют на содержимое после генерации,
   * но не удаляют ячейки из интерфейса.
   */
  if (!build) {
    const emptyRows = [
      {
        id: "weapon-main",
        label: "Основное оружие",
        type: "weapon",
        stopOrder: perkCount,
      },
      {
        id: "weapon-second",
        label: "Второе оружие",
        type: "weapon",
        stopOrder: perkCount + 1,
      },
      {
        id: "melee",
        label: "Оружие ближнего боя",
        type: "melee",
        stopOrder: perkCount + 2,
      },
      {
        id: "medkit",
        label: "Аптечка",
        type: "medkit",
        stopOrder: perkCount + 3,
      },
      {
        id: "syringe-1",
        label: "Шприц",
        type: "syringe",
        stopOrder: perkCount + 4,
      },
      {
        id: "syringe-2",
        label: "Шприц",
        type: "syringe",
        stopOrder: perkCount + 5,
      },
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `consumable-${index}`,
        label: "Расходник",
        type: "consumable",
        stopOrder: perkCount + 6 + index,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `perk-${index}`,
        label: `Перк ${index + 1}`,
        type: "perk",
        stopOrder: index,
      })),
    ];

    return emptyRows.map((row) => ({
      ...row,
      result: null,
      pool: [],
    }));
  }

  const rankedWeapons =
    filterItemsByRank(
      weapons,
      "weapons",
      build.rank
    );

  const rankedMeleeWeapons =
    filterItemsByRank(
      meleeWeapons,
      "melee",
      build.rank
    );

  const rankedMedkits =
    filterItemsByRank(
      medkits,
      "medkits",
      build.rank
    );

  const rankedSyringes =
    filterItemsByRank(
      syringes,
      "syringes",
      build.rank
    );

  const rankedConsumables =
    filterItemsByRank(
      consumables,
      "consumables",
      build.rank
    );

  const rankedPerks =
    filterItemsByRank(
      perks,
      "perks",
      build.rank
    );

  const mainWeaponPool =
    getFirstWeaponPool(
      build.perks,
      rankedWeapons
    );

  const result = [];

  // 1. Основное оружие — доступно на всех уровнях.
  result.push({
    id: "weapon-main",
    label: "Основное оружие",
    type: "weapon",
    result: build.weapons.firstWeapon,
    pool: mainWeaponPool,
    stopOrder: perkCount,
  });

  // 2. Второе оружие — отключается только на 10-м уровне.
  result.push({
    id: "weapon-second",
    label: "Второе оружие",
    type: "weapon",
    result: rules.allowSecondWeapon
      ? build.weapons.secondWeapon
      : null,
    pool: rules.allowSecondWeapon
      ? getSecondWeaponPool(
          build.weapons.firstWeapon,
          build.perks,
          rankedWeapons
        )
      : [],
    stopOrder: perkCount + 1,
  });

  // 3. Оружие ближнего боя — отключается только на 10-м уровне.
  result.push({
    id: "melee",
    label: "Оружие ближнего боя",
    type: "melee",
    result: rules.allowMelee
      ? build.melee
      : null,
    pool: rules.allowMelee
      ? rankedMeleeWeapons
      : [],
    stopOrder: perkCount + 2,
  });

  // 4. Аптечка — отключается на 9-м и 10-м уровнях.
  result.push({
    id: "medkit",
    label: "Аптечка",
    type: "medkit",
    result: rules.allowMedkit
      ? build.medkit
      : null,
    pool: rules.allowMedkit
      ? rankedMedkits
      : [],
    stopOrder: perkCount + 3,
  });

  // 5–6. Два шприца — отключаются на 9-м и 10-м уровнях.
  for (let index = 0; index < 2; index++) {
    result.push({
      id: `syringe-${index + 1}`,
      label: "Шприц",
      type: "syringe",
      result: rules.allowSyringes
        ? build.syringes[index]
        : null,
      pool: rules.allowSyringes
        ? rankedSyringes
        : [],
      stopOrder: perkCount + 4 + index,
    });
  }

  // 7–10. Четыре расходника — ограничения задаются отдельно для каждого слота.
  for (let index = 0; index < 4; index++) {
    const consumableEnabled =
      rules.consumableSlots[index];

    result.push({
      id: `consumable-${index}`,
      label: "Расходник",
      type: "consumable",
      result: consumableEnabled
        ? build.consumables[index]
        : null,
      pool: consumableEnabled
        ? rankedConsumables
        : [],
      stopOrder: perkCount + 6 + index,
    });
  }

  // 11–14. Четыре позиции перков.
  for (let index = 0; index < 4; index++) {
    const perkEnabled =
      index < rules.maxPerkSlots;

    result.push({
      id: `perk-${index}`,
      label: `Перк ${index + 1}`,
      type: "perk",
      result: perkEnabled
        ? build.perks[index] ?? null
        : null,
      pool: perkEnabled
        ? rankedPerks
        : [],
      stopOrder: index,
    });
  }

  return result;
}, [build, contractLevel]);

// Передаём локальному считывателю список предметов, выпавших в 14 слотах.
// Названия передаются на русском и английском, чтобы сверять их с текстом Hunt.
useEffect(() => {
  let active = true;

  const translationTypeBySlot = {
    weapon: "weapon",
    melee: "melee",
    medkit: "medkit",
    syringe: "syringe",
    consumable: "consumable",
    perk: "perk",
  };

  const expectedItems = rows
    .filter((row) => row.result !== null && row.result !== undefined)
    .map((row) => {
      const name = itemName(row.result);
      const translationType = translationTypeBySlot[row.type] || "weapon";
      const aliases = [
        name,
        translateItemName(name, translationType, "ru"),
        translateItemName(name, translationType, "en"),
      ].filter((value, index, list) =>
        typeof value === "string" && value.trim() && list.indexOf(value) === index
      );

      return {
        id: row.id,
        type: row.type,
        name,
        aliases,
      };
    });

  fetch(GAME_LOADOUT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: expectedItems }),
  })
    .then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        throw new Error(result.message || `HTTP ${response.status}`);
      }
      console.info(`[RANDOMBUILD] Локальный считыватель принял ${result.expectedItems} предметов.`);
    })
    .catch((error) => {
      if (active) console.warn("[RANDOMBUILD] Не удалось передать выпавшую экипировку локальному считывателю:", error);
    });

  return () => {
    active = false;
  };
}, [rows]);


  async function generate() {
  if (
    generating ||
    !isRankValid
  ) {
    return;
  }

    setGenerating(true);

    try {
      /*
       * Вся логика билда по-прежнему
       * рассчитывается существующими
       * функциями:
       *
       * generatePerks()
       * generateWeapons()
       * generateBuild()
       *
       * Мы НЕ меняем их здесь.
       */
      const newBuild =
  generateBuild(
    contractLevel,
    Number(rankInput)
  );

      const newBuildCost = calculateBuildCost(newBuild);

      // В текущем уровне сохраняем прежнюю логику ON/OFF.
      // В накопительную статистику добавляем стоимость каждого сгенерированного билда.
      const currentLevelStats = normalisePlayerStats(contractProgress);
      syncCurrentPlayerStats(
        {
          ...currentLevelStats,
          // В ON суммарные расходы уровня нужны для расчёта чистой прибыли.
          // В OFF сохраняем прежнее поведение ручного режима.
          spent: contractModeOn
            ? currentLevelStats.spent + newBuildCost
            : newBuildCost,
          // В основной таблице показывается цена последнего билда,
          // а не сумма всех билдов уровня.
          lastBuildCost: newBuildCost,
        },
        { spent: newBuildCost }
      );

      /*
       * Сначала создаём весь набор строк.
       *
       * Это важно:
       * все рулетки будут существовать
       * одновременно.
       */
      setLabelCycle((value) => value + 1);
setBuild(newBuild);

      /*
       * Даём React один кадр,
       * чтобы все RouletteRow успели
       * смонтироваться.
       */
      await sleep(50);

      /*
       * Следующее значение generation
       * заставляет ВСЕ RouletteRow
       * одновременно начать движение.
       */
      setGeneration(
        (value) => value + 1
      );

      /*
       * Максимальное время вращения:
       *
       * 2.5 сек базово
       * + 0.5 сек на каждую следующую строку.
       *
       * Поэтому просто ждём с запасом.
       */
      const maxStopOrder = 13;

const totalDuration =
  ROULETTE_BASE_DURATION +
  maxStopOrder *
    ROULETTE_STOP_INTERVAL +
  300;

await sleep(
  totalDuration
);
    } catch (error) {
      console.error(error);

      alert(
        error.message
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main
      className={`app ${language === "en" ? "app-en" : "app-ru"}`}
      data-screen-reader-status={huntReaderDiagnostics?.status || "not-reported"}
      data-screen-reader-mode={huntReaderDiagnostics?.screenMode || "unknown"}
      data-screen-reader-monitors={huntReaderDiagnostics?.monitorCount ?? 0}
      data-screen-reader-matched-slots={huntReaderDiagnostics?.matchedSlotCount ?? 0}
      data-logbackups-files={huntLogDiagnostics?.latestBackupLogs?.length ?? 0}
      data-log-event-count={huntLogEvents.length}
    >

  <div className="lantern-firelight" aria-hidden="true" />

      <header
  className={`header ${
    language === "en" ? "header-en" : ""
  }`}
>
   <div className={`rank-control ${
  !isRankValid
    ? "is-rank-required"
    : ""
}`}>
  <label
    className="rank-title"
    htmlFor="hunter-rank"
  >
    {language === "ru" ? "РАНГ" : "RANK"}
  </label>

    

<img
  className="rank-panel-artwork"
  src={getUiPng(
    language === "en" ? "rank-panel-en.png" : "rank-panel.png"
  )}
  alt=""
  aria-hidden="true"
/>

<div
  className="rank-required-glow"
  aria-hidden="true"
/>

  <input
    id="hunter-rank"
    className="rank-input"
    type="text"
    inputMode="numeric"
    maxLength={3}
    autoComplete="off"
    autoCorrect="off"
    autoCapitalize="off"
    spellCheck={false}
    value={rankInput}
    onChange={(event) => {
  const value = event.target.value;

  if (value === "") {
    setRankInput("");
    return;
  }

  if (!/^\d{1,3}$/.test(value)) {
    return;
  }

  const numericValue = Number(value);

  if (numericValue > 100) {
    setRankInput("100");
    return;
  }

  setRankInput(value);
}}
    onKeyDown={(event) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        changeRank(1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        changeRank(-1);
      }
    }}
    aria-label={
      language === "ru"
        ? "Ранг охотника"
        : "Hunter rank"
    }
    aria-invalid={
      rankInput !== "" && !isRankValid
    }
  />

  <div className="rank-stepper" aria-label={
    language === "ru" ? "Изменить ранг" : "Adjust rank"
  }>
    <button
      type="button"
      className="rank-stepper-up"
      onClick={() => changeRank(1)}
        aria-label={language === "ru" ? "Увеличить ранг" : "Increase rank"}
      title={language === "ru" ? "Увеличить ранг" : "Increase rank"}
    >
      <img
        src={new URL(
          "../Images/ui/rank-arrow-up.png",
          import.meta.url
        ).href}
        alt=""
        aria-hidden="true"
      />
    </button>
    <button
      type="button"
      className="rank-stepper-down"
      onClick={() => changeRank(-1)}
        aria-label={language === "ru" ? "Уменьшить ранг" : "Decrease rank"}
      title={language === "ru" ? "Уменьшить ранг" : "Decrease rank"}
    >
      <img
        src={new URL(
          "../Images/ui/rank-arrow-down.png",
          import.meta.url
        ).href}
        alt=""
        aria-hidden="true"
      />
    </button>
  </div>
</div>

        <div>
          <h1>
            РАНДОМБИЛД
          </h1>

          <p>
            HUNT: SHOWDOWN
          </p>
        </div>

            <button
  type="button"
  className="language-toggle"
  onClick={() =>
    setLanguage((current) =>
      current === "ru" ? "en" : "ru"
    )
  }
  aria-label={language === "ru" ? "Switch to English" : "Переключить на русский"}
  title={language === "ru" ? "Switch language" : "Сменить язык"}
>
  <img
    className="language-toggle-frame"
    src={new URL(
      "../Images/ui/language-toggle-frame.png",
      import.meta.url
    ).href}
    alt=""
    aria-hidden="true"
  />
  <span className={`language-choice ${language === "ru" ? "is-active" : ""}`}>RU</span>
  <span className="language-separator">/</span>
  <span className={`language-choice ${language === "en" ? "is-active" : ""}`}>EN</span>
</button>

        <img
          className="player-nickname-field-art"
          src={getUiPng("player-nickname-field.png")}
          alt=""
          aria-hidden="true"
          draggable={false}
        />

        <input
          className="player-nickname-input"
          type="text"
          maxLength={24}
          value={nicknameDraft}
          onChange={(event) => updateNicknameDraft(event.target.value)}
          onBlur={savePlayerNickname}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          autoComplete="nickname"
          spellCheck={false}
          placeholder={language === "ru" ? "ВВЕДИТЕ НИК" : "ENTER NICKNAME"}
          aria-label={language === "ru" ? "Ник игрока" : "Player nickname"}
          aria-invalid={Boolean(nicknameSaveError)}
          title={nicknameSaveError || (language === "ru" ? "Введите ник. Изменения сохраняются автоматически при выходе из поля." : "Enter your nickname. Changes save automatically when you leave the field.")}
        />

        <div
          className="player-kills-money-board"
          role="group"
          aria-label={language === "ru" ? "Цели текущего уровня" : "Current level goals"}
        >
          <img
            className="player-kills-money-board-image"
            src={getUiPng(
              language === "en"
                ? "player-kills-money-board-en.png"
                : "player-kills-money-board.png"
            )}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <span
            className="player-kills-money-goal player-kills-money-goal-kills"
            data-goal="kills"
            aria-label={language === "ru" ? "Осталось убийств" : "Kills remaining"}
          >
            {Math.max(
              0,
              contractLevel * 2 - (Number(contractProgress.kills) || 0)
            ).toLocaleString(language === "ru" ? "ru-RU" : "en-US")}
          </span>
          <span
            className="player-kills-money-goal player-kills-money-goal-money"
            data-goal="money"
            aria-label={language === "ru" ? "Осталось чистой прибыли" : "Net profit remaining"}
          >
            {Math.max(
              0,
              contractLevel * 2000 - (
                (Number(contractProgress.money) || 0) -
                (Number(contractProgress.spent) || 0)
              )
            ).toLocaleString(language === "ru" ? "ru-RU" : "en-US")}
          </span>
        </div>

<button
  type="button"
  className={`generate-button ${
    language === "en"
      ? "generate-button-en"
      : ""
  } ${generating ? "is-generating" : ""} ${
    isRankValid ? "is-rank-ready" : ""
  }`}
  onClick={generate}
  disabled={
    generating ||
    !isRankValid
  }
  aria-label={
    language === "ru"
      ? (generating ? "Генерация билда" : "Сгенерировать билд")
      : (generating ? "Generating build" : "Generate build")
  }
>

  <img
    className="generate-button-image"
    src={getUiPng(
      generating
        ? (language === "ru"
            ? "hunt-generating-button.png"
            : "hunt-generating-button-en.png")
        : (language === "ru"
            ? "hunt-generate-button-ru.png"
            : "hunt-generate-button-en.png")
    )}
    alt=""
    aria-hidden="true"
  />
    <span
    className="generate-button-inner-glow"
    aria-hidden="true"
  />
</button>
      </header>

      <button
        type="button"
        className={`contract-mode-switch ${contractModeOn ? "is-on" : "is-off"}`}
        role="switch"
        aria-checked={contractModeOn}
        aria-label={
          language === "ru"
            ? (contractModeOn ? "Автоматический уровень включён" : "Автоматический уровень выключен")
            : (contractModeOn ? "Automatic level is on" : "Automatic level is off")
        }
        title={
          language === "ru"
            ? (contractModeOn ? "Выключить фиксацию уровня" : "Включить фиксацию уровня")
            : (contractModeOn ? "Unlock level selection" : "Lock level selection")
        }
        onClick={toggleContractMode}
        disabled={generating}
      >
        <img
          className="contract-mode-switch-art"
          src={getUiPng(
            contractModeOn
              ? "contract-mode-switch-on.png"
              : "contract-mode-switch-off.png"
          )}
          alt=""
          aria-hidden="true"
        />
        <img
          className="contract-mode-switch-knob"
          src={new URL(
            "../Images/ui/contract-mode-knob.png",
            import.meta.url
          ).href}
          alt=""
          aria-hidden="true"
        />
      </button>

      <div
        className={`contract-progress ${contractModeOn ? "is-locked" : "is-manual"}`}
        role="group"
        aria-label={
          language === "ru" ? "Уровни сложности" : "Difficulty levels"
        }
      >
        <div className="contract-progress-list" role="group">
          {Array.from({ length: 10 }, (_, index) => {
            const level = index + 1;
            const isCurrent = level === contractLevel;
            const isCompleted = level < contractLevel;

            return (
              <button
                key={level}
                type="button"
                className={`contract-progress-step ${
                  isCurrent
                    ? "is-current"
                    : isCompleted
                      ? "is-completed"
                      : "is-upcoming"
                }`}
                disabled={contractModeOn || generating}
                onClick={() => selectContractLevel(level)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={
                  language === "ru"
                    ? `Выбрать уровень ${level}`
                    : `Select level ${level}`
                }
                aria-pressed={isCurrent}
              >
                <img
                  src={
                    level <= contractLevel
                      ? new URL(
                          "../Images/ui/difficulty-diamond-active.png",
                          import.meta.url
                        ).href
                      : new URL(
                          "../Images/ui/difficulty-diamond.png",
                          import.meta.url
                        ).href
                  }
                  alt=""
                  aria-hidden="true"
                />
                <span>{level}</span>
              </button>
            );
                    })}
        </div>

        <PlayerStatBoard
          slot={1}
          nickname={getDisplayedPlayerNickname(1)}
          stats={getDisplayedPlayerStats(1)}
          lifetimeStats={getDisplayedPlayerLifetimeStats(1)}
          showLifetime={currentPlayerSlot === 1 || !currentPlayerSlot}
          editable={currentPlayerSlot === 1}
          language={language}
          drafts={currentPlayerSlot === 1 ? contractStatDrafts : { kills: "", money: "" }}
          onDraftChange={updateContractStat}
          onCommit={commitContractStat}
          contractLevel={contractLevel}
          activityEvent={
            huntLogEvents.length
              ? huntLogEvents[huntLogEvents.length - 1].type
              : "none"
          }
        />

        <PlayerStatBoard
          slot={2}
          nickname={getDisplayedPlayerNickname(2)}
          stats={getDisplayedPlayerStats(2)}
          lifetimeStats={getDisplayedPlayerLifetimeStats(2)}
          showLifetime={currentPlayerSlot === 2}
          editable={currentPlayerSlot === 2}
          language={language}
          drafts={currentPlayerSlot === 2 ? contractStatDrafts : { kills: "", money: "" }}
          onDraftChange={updateContractStat}
          onCommit={commitContractStat}
        />

        <PlayerStatBoard
          slot={3}
          nickname={getDisplayedPlayerNickname(3)}
          stats={getDisplayedPlayerStats(3)}
          lifetimeStats={getDisplayedPlayerLifetimeStats(3)}
          showLifetime={currentPlayerSlot === 3}
          editable={currentPlayerSlot === 3}
          language={language}
          drafts={currentPlayerSlot === 3 ? contractStatDrafts : { kills: "", money: "" }}
          onDraftChange={updateContractStat}
          onCommit={commitContractStat}
        />

          <button
            type="button"
            className="contract-reset-button"
            onClick={() => {
              const confirmed = window.confirm(
                language === "ru"
                  ? "Полностью обнулить показатели игрока: текущий прогресс и накопительную статистику за все уровни? Уровень сложности останется без изменений."
                  : "Completely reset this player's counters: current progress and lifetime totals across all levels? The difficulty level will remain unchanged."
              );

              if (confirmed) {
                resetAllContractStats();
              }
            }}
            disabled={generating}
            aria-label={language === "ru" ? "Обнулить все показатели" : "Reset all counters"}
          >
            <span className="contract-reset-icon" aria-hidden="true">↺</span>
            <span>{language === "ru" ? "СБРОС" : "RESET"}</span>
          </button>
      </div>

      <section className="roulette">
  {rows.map((row) => (
    <RouletteRow
      key={row.id}
      label={row.label}
      type={row.type}
      result={row.result}
      pool={row.pool}
      generation={generation}
      language={language}
labelCycle={labelCycle}
stopOrder={row.stopOrder}
      dualPistols={row.dualPistols}
      rouletteStep={rouletteStep}
      slotMatch={slotMatches[row.id] === true}
    />
  ))}
</section>
{/* Прозрачная кнопка клика поверх значка инструкции, уже нарисованного в randombuild-main-screen.png. */}

{/* Отдельная кнопка инструкции с собственной графикой. */}
{!isGuideOpen && (
  <button
    type="button"
    className="guide-button"
    onClick={() => setIsGuideOpen(true)}
    aria-label={
      language === "ru"
        ? "Открыть инструкцию RandomBuild"
        : "Open the RandomBuild user guide"
    }
    title={language === "ru" ? "Инструкция" : "User guide"}
  >
    <img
      src={new URL(
        "../Images/ui/randombuild-guide-button-round.png",
        import.meta.url
      ).href}
      alt=""
      aria-hidden="true"
    />
  </button>
)}


{isGuideOpen && (
  <div
    className="guide-overlay"
    role="dialog"
    aria-modal="true"
    aria-label={
      language === "ru"
        ? "Руководство пользователя RandomBuild"
        : "RandomBuild user guide"
    }
    onClick={(event) => {
      if (event.target === event.currentTarget) {
        setIsGuideOpen(false);
      }
    }}
  >
    <button
      type="button"
      className="guide-close-button"
      onClick={() => setIsGuideOpen(false)}
      aria-label={language === "ru" ? "Закрыть инструкцию" : "Close the guide"}
      title={language === "ru" ? "Закрыть" : "Close"}
      autoFocus
    >
      ×
    </button>

    <img
      className="guide-image"
      src={
        language === "ru"
          ? new URL(
              "../Images/ui/randombuild-user-guide-ru.png",
              import.meta.url
            ).href
          : new URL(
              "../Images/ui/randombuild-user-guide.png",
              import.meta.url
            ).href
      }
      alt={
        language === "ru"
          ? "Руководство пользователя RandomBuild"
          : "RandomBuild User Guide"
      }
    />
  </div>
)}

<div className={`room-control-panel ${roomConnectionOpen && canOpenRoomConnection ? "is-connecting" : ""} ${isInRoom ? "is-connected" : "is-disconnected"}`}>
  <div className="room-control-header">
    <div className="room-control-title">
      {language === "ru" ? "КОМНАТА" : "ROOM"}
    </div>

    {isInRoom && roomInfo?.code ? (
      <>
        <span className="room-control-code">{roomInfo.code}</span>
        <button
          type="button"
          className="room-copy-icon-button"
          onClick={() => navigator.clipboard?.writeText(roomInfo.code)}
          title={language === "ru" ? "Скопировать ключ комнаты" : "Copy room key"}
          aria-label={language === "ru" ? "Скопировать ключ комнаты" : "Copy room key"}
        >
          ⧉
        </button>
      </>
    ) : (
      <span className="room-control-status">
        {language === "ru" ? "НЕ В КОМНАТЕ" : "NOT IN A ROOM"}
      </span>
    )}
  </div>

  <div className="room-team-list room-player-slots">
    {[0, 1, 2].map((index) => {
      const teamMember = roomPlayersForLocalView[index];
      const displayedNickname = teamMember && Number(teamMember.slot) === Number(currentPlayerSlot)
        ? (String(nicknameDraft || "").trim() || teamMember.nickname)
        : teamMember?.nickname;

      return (
        <div className="room-player-slot" key={teamMember?.slot || `empty-${index}`}>
          <span className="room-player-slot-title">
            {language === "ru" ? `ИГРОК ${index + 1}` : `PLAYER ${index + 1}`}
          </span>
          {teamMember ? (
            <span className="room-player">{displayedNickname}</span>
          ) : (
            <span
              className="room-player room-player-empty"
              aria-label={language === "ru" ? `Свободное место ${index + 1}` : `Open slot ${index + 1}`}
            >
              —
            </span>
          )}
        </div>
      );
    })}
  </div>

  <div className="room-control-footer">
    <div className="room-player-count">
      <span className="room-player-count-icon" aria-hidden="true">♟</span>
      {isInRoom && !roomInfo
        ? (language === "ru" ? "СИНХРОНИЗАЦИЯ..." : "SYNCHRONIZING...")
        : `${Math.min(roomPlayerCount, 3)} / 3 ${language === "ru" ? "игроков" : "players"}`}
    </div>

    {canOpenRoomConnection ? (
      <button
        type="button"
        className="room-action-button room-connect-toggle"
        onClick={() => {
          setRoomConnectionOpen((open) => !open);
          setRegistrationError("");
        }}
      >
        {roomConnectionOpen
          ? (language === "ru" ? "ОТМЕНА" : "CANCEL")
          : (language === "ru" ? "ВОЙТИ В КОМНАТУ" : "JOIN ROOM")}
      </button>
    ) : (
      <button type="button" className="room-action-button room-leave-button" onClick={leaveRoom}>
        {language === "ru" ? "ВЫЙТИ ИЗ КОМНАТЫ" : "LEAVE ROOM"}
      </button>
    )}
  </div>

  {roomConnectionOpen && canOpenRoomConnection && (
    <div className="room-connect-form">
      <input
        className="room-key-input"
        type="text"
        maxLength={8}
        value={roomCodeDraft}
        onChange={(event) => setRoomCodeDraft(event.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 8))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            joinRoom();
          }
        }}
        autoComplete="off"
        spellCheck={false}
        placeholder="RB-XXXXX"
        aria-label={language === "ru" ? "Ключ комнаты" : "Room key"}
      />
      <button
        type="button"
        className="room-form-join-button"
        onClick={joinRoom}
        disabled={!effectiveRoomNickname || !roomCodeDraft.trim()}
      >
        {language === "ru" ? "ПОДКЛЮЧИТЬСЯ" : "JOIN"}
      </button>
      <button
        type="button"
        className="room-form-create-button"
        onClick={createRoom}
        disabled={!effectiveRoomNickname}
        title={language === "ru" ? "Создать новую комнату и получить ключ" : "Create a new room and get a key"}
      >
        {language === "ru" ? "СОЗДАТЬ КОМНАТУ" : "CREATE ROOM"}
      </button>
      {registrationError && (
        <div className="room-registration-error">{registrationError}</div>
      )}
      {!effectiveRoomNickname && (
        <div className="room-registration-hint">
          {language === "ru" ? "Сначала укажите ник над кнопкой генерации билда." : "Enter your nickname above the Generate Build button first."}
        </div>
      )}
    </div>
  )}
</div>

    </main>
  );
}

ReactDOM.createRoot(
  document.getElementById(
    "root"
  )
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
