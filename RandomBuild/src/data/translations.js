
const ITEM_TRANSLATIONS = Object.fromEntries(
  `
# ОРУЖИЕ
Берджес|Burgess
Берджес со штыком|Burgess Bayonet
Берджес «Перелом»|Burgess Trauma
Карабин 1865|1865 Carbine
Карабин 1865 «Линза»|1865 Carbine Aperture
Карабин 1865 с глушителем|1865 Carbine Silencer
Berthier 1892|Berthier 1892
Berthier 1892 «Меткий глаз»|Berthier 1892 Deadeye
Berthier 1892 «Опытный стрелок»|Berthier 1892 Marksman
Berthier 1892 «Укол»|Berthier 1892 Riposte
Столетие|Centennial
Столетие «Наводчик»|Centennial Pointman
Столетие укороченная|Centennial Shorty
Столетие укороченная с глушителем|Centennial Shorty Silencer
Столетие «Снайпер»|Centennial Sniper
Столетие «Перелом»|Centennial Trauma
Трехстволка|Drilling
Трехстволка «Топор»|Drilling Hatchet
Трехстволка укороченная|Drilling Shorty
Фронтир 73C|Frontier 73C
Фронтир 73C «Опытный стрелок»|Frontier 73C Marksman
Фронтир 73C с глушителем|Frontier 73C Silencer
Вандал 73C|Vandal 73C
Вандал 73C «Точный выстрел»|Vandal 73C Bullseye
Вандал 73C «Ударник»|Vandal 73C Striker
Пехотная 73L|Infantry 73L
Пехотная 73L со штыком|Infantry 73L Bayonet
Пехотная 73L «Снайпер»|Infantry 73L Sniper
Краг|Krag
Краг со штыком|Krag Bayonet
Краг с глушителем|Krag Silencer
Краг «Снайпер»|Krag Sniper
Lebel 1886|Lebel 1886
Lebel 1886 «Линза»|Lebel 1886 Aperture
Lebel 1886 «Опытный стрелок»|Lebel 1886 Marksman
Lebel 1886 «Коготь»|Lebel 1886 Talon
Карабин LeMat|LeMat Carbine
Карабин LeMat «Опытный стрелок»|LeMat Carbine Marksman
LeMat|LeMat
LeMat «Косарь»|Haymaker
Mako 1895|Mako 1895
Mako 1895 «Линза»|Mako 1895 Aperture
Mako 1895 «Клык»|Mako 1895 Claw
Marathon|Marathon
Marathon «Стриж»|Marathon Swift
Martini-Henry|Martini-Henry
Martini-Henry «Меткий глаз»|Martini-Henry Deadeye
Martini-Henry «Пострел»|Martini-Henry Ironside
Martini-Henry «Опытный стрелок»|Martini-Henry Marksman
Martini-Henry «Укол»|Martini-Henry Riposte
Снайперская винтовка Мейнарда|Maynard Sniper
Винтовка Maynard с глушителем|Maynard Sniper Silencer
Mosin-Nagant|Mosin-Nagant
Mosin-Nagant «Автомат»|Mosin-Nagant Avtomat
Mosin-Nagant со штыком|Mosin-Nagant Bayonet
Mosin-Nagant «Снайпер»|Mosin-Nagant Sniper
Mosin «Обрез»|Mosin Obrez
Mosin «Обрез» с магазином|Mosin Obrez Extended
Mosin «Обрез» с булавой|Mosin Obrez Mace
Поединок (Mosin «Обрез»)|Mosin Obrez Match
Остроглаз (Mosin «Обрез»)|Mosin Obrez Sharpeye
Nitro Express|Nitro Express
Офицерский карабин|Officer Carbine
Офицерский карабин «Меткий глаз»|Officer Carbine Deadeye
Офицерский|Officer
Офицерский «Боец»|Officer Brawler
Рейнджер 73|Ranger 73
Рейнджер 73 «Линза»|Ranger 73 Aperture
Рейнджер 73 «Стриж»|Ranger 73 Swift
Рейнджер 73 «Коготь»|Ranger 73 Talon
Sparks|Sparks
Sparks с глушителем|Sparks Silencer
Sparks «Снайпер»|Sparks Sniper
Пистолет Sparks|Sparks Pistol
Пистолет Sparks с глушителем|Sparks Pistol Silencer
Springfield 1866|Springfield 1866
Springfield 1866 со штыком|Springfield 1866 Bayonet
Springfield 1866 «Опытный стрелок»|Springfield 1866 Marksman
Springfield 1866 укороченная|Springfield 1866 Shorty
Springfield 1866 «Точный выстрел»|Springfield 1866 Bullseye
Springfield 1866 «Ударник»|Springfield 1866 Striker
Кавалерийская 1890|1890 Cavalry
Vetterli 71|Vetterli 71
Vetterli 71 со штыком|Vetterli 71 Bayonet
Vetterli 71 «Циклон»|Vetterli 71 Cyclone
Vetterli 71 «Меткий глаз»|Vetterli 71 Deadeye
Vetterli 71 «Опытный стрелок»|Vetterli 71 Marksman
Vetterli 71 с глушителем|Vetterli 71 Silencer
Auto-4 укороченный|Auto-4 Shorty
Auto-5|Auto-5
Rival 78|Rival 78
Rival 78 с булавой|Rival 78 Mace
Rival 78 укороченный|Rival 78 Shorty
Rival 78 «Перелом»|Rival 78 Trauma
Romero 77|Romero 77
Romero 77 «Аламо»|Romero 77 Alamo
Romero 77 «Топор»|Romero 77 Hatchet
Romero 77 укороченный|Romero 77 Shorty
Romero 77 «Коготь»|Romero 77 Talon
Расплата|Slate
Расплата со штыком|Slate Riposte
Specter 1882|Specter 1882
Specter 1882 со штыком|Specter 1882 Bayonet
Specter 1882 укороченный|Specter 1882 Shorty
Терминус|Terminus
Терминус укороченный|Terminus Shorty
Bornheim № 3|Bornheim No. 3
Bornheim № 3 увеличенной емкости|Bornheim No. 3 Extended
Bornheim № 3 «Поединок»|Bornheim No. 3 Match
Bornheim № 3 с глушителем|Bornheim No. 3 Silencer
Conversion|Conversion
Conversion с патронной лентой|Conversion Chain Pistol
Dolch 96|Dolch 96
Dolch 96 «Точный выстрел»|Dolch 96 Bullseye
Dolch 96 «Клык»|Dolch 96 Claw
Dolch 96 повышенной точности|Dolch 96 Precision
Nagant M1895|Nagant M1895
Nagant M1895 «Меткий глаз»|Nagant M1895 Deadeye
Nagant M1895 повышенной точности|Nagant M1895 Precision
Nagant M1895 с глушителем|Nagant M1895 Silencer
Армейский|New Army
Армейский «Стриж»|New Army Swift
Pax|Pax
Pax «Клык»|Pax Claw
Pax «Верняк»|Pax Trueshot
Scottfield|Scottfield
Scottfield «Боец»|Scottfield Brawler
Scottfield повышенной точности|Scottfield Precision
Scottfield «Задира»|Scottfield Spitfire
Scottfield «Стриж»|Scottfield Swift
Апперкот|Uppercut
Апперкот «Меткий глаз»|Uppercut Deadeye
Апперкот повышенной точности|Uppercut Precision
Ланкастер|Lancaster
Копье со взрывчаткой|Bomb Lance
Бомбомет|Bomb Launcher
Чо-ко-ну|Chu Ko Nu
Арбалет|Crossbow
Арбалет «Меткий глаз»|Crossbow Deadeye
Ручной арбалет|Hand Crossbow
Охотничий лук|Hunting Bow
Бита|Baseball Bat
Кавалерийская сабля|Cavalry Saber
Катана|Katana
Мачете|Machete
Боевой топор|Combat Axe

# ОРУЖИЕ БЛИЖНЕГО БОЯ
Дротик|Throwing Spear
Нож-кастет|Knuckle Knife
Большой нож|Heavy Knife
Кастет|Dusters
Метательные топоры|Throwing Axes
Нож|Knife
Метательные ножи|Throwing Knives

# АПТЕЧКИ
Набор первой помощи|First Aid Kit
Медицинский набор|Medical Pack

# ШПРИЦЫ
Шприц восполнения|Recovery Shot
Шприц с лекарством|Vitality Shot
Шприц с лекарством (слабый)|Vitality Shot (Weak)
Шприц с обезболивающим|Regeneration Shot
Шприц с обезболивающим (слабый)|Regeneration Shot (Weak)
Шприц с противоядием|Antidote Shot
Шприц с противоядием (слабый)|Antidote Shot (Weak)
Шприц со стимулятором|Stamina Shot
Шприц со стимулятором (слабый)|Stamina Shot (Weak)

# РАСХОДНИКИ
Крупнокалиберный Derringer|Long Derringer
Derringer (боеприпасы с монетами)|Derringer Pennyshot
Большая связка динамитных шашек|Big Dynamite Bundle
Бомба «Адское пламя»|Hellfire Bomb
Бомба «Жидкий огонь»|Liquid Fire Bomb
Бомба «Улей»|Hive Bomb
Бомба «Хаос»|Chaos Bomb
Бомба с колючей проволокой|Concertina Bomb
Бомба-липучка|Sticky Bomb
Влагостойкая динамитная шашка|Waxed Dynamite Stick
Граната с ядом|Poison Bomb
Динамитная шашка|Dynamite Stick
Жук-душитель|Choke Beetle
Жук-ловец|Stalker Beetle
Зажигательная смесь|Fire Bomb
Коробка с боеприпасами|Ammo Box
Ловушка с колючей проволокой|Concertina Trip Mines
Медвежьи капканы|Bear Traps
Обманки|Decoys
Обманки с бездымным порохом|Blank Fire Decoys
Огнежук|Fire Beetle
Осколочная граната|Frag Bomb
Световая граната|Flash Bomb
Связка динамитных шашек|Dynamite Bundle
Связка темного динамита|Dark Dynamite Satchel
Сигнальная ловушка|Alert Trip Mines
Сигнальные факелы|Fusees
Сигнальный пистолет|Flare Pistol
Удушающая бомба|Choke Bombs
Фитили-обманки|Decoy Fuses
Четырехзарядный Derringer|Quad Derringer
Ящик с инструментами|Tool Box

# ПЕРКИ
Адреналин|Adrenaline
Амбидекстер|Ambidextrous
Арбалетчик|Bolt Thrower
Барахольщик|Decoy Supply
Бдительный|Vigilant
Бесстрашный|Dauntless
Бесшумный Убийца|Silent Killer
Браконьер|Poacher
Быстрые пальцы|Fast Fingers
Взрывостойкость|Bulwark
Воздушный Змей|Kiteskin
Врач|Doctor
Вьючный Мул|Packmule
Гончая|Greyhound
Густая Кровь|Bloodless
Дубовая Кожа|Hornskin
Зачинщик|Assailant
Звериный Лик|Beastface
Змея|Serpent
Зоркий Глаз|Blade Seer
Интендант|Quartermaster
Крокодильи Лапы|Gator Legs
Ловкие Пальцы|Bulletgrubber
Мастер|Martialist
Медик|Physician
Митридатизм|Mithridatist
Могильщик|Ghoul
На Мушке|Iron Eye
Некромант|Necromancer
Острое чутье|Blast Sense
Первопроходец|Frontiersman
Подающий|Pitcher
Полтергейст|Poltergeist
Прикосновение Жизни|Conduit
Рвение|Vigor
Рычажный Механизм|Levering
Саламандра|Salveskin
Свидетель|Witness
Сорока|Magpie
Стервятник|Vulture
Стойкость|Resilience
Сторукий|Hundred Hands
Стрелок|Scopesmith
Тихоня|Whispersmith
Точная Стрельба|Steady Aim
Устойчивость|Surefoot
Целеустремленность|Determination
Чувство боли|Pain Sense
Чупакабра|Chupacabra
Шквальный Огонь|Fanning
Легкая поступь|Lightfoot
  `
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("|");

      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim(),
      ];
    })
);

// Нормализация нужна для пробелов, регистра и букв ё/е.
function normalizeTranslationKey(value) {
  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/ё/g, "е");
}

const NORMALIZED_ITEM_TRANSLATIONS = Object.fromEntries(
  Object.entries(ITEM_TRANSLATIONS).map(([russian, english]) => [
    normalizeTranslationKey(russian),
    english,
  ])
);

const SLOT_TRANSLATIONS = {
  "основное оружие": "Primary Weapon",
  "второе оружие": "Secondary Weapon",
  "оружие ближнего боя": "Melee Weapon",
  "аптечка": "Medkit",
  "шприц": "Syringe",
  "расходник": "Consumable",
};

export function translateItemName(name, language) {
  if (language !== "en" || !name) {
    return name;
  }

  return (
    NORMALIZED_ITEM_TRANSLATIONS[normalizeTranslationKey(name)] ||
    name
  );
}

export function translateSlotLabel(label, language) {
  if (language !== "en") {
    return label;
  }

  const perkMatch = /^Перк\s+(\d+)$/i.exec(label);

  if (perkMatch) {
    return `Perk ${perkMatch[1]}`;
  }

  return (
    SLOT_TRANSLATIONS[normalizeTranslationKey(label)] ||
    label
  );
}
